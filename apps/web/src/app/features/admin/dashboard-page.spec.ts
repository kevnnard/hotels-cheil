import { Component } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, TestRequest, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NavigationBehaviorOptions, provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Hotel, HotelPage } from '../hotels/data/hotel.models';
import { DashboardPage } from './dashboard-page';
import { AdminDirectoryRefresh } from './data/admin-directory-refresh';
import { installDialogStub, removeDialogStub } from './ui/dialog-test-support';

@Component({ template: '<p data-testid="sheet-stub">sheet</p>' })
class SheetStub {}

function hotel(overrides: Partial<Hotel> & { id: string; name: string }): Hotel {
  return {
    description: null,
    address: { street: null, city: 'Lima', region: null, country: 'Peru', postalCode: null },
    contact: { phone: null, email: null, website: null },
    isActive: true,
    createdAtUtc: '2026-10-01T00:00:00Z',
    updatedAtUtc: '2026-10-01T00:00:00Z',
    rating: { sum: 9, count: 2, average: 4.5 },
    image: null,
    images: [],
    pricing: null,
    ...overrides,
  };
}

function pageOf(items: Hotel[], page = 1, totalPages = 1): HotelPage {
  return { items, page, pageSize: 10, totalItems: items.length, totalPages };
}

const alpha = hotel({
  id: 'a',
  name: 'Alpha House',
  address: { street: null, city: 'Cusco', region: null, country: 'Peru', postalCode: null },
  rating: { sum: 9, count: 2, average: 4.5 },
  images: [{ position: 0, contentType: 'image/webp', width: 800, height: 600, sizeBytes: 1000 }],
  pricing: { currency: 'USD', nightlyRate: 400, discountPercent: 25, discountedNightlyRate: 300 },
});

const beta = hotel({
  id: 'b',
  name: 'Beta Lodge',
  isActive: false,
  rating: { sum: 0, count: 0, average: null },
});

