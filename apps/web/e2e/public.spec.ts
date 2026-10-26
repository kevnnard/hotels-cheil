import { Page, expect, test } from '@playwright/test';

const catalogPageSize = 8;

function hotelCards(page: Page) {
  return page.getByTestId('catalog-results').getByTestId('hotel-card');
}

async function searchByName(page: Page, name: string): Promise<void> {
  await page.getByRole('searchbox', { name: 'Search by name' }).fill(name);
  await expect(page).toHaveURL(new RegExp(`[?&]name=${encodeURIComponent(name).replace(/%20/g, '(\\+|%20)')}`));
}

test.describe('public catalogue', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('shows the heading and a full first page of hotels', async ({ page }) => {
    await expect(page.getByRole('heading', { level: 1, name: 'Architecture of Silence' })).toBeVisible();
    await expect(hotelCards(page)).toHaveCount(catalogPageSize);
  });

  test('narrows the results by name and keeps the name in the URL', async ({ page }) => {
    await searchByName(page, 'Marrakech');
    await expect(hotelCards(page)).toHaveCount(1);
    await expect(hotelCards(page).first().getByRole('heading', { level: 3 })).toHaveText('Aurea Marrakech Riad');
  });

  test('filters by minimum rating using the card badges', async ({ page }) => {
    const group = page.getByRole('group', { name: 'Minimum rating' });
    await expect(group.getByRole('button')).toHaveText(['All', '3.0+', '3.5+', '4.0+', '4.5+', '4.9+']);

    const filtered = page.waitForResponse((response) => /\/api\/public\/hotels\?.*minRating=4(&|$)/.test(response.url()));
    await group.getByRole('button', { name: '4.0+' }).click();
    await filtered;
    await expect(page).toHaveURL(/[?&]minRating=4(&|$)/);
    await expect(group.getByRole('button', { name: '4.0+' })).toHaveAttribute('aria-pressed', 'true');

    const results = page.getByTestId('catalog-results');
    await expect(async () => {
      await expect(results).toHaveAttribute('aria-busy', 'false', { timeout: 1000 });
      const cardCount = await hotelCards(page).count();
      const badges = await results.getByTestId('card-rating').allTextContents();
      expect(cardCount).toBeGreaterThan(0);
      expect(badges).toHaveLength(cardCount);
      expect(badges.map((badge) => Number(badge.trim())).filter((rating) => !(rating >= 4))).toEqual([]);
    }).toPass();
  });

  test('never shows an inactive hotel', async ({ page }) => {
    await searchByName(page, 'Hoi An');
    await expect(page.getByTestId('catalog-empty')).toBeVisible();
    await expect(page.getByTestId('catalog-empty')).toContainText('No hotels found');
    await expect(hotelCards(page)).toHaveCount(0);
  });

  test('opens the detail page of a hotel card', async ({ page }) => {
    const card = hotelCards(page).first();
    const name = ((await card.getByRole('heading', { level: 3 }).textContent()) ?? '').trim();
    await card.getByRole('link', { name: 'Explore' }).click();

    await expect(page).toHaveURL(/\/hotels\/[0-9a-f-]{36}$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveCount(1);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(name);
    await expect(page.getByRole('heading', { name: 'Rate this hotel' })).toBeVisible();
    await expect(page.getByTestId('rating-panel-anonymous')).toHaveText('Sign in to rate this hotel.');
  });
});

test('a made-up hotel id shows Hotel not found', async ({ page }) => {
  await page.goto('/hotels/00000000-0000-4000-8000-000000000000');
  await expect(page.getByTestId('detail-not-found')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Hotel not found' })).toBeVisible();
});
