import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Hotel, HotelPage } from '../data/hotel.models';
import { CatalogPage } from './catalog-page';

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
    ...overrides,
  };
}

function pageOf(items: Hotel[], page = 1, totalPages = 1): HotelPage {
  return { items, page, pageSize: 8, totalItems: items.length, totalPages };
}

describe('CatalogPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let router: Router;
  let scrollIntoView: ReturnType<typeof vi.fn<Element['scrollIntoView']>>;

  beforeEach(async () => {
    vi.useFakeTimers();
    scrollIntoView = vi.fn<Element['scrollIntoView']>();
    Element.prototype.scrollIntoView = scrollIntoView;
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([{ path: '', component: CatalogPage }]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    vi.useRealTimers();
    Reflect.deleteProperty(Element.prototype, 'scrollIntoView');
  });

  const root = () => harness.routeNativeElement as HTMLElement;
  const query = (selector: string) => root().querySelector<HTMLElement>(selector);

  async function open(url: string) {
    await harness.navigateByUrl(url);
    harness.fixture.detectChanges();
    TestBed.tick();
  }

  async function settle() {
    await vi.advanceTimersByTimeAsync(0);
    harness.fixture.detectChanges();
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  function expectList(match: (params: (name: string) => string | null) => boolean = () => true) {
    return http.expectOne((r) => r.url === '/api/public/hotels' && match((n) => r.params.get(n)));
  }

  const withImage = { contentType: 'image/webp', width: 800, height: 600, sizeBytes: 120000 };

  it('shows the loading state while the page is requested', async () => {
    await open('/');

    expect(query('[data-testid="catalog-loading"]')).not.toBeNull();
    expectList().flush(pageOf([]));
  });

  it('renders the hero heading and eyebrow', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    expect(query('h1')?.textContent?.trim()).toBe('Architecture of Silence');
    expect(query('[data-testid="hero-eyebrow"]')?.textContent?.trim()).toBe('AUREA Collection');
    expect(root().textContent).toContain('Registered sanctuaries');
  });

  it('features the first hotel of the page in the hero with a View details link', async () => {
    await open('/');
    expectList().flush(
      pageOf([
        hotel({ id: 'a', name: 'Alpha', description: 'Quiet rooms', image: withImage }),
        hotel({ id: 'b', name: 'Beta' }),
      ]),
    );
    await settle();

    const featured = query('[data-testid="featured-hotel"]') as HTMLElement;
    expect(featured.textContent).toContain('Alpha');
    expect(featured.textContent).toContain('Quiet rooms');
    expect(featured.querySelector('img')?.getAttribute('src')).toBe('/api/public/hotels/a/image');
    const action = featured.querySelector('a');
    expect(action?.textContent).toContain('View details');
    expect(action?.getAttribute('href')).toBe('/hotels/a');
  });

  it('moves the hero between the hotels of the page', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' }), hotel({ id: 'b', name: 'Beta', description: 'Second' })]));
    await settle();

    query('[data-testid="featured-next"]')?.click();
    await settle();

    const featured = query('[data-testid="featured-hotel"]') as HTMLElement;
    expect(featured.textContent).toContain('Beta');
    expect(featured.querySelector('a')?.getAttribute('href')).toBe('/hotels/b');
  });

  it('keeps the hero stage with the placeholder when the featured hotel has no image', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })]));
    await settle();

    const featured = query('[data-testid="featured-hotel"]');
    expect(featured?.querySelector('[data-testid="image-placeholder"]')?.textContent?.trim()).toBe('No image available');
  });

  it('renders no hero stage when there are no hotels', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    expect(query('[data-testid="featured-hotel"]')).toBeNull();
  });

  it('renders no promotions band and no offer text', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    expect(root().querySelector('app-promotions-band')).toBeNull();
    expect(root().textContent).not.toContain('Current offers');
    expect(root().textContent).not.toContain('Test offer');
    expect(query('[data-testid="promotion-action"]')).toBeNull();
  });

  it('renders the manifesto section once, after the grid and at the end of the page', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    const sections = root().querySelectorAll('app-manifesto-section');
    expect(sections.length).toBe(1);
    expect(sections[0].querySelector('h2')?.textContent).toContain('Discover.');
    const collection = query('#collection') as HTMLElement;
    expect(collection.compareDocumentPosition(sections[0]) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(collection.contains(sections[0])).toBe(false);
    const main = query('[data-testid="public-home"]') as HTMLElement;
    expect(main.lastElementChild).toBe(sections[0]);
  });

  it('labels the search panel as the jump target of the header search', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    expect(query('[data-testid="search-panel"]')?.id).toBe('search-panel');
  });

  it('renders a card per hotel with rating badge, location, title, description and Explore link', async () => {
    await open('/');
    expectList().flush(
      pageOf([
        hotel({ id: 'a', name: 'Alpha', description: 'Calm and quiet', rating: { sum: 9, count: 2, average: 4.5 } }),
        hotel({ id: 'b', name: 'Beta', address: { street: null, city: 'Cusco', region: null, country: 'Peru', postalCode: null } }),
      ]),
    );
    await settle();

    const cards = root().querySelectorAll('[data-testid="hotel-card"]');
    expect(cards.length).toBe(2);
    expect(cards[0].querySelector('h3')?.textContent).toContain('Alpha');
    expect(cards[0].querySelector('[data-testid="card-rating"]')?.textContent?.trim()).toBe('4.50');
    expect(cards[0].querySelector('[data-testid="card-location"]')?.textContent).toContain('Lima, Peru');
    expect(cards[0].querySelector('[data-testid="card-description"]')?.textContent).toContain('Calm and quiet');
    expect(cards[0].querySelector('[data-testid="card-description"]')?.classList.contains('line-clamp-2')).toBe(true);
    const explore = cards[0].querySelector('a[data-testid="card-explore"]');
    expect(explore?.textContent).toContain('Explore');
    expect(explore?.getAttribute('href')).toBe('/hotels/a');
    expect(cards[1].querySelector('[data-testid="card-location"]')?.textContent).toContain('Cusco, Peru');
    expect(query('[data-testid="catalog-loading"]')).toBeNull();
  });

  it('shows no rating badge and no description for a hotel without them', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha', rating: { sum: 0, count: 0, average: null } })]));
    await settle();

    const card = query('[data-testid="hotel-card"]');
    expect(card?.querySelector('[data-testid="card-rating"]')).toBeNull();
    expect(card?.querySelector('[data-testid="card-description"]')).toBeNull();
    expect(card?.textContent).not.toContain('0.0');
  });

  it('shows the placeholder panel with the aspect ratio of the photo slot for a hotel without image', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })]));
    await settle();

    const placeholder = query('[data-testid="hotel-card"] [data-testid="image-placeholder"]');
    expect(placeholder?.textContent?.trim()).toBe('No image available');
    expect(placeholder?.closest('.aspect-4\\/3')).not.toBeNull();
  });

  it('shows the photo of a hotel with an image inside the same slot', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha', image: withImage })]));
    await settle();

    const image = query('[data-testid="hotel-card"] img');
    expect(image?.getAttribute('src')).toBe('/api/public/hotels/a/image');
    expect(image?.closest('.aspect-4\\/3')).not.toBeNull();
  });

  it('shows the empty state with guidance when no hotel matches', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    const empty = query('[data-testid="catalog-empty"]');
    expect(empty?.textContent).toContain('No hotels found');
    expect(empty?.textContent).toContain('Try another name');
    expect(root().querySelectorAll('[data-testid="hotel-card"]').length).toBe(0);
  });

  it('shows the error state and retries the same request', async () => {
    await open('/?name=sea');
    expectList().flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    const error = query('[data-testid="catalog-error"]');
    expect(error).not.toBeNull();
    expect(error?.textContent).toContain('We could not load the hotels');
    expect(query('[data-testid="catalog-retry"]')?.textContent?.trim()).toBe('Try again');

    query('[data-testid="catalog-retry"]')?.click();
    await settle();

    const retried = expectList((p) => p('name') === 'sea');
    retried.flush(pageOf([hotel({ id: 'a', name: 'Alpha' })]));
    await settle();

    expect(query('[data-testid="catalog-error"]')).toBeNull();
    expect(root().querySelectorAll('[data-testid="hotel-card"]').length).toBe(1);
  });

  it('labels the search by name', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    expect(query('label[for="hotel-search"]')?.textContent?.trim()).toBe('Search by name');
  });

  it('keeps every advanced filter out of the request, the address and the results', async () => {
    await open('/?name=sea&minRating=4.9');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })]));
    await settle();

    (query('[data-testid="more-filters"]') as HTMLElement).click();
    await settle();

    const destination = query('[data-testid="filter-destination"]') as HTMLInputElement;
    expect(destination.disabled).toBe(false);
    destination.value = 'Lima';
    destination.dispatchEvent(new Event('input'));
    const price = query('[data-testid="filter-price"]') as HTMLInputElement;
    expect(price.disabled).toBe(false);
    price.value = '80';
    price.dispatchEvent(new Event('input'));
    for (const control of Array.from(root().querySelectorAll<HTMLElement>('#advanced-filters button, #advanced-filters input[type="checkbox"]'))) {
      control.click();
    }
    await vi.advanceTimersByTimeAsync(1000);
    await settle();

    http.expectNone((r) => r.url === '/api/public/hotels');
    expect(router.url).toBe('/?name=sea&minRating=4.9');
    expect(root().querySelectorAll('[data-testid="hotel-card"]').length).toBe(1);
  });

  it('shows the Not available yet label for the advanced fields', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    expect(root().querySelectorAll('[data-testid="unavailable-note"]').length).toBe(5);
    expect(query('[data-testid="more-filters"]')?.getAttribute('aria-controls')).toBe('advanced-filters');
  });

  it('keeps only the compact bar sticky, never the advanced panel', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    expect(query('[data-testid="search-panel"]')?.classList.contains('md:sticky')).toBe(true);
    expect(query('#advanced-filters')?.closest('[class*="sticky"]')).toBeNull();
    expect((query('#advanced-filters') as HTMLElement).hidden).toBe(true);
  });

  it('reads name, rating and page from the address', async () => {
    await open('/?name=sea&minRating=4.95&page=2');

    const request = expectList();
    expect(request.request.params.get('name')).toBe('sea');
    expect(request.request.params.get('minRating')).toBe('4.95');
    expect(request.request.params.get('page')).toBe('2');
    request.flush(pageOf([], 2, 3));
    await settle();

    expect((query('[data-testid="search-input"]') as HTMLInputElement).value).toBe('sea');
    expect(query('[data-testid="rating-4.95"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('falls back to the first page and all ratings for invalid query values', async () => {
    await open('/?minRating=0&page=-3');

    const request = expectList();
    expect(request.request.params.has('minRating')).toBe(false);
    expect(request.request.params.get('page')).toBe('1');
    request.flush(pageOf([]));
  });

  it('reflects the typed search in the address after the debounce and resets the page', async () => {
    await open('/?page=3');
    expectList().flush(pageOf([], 3, 4));
    await settle();

    const input = query('[data-testid="search-input"]') as HTMLInputElement;
    input.value = 'palace';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(100);
    http.expectNone((r) => r.url === '/api/public/hotels');
    await vi.advanceTimersByTimeAsync(300);
    await settle();

    expect(router.url).toBe('/?name=palace');
    const request = expectList((p) => p('name') === 'palace');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(pageOf([]));
  });

  it('offers All, 4.90+, 4.95+ and 5.0 as rating options', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    const labels = Array.from(root().querySelectorAll('[data-testid^="rating-"]')).map((b) => b.textContent?.trim());
    expect(labels).toEqual(['All', '4.90+', '4.95+', '5.0 ★']);
    expect(query('[data-testid="rating-all"]')?.getAttribute('aria-pressed')).toBe('true');
  });

  it('requests minRating=4.9 exactly when 4.90+ is chosen and resets the page', async () => {
    await open('/?page=2');
    expectList().flush(pageOf([], 2, 3));
    await settle();

    query('[data-testid="rating-4.9"]')?.click();
    await settle();

    expect(router.url).toBe('/?minRating=4.9');
    const request = expectList((p) => p('minRating') === '4.9');
    expect(request.request.params.get('page')).toBe('1');
    request.flush(pageOf([]));
    await settle();

    expect(query('[data-testid="rating-4.9"]')?.getAttribute('aria-pressed')).toBe('true');
    expect(query('[data-testid="rating-all"]')?.getAttribute('aria-pressed')).toBe('false');
  });

  it('requests minRating=5 when 5.0 is chosen', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    query('[data-testid="rating-5"]')?.click();
    await settle();

    expectList((p) => p('minRating') === '5').flush(pageOf([]));
  });

  it('omits minRating when All is chosen', async () => {
    await open('/?minRating=4.95');
    expectList().flush(pageOf([]));
    await settle();

    query('[data-testid="rating-all"]')?.click();
    await settle();

    expect(router.url).toBe('/');
    const request = expectList();
    expect(request.request.params.has('minRating')).toBe(false);
    request.flush(pageOf([]));
  });

  it('clears the name and the rating with the clear action', async () => {
    await open('/?name=sea&minRating=4.9&page=2');
    expectList().flush(pageOf([], 2, 3));
    await settle();

    query('[data-testid="clear-filters"]')?.click();
    await settle();

    expect(router.url).toBe('/');
    const request = expectList();
    expect(request.request.params.has('name')).toBe(false);
    expect(request.request.params.has('minRating')).toBe(false);
    expect(request.request.params.get('page')).toBe('1');
    request.flush(pageOf([]));
    await settle();

    expect((query('[data-testid="search-input"]') as HTMLInputElement).value).toBe('');
  });

  it('moves between pages with the pagination controls', async () => {
    await open('/?name=sea');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })], 1, 3));
    await settle();

    expect((query('[data-testid="pagination-previous"]') as HTMLButtonElement).disabled).toBe(true);
    query('[data-testid="pagination-next"]')?.click();
    await settle();

    expect(router.url).toBe('/?name=sea&page=2');
    const request = expectList((p) => p('page') === '2');
    expect(request.request.params.get('name')).toBe('sea');
    request.flush(pageOf([hotel({ id: 'b', name: 'Beta' })], 2, 3));
    await settle();

    expect((query('[data-testid="pagination-previous"]') as HTMLButtonElement).disabled).toBe(false);
    expect((query('[data-testid="pagination-next"]') as HTMLButtonElement).disabled).toBe(false);
  });

  function spyOnNavigation() {
    return vi.spyOn(router, 'navigate');
  }

  it('keeps the viewport in place when the rating filter changes', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })], 1, 2));
    await settle();
    const navigate = spyOnNavigation();

    query('[data-testid="rating-4.9"]')?.click();
    await settle();

    expect(router.url).toBe('/?minRating=4.9');
    expect(navigate.mock.calls[0][1]?.scroll).toBe('manual');
    expect(scrollIntoView).not.toHaveBeenCalled();
    expectList((p) => p('minRating') === '4.9').flush(pageOf([]));
  });

  it('keeps the viewport in place when the name search changes', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })], 1, 2));
    await settle();
    const navigate = spyOnNavigation();

    const input = query('[data-testid="search-input"]') as HTMLInputElement;
    input.value = 'palace';
    input.dispatchEvent(new Event('input'));
    await vi.advanceTimersByTimeAsync(300);
    await settle();

    expect(router.url).toBe('/?name=palace');
    expect(navigate.mock.calls[0][1]?.scroll).toBe('manual');
    expect(scrollIntoView).not.toHaveBeenCalled();
    expectList((p) => p('name') === 'palace').flush(pageOf([]));
  });

  it('keeps the previous hotels visible and marks the results busy while the next page loads', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })], 1, 3));
    await settle();

    expect(query('[data-testid="catalog-results"]')?.getAttribute('aria-busy')).toBe('false');
    query('[data-testid="pagination-next"]')?.click();
    await settle();

    const request = expectList((p) => p('page') === '2');
    expect(query('[data-testid="catalog-loading"]')).toBeNull();
    expect(query('[data-testid="catalog-results"]')?.getAttribute('aria-busy')).toBe('true');
    expect(query('[data-testid="hotel-card"]')?.textContent).toContain('Alpha');

    request.flush(pageOf([hotel({ id: 'b', name: 'Beta' })], 2, 3));
    await settle();

    expect(query('[data-testid="catalog-results"]')?.getAttribute('aria-busy')).toBe('false');
    expect(query('[data-testid="hotel-card"]')?.textContent).toContain('Beta');
  });

  it('brings the collection into view on a page change instead of scrolling to the top', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })], 1, 3));
    await settle();
    const navigate = spyOnNavigation();

    query('[data-testid="pagination-next"]')?.click();
    await settle();

    expect(router.url).toBe('/?page=2');
    expect(navigate.mock.calls[0][1]?.scroll).toBe('manual');
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(query('#collection'));
    expectList((p) => p('page') === '2').flush(pageOf([hotel({ id: 'b', name: 'Beta' })], 2, 3));
  });

  it('shows no omitted element', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha', description: 'Calm', image: withImage })]));
    await settle();

    const text = root().textContent ?? '';
    for (const forbidden of ['Precio', 'Reservar', 'Calibrar', 'Categoría', 'Maison Privée', 'Suites', 'Amenidades', 'Newsletter', 'Book', 'Reservation', 'Calibrate', 'Suite', '$', '€', 'EUR', 'ID:']) {
      expect(text).not.toContain(forbidden);
    }
  });

  it('lays the card grid out in one column, two from 640px and four from 1024px', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })]));
    await settle();

    const grid = query('#collection ul.grid') as HTMLElement;
    expect(grid.classList.contains('grid-cols-1')).toBe(true);
    expect(grid.classList.contains('sm:grid-cols-2')).toBe(true);
    expect(grid.classList.contains('lg:grid-cols-4')).toBe(true);
    expect(grid.classList.contains('md:grid-cols-2')).toBe(false);
  });

  it('lays the loading placeholders out like the card grid', async () => {
    await open('/');

    const grid = query('[data-testid="catalog-loading"]') as HTMLElement;
    expect(grid.classList.contains('grid-cols-1')).toBe(true);
    expect(grid.classList.contains('sm:grid-cols-2')).toBe(true);
    expect(grid.classList.contains('lg:grid-cols-4')).toBe(true);
    expectList().flush(pageOf([]));
  });

  it('keeps the rating segments inside a 44px control and gives Reset a 44px target', async () => {
    await open('/?minRating=4.9');
    expectList().flush(pageOf([]));
    await settle();

    const group = query('[role="group"][aria-label="Minimum rating"]') as HTMLElement;
    expect(group.classList.contains('h-11')).toBe(true);
    const options = Array.from(group.querySelectorAll<HTMLElement>('[data-testid^="rating-"]'));
    expect(options.length).toBe(4);
    expect(query('[data-testid="clear-filters"]')?.classList.contains('h-11')).toBe(true);
  });

  it('renders Reset only while a name or a rating is applied', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    expect(query('[data-testid="clear-filters"]')).toBeNull();

    query('[data-testid="rating-4.95"]')?.click();
    await settle();
    expectList((p) => p('minRating') === '4.95').flush(pageOf([]));
    await settle();

    expect(query('[data-testid="clear-filters"]')?.textContent?.trim()).toBe('Reset');
  });

  it('hides Reset again after clearing a name-only search', async () => {
    await open('/?name=sea');
    expectList().flush(pageOf([]));
    await settle();

    expect(query('[data-testid="clear-filters"]')).not.toBeNull();
    query('[data-testid="clear-filters"]')?.click();
    await settle();
    expectList().flush(pageOf([]));
    await settle();

    expect(router.url).toBe('/');
    expect((query('[data-testid="search-input"]') as HTMLInputElement).value).toBe('');
    expect(query('[data-testid="clear-filters"]')).toBeNull();
  });

  it('sticks the search panel only from the medium breakpoint and offsets anchors by the header height', async () => {
    await open('/');
    expectList().flush(pageOf([]));
    await settle();

    const panel = query('[data-testid="search-panel"]') as HTMLElement;
    expect(panel.classList.contains('sticky')).toBe(false);
    expect(panel.classList.contains('md:top-(--header-height)')).toBe(true);
    expect(panel.classList.contains('scroll-mt-(--header-height)')).toBe(true);
    expect(query('#collection')?.classList.contains('scroll-mt-(--header-height)')).toBe(true);
  });

  it('gives the card action a touch target of at least 44px', async () => {
    await open('/');
    expectList().flush(pageOf([hotel({ id: 'a', name: 'Alpha' })]));
    await settle();

    expect(query('[data-testid="card-explore"]')?.classList.contains('min-h-11')).toBe(true);
  });

  it('gives the featured stage actions a touch target of at least 44px and keeps the controls above the copy on mobile', async () => {
    await open('/');
    expectList().flush(
      pageOf([hotel({ id: 'a', name: 'Alpha', description: 'Calm' }), hotel({ id: 'b', name: 'Beta' })]),
    );
    await settle();

    const stage = query('[data-testid="featured-hotel"]') as HTMLElement;
    expect(stage.querySelector('a')?.classList.contains('min-h-11')).toBe(true);
    const controls = (query('[data-testid="featured-next"]') as HTMLElement).parentElement as HTMLElement;
    expect(controls.classList.contains('top-space-md')).toBe(true);
    expect(controls.classList.contains('md:bottom-space-xl')).toBe(true);
    expect(controls.classList.contains('bottom-space-md')).toBe(false);
  });
});
