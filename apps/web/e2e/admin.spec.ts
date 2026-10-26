import { Locator, Page, expect, test } from '@playwright/test';
import { adminHotelIdNamed, adminToken, deleteHotel, publicHotelNames } from './helpers/api';
import { adminCredentials } from './helpers/env';
import { submitAdminLogin } from './helpers/sign-in';
import { strongPassword, uniqueSuffix } from './helpers/unique';

function hotelsHeading(page: Page): Locator {
  return page.getByRole('heading', { level: 1, name: 'Hotels' });
}

async function signInToConsole(page: Page): Promise<void> {
  await submitAdminLogin(page, adminCredentials());
  await expect(page).toHaveURL(/\/admin$/);
  await expect(hotelsHeading(page)).toBeVisible();
}

async function openSheet(page: Page, opener: Locator, title: string): Promise<Locator> {
  await opener.click();
  const sheet = page.getByRole('dialog', { name: title });
  await expect(sheet).toBeVisible();
  return sheet;
}

function hotelIdFromEditHref(href: string | null): string {
  const id = /\/admin\/hotels\/([^/?#]+)\/edit/.exec(href ?? '')?.[1];
  if (id === undefined) {
    throw new Error('The Edit link does not carry a hotel id.');
  }
  return id;
}

test.describe('administration', () => {
  test('rejects a wrong password', async ({ page }) => {
    const { email } = adminCredentials();
    await submitAdminLogin(page, { email, password: `Wrong-${uniqueSuffix()}-9` });
    await expect(page.getByTestId('login-error')).toHaveText('Invalid email or password.');
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test('signs in and reaches the hotel directory', async ({ page }) => {
    await signInToConsole(page);
  });

  test('creates, edits, hides, rates and deletes a hotel', async ({ page, browser, request }, testInfo) => {
    test.setTimeout(120_000);
    const credentials = adminCredentials();
    const suffix = uniqueSuffix();
    const name = `E2E Hotel ${suffix}`;
    let hotelId: string | null = null;

    try {
      await signInToConsole(page);

      const createSheet = await openSheet(page, page.getByRole('link', { name: 'New hotel' }), 'New hotel');
      await createSheet.getByRole('button', { name: 'Create hotel' }).click();
      await expect(createSheet.getByTestId('hotel-field-name-error')).toHaveText('Enter the hotel name.');

      await createSheet.getByTestId('hotel-field-name').fill(name);
      await createSheet.getByLabel('City', { exact: true }).fill('Lisbon');
      await createSheet.getByLabel('Country', { exact: true }).fill('Portugal');
      await createSheet.getByLabel('Price per night', { exact: true }).fill('150');
      await createSheet.getByLabel('Discount', { exact: true }).fill('10');
      await expect(createSheet.getByTestId('hotel-price-preview')).toHaveText(/Guests pay\s*\$135\s*per night/);

      await createSheet.getByRole('button', { name: 'Create hotel' }).click();
      await expect(page.getByTestId('directory-status')).toHaveText('Hotel created.');
      await expect(createSheet).toBeHidden();

      await page.getByLabel('Search by name').fill(name);
      const editLink = page.getByRole('link', { name: `Edit ${name}`, exact: true });
      await expect(editLink).toBeVisible();
      hotelId = hotelIdFromEditHref(await editLink.getAttribute('href'));

      const editSheet = await openSheet(page, editLink, 'Edit hotel');
      const price = editSheet.getByLabel('Price per night', { exact: true });
      await expect(price).toHaveValue('150');
      await price.fill('200');
      await editSheet.getByRole('button', { name: 'Save changes' }).click();
      await expect(page.getByTestId('directory-status')).toHaveText('Hotel saved.');
      await expect(editSheet).toBeHidden();

      const visibilitySheet = await openSheet(page, editLink, 'Edit hotel');
      const visibility = visibilitySheet.getByRole('switch', { name: 'Visible on the public site' });
      await expect(visibility).toHaveAttribute('aria-checked', 'true');
      await visibility.click();
      await expect(visibility).toHaveAttribute('aria-checked', 'false');
      await expect(visibilitySheet.getByTestId('hotel-visibility-status')).toHaveText('Visibility saved.');
      await expect.poll(() => publicHotelNames(request, name)).toEqual([]);

      await visibility.click();
      await expect(visibility).toHaveAttribute('aria-checked', 'true');
      await expect(visibilitySheet.getByTestId('hotel-visibility-status')).toHaveText('Visibility saved.');
      await expect.poll(() => publicHotelNames(request, name)).toEqual([name]);
      await visibilitySheet.getByRole('button', { name: 'Close' }).click();
      await expect(visibilitySheet).toBeHidden();

      const { baseURL, viewport, deviceScaleFactor, isMobile, hasTouch } = testInfo.project.use;
      const visitorContext = await browser.newContext({ baseURL, viewport, deviceScaleFactor, isMobile, hasTouch });
      try {
        const visitor = await visitorContext.newPage();
        const visitorPassword = strongPassword();
        await visitor.goto('/account/register');
        await visitor.getByLabel('Email', { exact: true }).fill(`e2e-${suffix}@aurea.example`);
        await visitor.getByLabel('Password', { exact: true }).fill(visitorPassword);
        await visitor.getByLabel('Confirm password', { exact: true }).fill(visitorPassword);
        await visitor.getByRole('button', { name: 'Create account' }).click();
        await expect(visitor.getByTestId('account-menu-button')).toBeVisible();

        await visitor.goto(`/hotels/${hotelId}`);
        await expect(visitor.getByRole('heading', { level: 1 })).toHaveText(name);
        const ratingPanel = visitor.getByTestId('rating-panel');
        const summary = visitor.getByTestId('rating-summary');

        await ratingPanel.getByRole('radio', { name: '4 stars' }).click();
        await expect(ratingPanel.getByTestId('rating-status')).toHaveText('Thanks, your rating was saved.');
        await expect(summary).toContainText('4.00');
        await expect(summary).toContainText('1 rating');

        await ratingPanel.getByRole('radio', { name: '2 stars' }).click();
        await expect(ratingPanel.getByRole('radio', { name: '2 stars' })).toHaveAttribute('aria-checked', 'true');
        await expect(summary).toContainText('2.00');
        await expect(summary).toContainText('1 rating');

        await visitor.getByTestId('account-menu-button').click();
        await visitor.getByRole('button', { name: 'Sign out' }).click();
        await expect(visitor.getByTestId('header-sign-in')).toBeVisible();
      } finally {
        await visitorContext.close();
      }

      await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
      const deleteDialog = page.getByRole('dialog', { name: `Delete ${name}?` });
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: 'Cancel' }).click();
      await expect(deleteDialog).toBeHidden();

      await page.getByRole('button', { name: `Delete ${name}`, exact: true }).click();
      await expect(deleteDialog).toBeVisible();
      await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
      await expect(deleteDialog).toBeHidden();
      await expect(page.getByTestId('directory-status')).toHaveText('Hotel deleted.');

      const removed = await request.get(`/api/public/hotels/${hotelId}`);
      expect(removed.status()).toBe(404);
    } finally {
      const token = await adminToken(request, credentials);
      const leftover = hotelId ?? (await adminHotelIdNamed(request, token, name));
      if (leftover !== null) {
        await deleteHotel(request, token, leftover);
      }
    }
  });

  test('keeps the directory table overflow inside its wrapper at 768 px', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 });
    await signInToConsole(page);

    const wrapper = page.getByTestId('directory-table-scroll');
    await expect(page.getByTestId('directory-table')).toBeVisible();
    await expect(wrapper).toHaveCSS('overflow-x', 'auto');

    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, 'document horizontal overflow in px').toBeLessThanOrEqual(0);
  });

  test('opens the new hotel sheet with a scrollable body on a phone', { tag: '@mobile' }, async ({ page }) => {
    await signInToConsole(page);

    const sheet = await openSheet(page, page.getByRole('link', { name: 'New hotel' }), 'New hotel');
    const body = sheet.getByTestId('sheet-body');
    expect(await body.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

    await body.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
    await expect.poll(() => body.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
    await expect(sheet.getByRole('button', { name: 'Create hotel' })).toBeInViewport({ ratio: 1 });

    await sheet.getByRole('button', { name: 'Close' }).click();
    await expect(sheet).toBeHidden();
  });
});
