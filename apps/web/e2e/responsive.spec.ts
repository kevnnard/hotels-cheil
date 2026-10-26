import { APIRequestContext, Locator, Page, expect, test } from '@playwright/test';
import { firstPublicHotelId } from './helpers/api';

const minimumTarget = 44;
const subpixelTolerance = 0.01;

type TargetKind = 'button' | 'link';

interface TouchTarget {
  readonly label: string;
  readonly kind: TargetKind;
  readonly find: (page: Page) => Locator;
}

interface AuditedRoute {
  readonly name: string;
  readonly path: (request: APIRequestContext) => Promise<string>;
  readonly hasPublicHeader: boolean;
  readonly ready: (page: Page) => Promise<void>;
  readonly targets: readonly TouchTarget[];
}

function publicHeader(page: Page): Locator {
  return page.locator('[data-testid="public-layout"] > header');
}

const headerTargets: readonly TouchTarget[] = [
  { label: 'brand link', kind: 'link', find: (page) => page.getByTestId('brand-link') },
  { label: 'Home link', kind: 'link', find: (page) => publicHeader(page).getByRole('link', { name: 'Home', exact: true }) },
  { label: 'Hotel Collection link', kind: 'link', find: (page) => publicHeader(page).getByRole('link', { name: 'Hotel Collection' }) },
  { label: 'Sign in link', kind: 'link', find: (page) => page.getByTestId('header-sign-in') },
  { label: 'search icon link', kind: 'button', find: (page) => page.getByTestId('header-search') },
  { label: 'Explore Hotels link', kind: 'link', find: (page) => publicHeader(page).getByRole('link', { name: 'Explore Hotels' }) },
];

function passwordToggle(): TouchTarget {
  return { label: 'first password toggle', kind: 'button', find: (page) => page.getByRole('button', { name: 'Show password' }).first() };
}

const ratingSegments: readonly TouchTarget[] = ['All', '3.0+', '3.5+', '4.0+', '4.5+', '4.9+'].map((name) => ({
  label: `rating segment ${name}`,
  kind: 'button' as const,
  find: (page: Page) => page.getByRole('group', { name: 'Minimum rating' }).getByRole('button', { name, exact: true }),
}));

const routes: readonly AuditedRoute[] = [
  {
    name: 'catalogue',
    path: async () => '/',
    hasPublicHeader: true,
    ready: async (page) => {
      await expect(page.getByTestId('catalog-results').getByTestId('hotel-card').first()).toBeVisible();
    },
    targets: [
      ...headerTargets,
      ...ratingSegments,
      { label: 'Filters button', kind: 'button', find: (page) => page.getByTestId('more-filters') },
      { label: 'Previous page button', kind: 'button', find: (page) => page.getByTestId('pagination-previous') },
      { label: 'Next page button', kind: 'button', find: (page) => page.getByTestId('pagination-next') },
    ],
  },
  {
    name: 'hotel detail',
    path: async (request) => `/hotels/${await firstPublicHotelId(request)}`,
    hasPublicHeader: true,
    ready: async (page) => {
      await expect(page.getByTestId('rating-panel-anonymous')).toBeVisible();
    },
    targets: [
      ...headerTargets,
      { label: 'Back to the collection link', kind: 'link', find: (page) => page.getByTestId('back-to-catalog') },
      { label: 'rating Sign in link', kind: 'link', find: (page) => page.getByTestId('rating-sign-in') },
      { label: 'rating Create an account link', kind: 'link', find: (page) => page.getByTestId('rating-register') },
    ],
  },
  {
    name: 'visitor sign in',
    path: async () => '/account/sign-in',
    hasPublicHeader: true,
    ready: async (page) => {
      await expect(page.getByTestId('sign-in-submit')).toBeVisible();
    },
    targets: [
      ...headerTargets,
      passwordToggle(),
      { label: 'Sign in submit button', kind: 'button', find: (page) => page.getByTestId('sign-in-submit') },
    ],
  },
  {
    name: 'visitor registration',
    path: async () => '/account/register',
    hasPublicHeader: true,
    ready: async (page) => {
      await expect(page.getByTestId('register-submit')).toBeVisible();
    },
    targets: [
      ...headerTargets,
      passwordToggle(),
      { label: 'Create account submit button', kind: 'button', find: (page) => page.getByTestId('register-submit') },
    ],
  },
  {
    name: 'administrator login',
    path: async () => '/admin/login',
    hasPublicHeader: false,
    ready: async (page) => {
      await expect(page.getByTestId('login-submit')).toBeVisible();
    },
    targets: [
      { label: 'password toggle', kind: 'button', find: (page) => page.getByTestId('login-toggle-password') },
      { label: 'Sign in submit button', kind: 'button', find: (page) => page.getByTestId('login-submit') },
    ],
  },
];

async function horizontalOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
}

async function expectTouchTarget(page: Page, target: TouchTarget): Promise<void> {
  const element = target.find(page);
  await expect(element, `${target.label} is visible`).toBeVisible();
  const box = await element.boundingBox();
  expect(box, `${target.label} has a layout box`).not.toBeNull();
  if (box === null) {
    return;
  }
  expect.soft(box.height + subpixelTolerance, `${target.label} height`).toBeGreaterThanOrEqual(minimumTarget);
  if (target.kind === 'button') {
    expect.soft(box.width + subpixelTolerance, `${target.label} width`).toBeGreaterThanOrEqual(minimumTarget);
  }
}

test.describe('responsive layout', () => {
  for (const route of routes) {
    test(`${route.name} fits the viewport`, async ({ page, request }, testInfo) => {
      await page.goto(await route.path(request));
      await route.ready(page);

      expect(await horizontalOverflow(page), 'document horizontal overflow in px').toBeLessThanOrEqual(0);

      const headings = page.getByRole('heading', { level: 1 });
      await expect(headings).toHaveCount(1);

      if (route.hasPublicHeader) {
        const header = await publicHeader(page).boundingBox();
        const firstHeading = await page.locator('main').locator('h1, h2, h3').first().boundingBox();
        expect(header).not.toBeNull();
        expect(firstHeading).not.toBeNull();
        if (header !== null && firstHeading !== null) {
          expect(firstHeading.y, 'first heading top against the header bottom').toBeGreaterThanOrEqual(header.y + header.height);
        }
      }

      if (testInfo.project.use.hasTouch) {
        for (const target of route.targets) {
          await expectTouchTarget(page, target);
        }
      }
    });
  }

  test('signed-out header fits a 320 px screen', async ({ page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    for (const path of ['/', '/account/sign-in']) {
      await page.goto(path);
      await expect(page.getByTestId('header-sign-in')).toBeVisible();
      await expect(page.getByTestId('header-sign-in')).toBeInViewport({ ratio: 1 });
      await expect(publicHeader(page).getByRole('link', { name: 'Explore Hotels' })).toBeInViewport({ ratio: 1 });
      expect(await horizontalOverflow(page), `${path} horizontal overflow at 320 px`).toBeLessThanOrEqual(0);
    }
  });
});