describe('DashboardPage (hotel directory)', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;
  let navigations: { mock: { calls: unknown[][] }; mockClear(): void };
  let scrollIntoView: ReturnType<typeof vi.fn<Element['scrollIntoView']>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    installDialogStub();
    scrollIntoView = vi.fn<Element['scrollIntoView']>();
    Element.prototype.scrollIntoView = scrollIntoView;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          {
            path: 'admin',
            component: DashboardPage,
            children: [
              { path: 'hotels/new', component: SheetStub },
              { path: 'hotels/:id/edit', component: SheetStub },
            ],
          },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    navigations = vi.spyOn(router, 'navigateByUrl');
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    vi.useRealTimers();
    vi.restoreAllMocks();
    removeDialogStub();
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  const root = () => harness.routeNativeElement as HTMLElement;
  const find = <T extends HTMLElement = HTMLElement>(id: string) => root().querySelector<T>(`[data-testid="${id}"]`);
  const table = () => find('directory-table') as HTMLElement;
  const rows = () => Array.from(table().querySelectorAll<HTMLElement>('tbody tr'));
  const row = (name: string) => rows().find((item) => item.textContent?.includes(name)) as HTMLElement;
  const dialog = () => find<HTMLDialogElement>('delete-dialog') as HTMLDialogElement;

  async function settle() {
    await vi.advanceTimersByTimeAsync(0);
    harness.fixture.detectChanges();
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  async function open(url: string) {
    await harness.navigateByUrl(url);
    harness.fixture.detectChanges();
    TestBed.tick();
    navigations.mockClear();
  }

  function expectOnlyNonScrollingNavigations() {
    expect(navigations.mock.calls.length).toBeGreaterThan(0);
    for (const [, extras] of navigations.mock.calls) {
      expect((extras as NavigationBehaviorOptions | undefined)?.scroll).toBe('manual');
    }
  }

  function expectList(match: (param: (name: string) => string | null) => boolean = () => true): TestRequest {
    return http.expectOne((r) => r.method === 'GET' && r.url === '/api/hotels' && match((n) => r.params.get(n)));
  }

  async function openWith(page: HotelPage, url = '/admin') {
    await open(url);
    expectList().flush(page);
    await settle();
  }

  function type(input: HTMLInputElement, value: string) {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  async function startDelete(name: string) {
    (row(name).querySelector('[data-testid="row-delete"]') as HTMLButtonElement).click();
    await settle();
  }

  it('shows one Hotels heading, the New hotel link and a loading state while the first page is requested', async () => {
    await open('/admin');

    expect(root().querySelectorAll('h1').length).toBe(1);
    expect(root().querySelector('h1')?.textContent?.trim()).toBe('Hotels');
    const create = find<HTMLAnchorElement>('directory-new') as HTMLAnchorElement;
    expect(create.textContent?.trim()).toBe('New hotel');
    expect(create.getAttribute('href')).toBe('/admin/hotels/new');
    expect(create.className).toContain('min-h-11');
    expect(find('directory-loading')?.getAttribute('aria-busy')).toBe('true');
    expectList().flush(pageOf([]));
    await settle();
  });

  it('renders a row per hotel with thumbnail, name, city, location, rating, discounted price and status', async () => {
    await openWith(pageOf([alpha, beta]));

    expect(table().className).toContain('md:table');
    expect(Array.from(table().querySelectorAll('th')).map((cell) => cell.textContent?.trim())).toEqual([
      'Hotel',
      'Location',
      'Rating',
      'Price',
      'Status',
      'Actions',
    ]);
    const first = row('Alpha House');
    expect(first.querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/a/images/0');
    expect(first.querySelector('[data-testid="row-city"]')?.textContent?.trim()).toBe('Cusco');
    expect(first.querySelector('[data-testid="row-location"]')?.textContent?.trim()).toBe('Cusco, Peru');
    expect(first.querySelector('[data-testid="row-rating"]')?.textContent).toContain('4.50');
    expect(first.querySelector('[data-testid="row-rating"]')?.textContent).toContain('2 ratings');
    expect(first.querySelector('[data-testid="price-original"]')?.textContent).toContain('$400');
    expect(first.querySelector('[data-testid="price-current"]')?.textContent).toContain('$300');
    expect(first.querySelector('[data-testid="price-discount"]')?.textContent).toContain('-25%');
    expect(first.querySelector('[data-testid="row-status"]')?.textContent?.trim()).toBe('Active');

    const second = row('Beta Lodge');
    expect(second.querySelector('img')).toBeNull();
    expect(second.querySelector('[data-testid="image-placeholder"]')).not.toBeNull();
    expect(second.querySelector('[data-testid="row-rating"]')?.textContent?.trim()).toBe('No ratings');
    expect(second.querySelector('[data-testid="row-price"]')?.textContent?.trim()).toBe('No price');
    expect(second.querySelector('[data-testid="row-status"]')?.textContent?.trim()).toBe('Inactive');
  });

  it('marks an inactive hotel with a muted Inactive badge that says it is hidden from the public site', async () => {
    await openWith(pageOf([alpha, beta]));

    const active = row('Alpha House').querySelector('[data-testid="row-status"]') as HTMLElement;
    const inactive = row('Beta Lodge').querySelector('[data-testid="row-status"]') as HTMLElement;
    expect(active.dataset['state']).toBe('active');
    expect(active.getAttribute('title')).toBeNull();
    expect(inactive.dataset['state']).toBe('inactive');
    expect(inactive.className).toContain('text-on-surface-variant');
    expect(inactive.className).not.toContain('text-primary');
    expect(inactive.getAttribute('title')).toBe('Hidden from the public site');
    expect(inactive.textContent?.trim()).toBe('Inactive');
  });

  it('stacks the same hotels as cards below md', async () => {
    await openWith(pageOf([alpha, beta]));

    const cards = find('directory-cards') as HTMLElement;
    expect(cards.className).toContain('md:hidden');
    expect(cards.querySelectorAll('li').length).toBe(2);
    expect(cards.textContent).toContain('Alpha House');
    expect(cards.textContent).toContain('Inactive');
    expect(cards.querySelectorAll('[data-testid="row-edit"]').length).toBe(2);
    expect(cards.querySelectorAll('[data-testid="row-delete"]').length).toBe(2);
  });

  it('offers labelled Edit links and Delete buttons that are at least 44 px tall', async () => {
    await openWith(pageOf([alpha]), '/admin?name=alp');

    const edit = row('Alpha House').querySelector('[data-testid="row-edit"]') as HTMLAnchorElement;
    const remove = row('Alpha House').querySelector('[data-testid="row-delete"]') as HTMLButtonElement;
    expect(edit.getAttribute('href')).toBe('/admin/hotels/a/edit?name=alp');
    expect(edit.getAttribute('aria-label')).toBe('Edit Alpha House');
    expect(remove.getAttribute('aria-label')).toBe('Delete Alpha House');
    expect(edit.className).toContain('min-h-11');
    expect(remove.className).toContain('min-h-11');
  });

  it('requests the filters and the page found in the address and shows them in the toolbar', async () => {
    await open('/admin?name=sea&minRating=4.5&maxPrice=300&page=2');

    const request = expectList();
    expect(request.request.params.get('name')).toBe('sea');
    expect(request.request.params.get('minRating')).toBe('4.5');
    expect(request.request.params.get('maxPrice')).toBe('300');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    request.flush(pageOf([alpha], 2, 2));
    await settle();

    expect(find<HTMLInputElement>('directory-search')?.value).toBe('sea');
    expect(find<HTMLSelectElement>('directory-rating')?.value).toBe('4.5');
    expect(find<HTMLInputElement>('directory-max-price')?.value).toBe('300');
  });

  it('labels every toolbar control', async () => {
    await openWith(pageOf([alpha]));

    for (const id of ['directory-search', 'directory-rating', 'directory-max-price']) {
      const control = find(id) as HTMLElement;
      expect(root().querySelector(`label[for="${control.id}"]`)?.textContent?.trim()).toBeTruthy();
    }
  });

  it('writes the search to the address only after the debounce and resets the page', async () => {
    await openWith(pageOf([alpha], 2, 3), '/admin?page=2');

    type(find<HTMLInputElement>('directory-search') as HTMLInputElement, 'alp');
    await vi.advanceTimersByTimeAsync(299);
    expect(router.url).toBe('/admin?page=2');

    await vi.advanceTimersByTimeAsync(1);
    await settle();
    expect(router.url).toBe('/admin?name=alp');
    expectList((param) => param('name') === 'alp' && param('page') === '1').flush(pageOf([alpha]));
    await settle();
  });

  it('applies the minimum rating at once and resets the page', async () => {
    await openWith(pageOf([alpha], 2, 3), '/admin?page=2');

    const select = find<HTMLSelectElement>('directory-rating') as HTMLSelectElement;
    select.value = '4';
    select.dispatchEvent(new Event('change'));
    await settle();

    expect(router.url).toBe('/admin?minRating=4');
    expectList((param) => param('minRating') === '4').flush(pageOf([alpha]));
    await settle();
  });

  it('writes a positive maximum price after the debounce and drops an empty one', async () => {
    await openWith(pageOf([alpha]));

    const input = find<HTMLInputElement>('directory-max-price') as HTMLInputElement;
    type(input, '250');
    await vi.advanceTimersByTimeAsync(300);
    await settle();
    expect(router.url).toBe('/admin?maxPrice=250');
    expectList((param) => param('maxPrice') === '250').flush(pageOf([alpha]));
    await settle();

    type(input, '');
    await vi.advanceTimersByTimeAsync(300);
    await settle();
    expect(router.url).toBe('/admin');
    expectList((param) => param('maxPrice') === null).flush(pageOf([alpha]));
    await settle();
  });

  it('resets every filter and the page together', async () => {
    await openWith(pageOf([alpha], 2, 2), '/admin?name=sea&minRating=4&maxPrice=300&page=2');

    find('directory-reset')?.click();
    await settle();

    expect(router.url).toBe('/admin');
    expectList((param) => param('name') === null && param('minRating') === null && param('maxPrice') === null).flush(
      pageOf([alpha]),
    );
    await settle();
    expect(find<HTMLInputElement>('directory-search')?.value).toBe('');
    expect(find<HTMLSelectElement>('directory-rating')?.value).toBe('');
    expect(find<HTMLInputElement>('directory-max-price')?.value).toBe('');
  });

  it('explains an empty filtered result and offers to reset', async () => {
    await openWith(pageOf([]), '/admin?name=zzz');

    const empty = find('directory-empty') as HTMLElement;
    expect(empty.textContent).toContain('No hotels match these filters.');
    find('directory-empty-reset')?.click();
    await settle();

    expect(router.url).toBe('/admin');
    expectList().flush(pageOf([]));
    await settle();
  });

  it('shows an error with a retry that requests the page again', async () => {
    await open('/admin');
    expectList().flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(find('directory-error')?.textContent).toContain('We could not load the hotels');
    find('directory-retry')?.click();
    await settle();
    expectList().flush(pageOf([alpha]));
    await settle();

    expect(find('directory-error')).toBeNull();
    expect(row('Alpha House')).toBeTruthy();
  });

  it('moves the page through the pagination keeping the previous rows visible and without scrolling', async () => {
    await openWith(pageOf([alpha], 1, 3));

    find('pagination-next')?.click();
    await settle();

    expect(router.url).toBe('/admin?page=2');
    const request = expectList((param) => param('page') === '2');
    expect(find('directory-results')?.getAttribute('aria-busy')).toBe('true');
    expect(row('Alpha House')).toBeTruthy();
    request.flush(pageOf([beta], 2, 3));
    await settle();

    expect(find('directory-results')?.getAttribute('aria-busy')).toBe('false');
    expect(row('Beta Lodge')).toBeTruthy();
    expectOnlyNonScrollingNavigations();
    expect(scrollIntoView).not.toHaveBeenCalled();

    find('pagination-previous')?.click();
    await settle();
    expect(router.url).toBe('/admin');
    expectList((param) => param('page') === '1').flush(pageOf([alpha], 1, 3));
    await settle();
  });

  it('opens the create and edit routes over the directory keeping the filters and without reloading the list', async () => {
    await openWith(pageOf([alpha]), '/admin?name=alp');

    find('directory-new')?.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }));
    await settle();
    expect(router.url).toBe('/admin/hotels/new?name=alp');
    expect(find('sheet-stub')).not.toBeNull();
    expect(row('Alpha House')).toBeTruthy();

    expectOnlyNonScrollingNavigations();
    await harness.navigateByUrl('/admin?name=alp');
    await settle();
    navigations.mockClear();
    (row('Alpha House').querySelector('[data-testid="row-edit"]') as HTMLAnchorElement).dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, button: 0 }),
    );
    await settle();
    expect(router.url).toBe('/admin/hotels/a/edit?name=alp');
    expect(row('Alpha House')).toBeTruthy();
    expectOnlyNonScrollingNavigations();
    http.expectNone((r) => r.url === '/api/hotels');
  });

  it('leaves a modified click on a link to the browser', async () => {
    await openWith(pageOf([alpha]));

    const click = new MouseEvent('click', { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
    find('directory-new')?.dispatchEvent(click);
    await settle();

    expect(click.defaultPrevented).toBe(false);
    expect(router.url).toBe('/admin');
  });

  it('reloads the current page and announces a change made in the sheet without a full reload', async () => {
    await openWith(pageOf([alpha], 2, 2), '/admin?name=a&page=2');

    TestBed.inject(AdminDirectoryRefresh).announce('Hotel saved.');
    await settle();

    const status = find('directory-status') as HTMLElement;
    expect(status.getAttribute('role')).toBe('status');
    expect(status.textContent?.trim()).toBe('Hotel saved.');
    expect(find('directory-results')?.getAttribute('aria-busy')).toBe('true');
    expectList((param) => param('page') === '2' && param('name') === 'a').flush(pageOf([alpha, beta], 2, 2));
    await settle();
    expect(rows().length).toBe(2);

    TestBed.inject(AdminDirectoryRefresh).announce('Hotel created.');
    await settle();
    expect(find('directory-status')?.textContent?.trim()).toBe('Hotel created.');
    expectList().flush(pageOf([alpha, beta], 2, 2));
    await settle();
  });

  it('reloads the current page after a quiet change without announcing anything', async () => {
    await openWith(pageOf([alpha]), '/admin?name=a');

    TestBed.inject(AdminDirectoryRefresh).announce();
    await settle();

    expect(find('directory-status')?.textContent?.trim()).toBe('');
    expectList((param) => param('name') === 'a').flush(pageOf([{ ...alpha, rating: { sum: 14, count: 3, average: 4.67 } }]));
    await settle();
    expect(row('Alpha House').textContent).toContain('4.67');
    expect(row('Alpha House').textContent).toContain('3 ratings');
    expect(find('directory-status')?.textContent?.trim()).toBe('');
  });

  it('keeps the last announcement when a quiet change follows it', async () => {
    await openWith(pageOf([alpha]));
    TestBed.inject(AdminDirectoryRefresh).announce('Hotel saved.');
    await settle();
    expectList().flush(pageOf([alpha]));
    await settle();

    TestBed.inject(AdminDirectoryRefresh).announce();
    await settle();
    expectList().flush(pageOf([alpha]));
    await settle();

    expect(find('directory-status')?.textContent?.trim()).toBe('Hotel saved.');
  });

  it('ignores a change announced before the directory was opened', async () => {
    TestBed.inject(AdminDirectoryRefresh).announce('Hotel saved.');

    await openWith(pageOf([alpha]));

    expect(find('directory-status')?.textContent?.trim()).toBe('');
  });

  describe('delete', () => {
    it('asks for confirmation in a modal dialog that names the hotel', async () => {
      await openWith(pageOf([alpha, beta]));

      await startDelete('Alpha House');

      const box = dialog();
      expect(box.hasAttribute('open')).toBe(true);
      expect(box.getAttribute('data-modal')).toBe('true');
      const title = root().querySelector(`#${box.getAttribute('aria-labelledby')}`);
      const description = root().querySelector(`#${box.getAttribute('aria-describedby')}`);
      expect(title?.textContent).toContain('Delete Alpha House?');
      expect(description?.textContent).toContain('Alpha House');
      expect(find('delete-cancel')?.textContent?.trim()).toBe('Cancel');
      expect(find('delete-confirm')?.textContent?.trim()).toBe('Delete');
    });

    it('cancels without a request and returns focus to the row action', async () => {
      await openWith(pageOf([alpha, beta]));
      const action = row('Alpha House').querySelector('[data-testid="row-delete"]') as HTMLButtonElement;
      action.focus();

      await startDelete('Alpha House');
      find('delete-cancel')?.click();
      await settle();

      expect(dialog().hasAttribute('open')).toBe(false);
      expect(document.activeElement).toBe(action);
      http.expectNone((r) => r.method === 'DELETE');
    });

    it('cancels with Escape without a request', async () => {
      await openWith(pageOf([alpha, beta]));
      const action = row('Alpha House').querySelector('[data-testid="row-delete"]') as HTMLButtonElement;
      action.focus();

      await startDelete('Alpha House');
      const cancel = new Event('cancel', { cancelable: true });
      dialog().dispatchEvent(cancel);
      await settle();

      expect(dialog().hasAttribute('open')).toBe(false);
      expect(document.activeElement).toBe(action);
      http.expectNone((r) => r.method === 'DELETE');
    });

    it('deletes, announces the result and reloads the current page', async () => {
      await openWith(pageOf([alpha, beta]));

      await startDelete('Alpha House');
      find('delete-confirm')?.click();
      await settle();
      const request = http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/hotels/a');
      expect((find('delete-confirm') as HTMLButtonElement).disabled).toBe(true);
      const blockedEscape = new Event('cancel', { cancelable: true });
      dialog().dispatchEvent(blockedEscape);
      expect(blockedEscape.defaultPrevented).toBe(true);
      expect(dialog().hasAttribute('open')).toBe(true);
      request.flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(dialog().hasAttribute('open')).toBe(false);
      const status = find('directory-status') as HTMLElement;
      expect(status.getAttribute('role')).toBe('status');
      expect(status.textContent?.trim()).toBe('Hotel deleted.');
      expect(document.activeElement).toBe(root().querySelector('h1'));
      expectList((param) => param('page') === '1').flush(pageOf([beta]));
      await settle();
      expect(rows().length).toBe(1);
    });

    it('treats a 404 as already deleted', async () => {
      await openWith(pageOf([alpha, beta]));

      await startDelete('Alpha House');
      find('delete-confirm')?.click();
      await settle();
      http.expectOne((r) => r.method === 'DELETE').flush({ title: 'The hotel does not exist.' }, { status: 404, statusText: 'Not Found' });
      await settle();

      expect(dialog().hasAttribute('open')).toBe(false);
      expect(find('directory-status')?.textContent?.trim()).toBe('Hotel deleted.');
      expectList().flush(pageOf([beta]));
      await settle();
    });

    it('keeps the dialog open with an error when the delete fails', async () => {
      await openWith(pageOf([alpha, beta]));

      await startDelete('Alpha House');
      find('delete-confirm')?.click();
      await settle();
      http.expectOne((r) => r.method === 'DELETE').flush(null, { status: 500, statusText: 'Server Error' });
      await settle();

      expect(dialog().hasAttribute('open')).toBe(true);
      const error = find('delete-error') as HTMLElement;
      expect(error.getAttribute('role')).toBe('alert');
      expect(error.textContent).toContain('We could not delete this hotel. Try again.');
      expect((find('delete-confirm') as HTMLButtonElement).disabled).toBe(false);
      expect(find('directory-status')?.textContent?.trim()).toBe('');
      http.expectNone((r) => r.url === '/api/hotels');

      find('delete-cancel')?.click();
      await settle();
      await startDelete('Alpha House');
      expect(find('delete-error')?.textContent?.trim()).toBe('');
    });

    it('steps back one page after deleting the only hotel of the last page', async () => {
      await openWith(pageOf([beta], 2, 2), '/admin?name=e&page=2');

      await startDelete('Beta Lodge');
      find('delete-confirm')?.click();
      await settle();
      http.expectOne((r) => r.method === 'DELETE' && r.url === '/api/hotels/b').flush(null, { status: 204, statusText: 'No Content' });
      await settle();

      expect(router.url).toBe('/admin?name=e');
      expectList((param) => param('page') === '1' && param('name') === 'e').flush(pageOf([alpha], 1, 1));
      await settle();
      expect(find('directory-status')?.textContent?.trim()).toBe('Hotel deleted.');
    });
  });
});
