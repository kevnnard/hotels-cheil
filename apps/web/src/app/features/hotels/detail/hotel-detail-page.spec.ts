import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { Hotel } from '../data/hotel.models';
import { HotelDetailPage } from './hotel-detail-page';

const full: Hotel = {
  id: 'h1',
  name: 'Aurea Palace',
  description: 'A quiet place by the sea.',
  address: { street: 'Calle 1', city: 'Lima', region: 'Lima', country: 'Peru', postalCode: '15001' },
  contact: { phone: '+51 1 555 0100', email: 'stay@example.com', website: 'https://example.com' },
  isActive: true,
  createdAtUtc: '2026-10-01T00:00:00Z',
  updatedAtUtc: '2026-10-02T00:00:00Z',
  rating: { sum: 14, count: 3, average: 4.67 },
  image: { contentType: 'image/webp', width: 800, height: 600, sizeBytes: 120000 },
  images: [
    { position: 0, contentType: 'image/webp', width: 800, height: 600, sizeBytes: 120000 },
    { position: 1, contentType: 'image/webp', width: 800, height: 600, sizeBytes: 110000 },
    { position: 2, contentType: 'image/webp', width: 800, height: 600, sizeBytes: 100000 },
  ],
  pricing: { currency: 'USD', nightlyRate: 200, discountPercent: null, discountedNightlyRate: null },
};

describe('HotelDetailPage', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;

  beforeEach(async () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([
          { path: '', component: HotelDetailPage },
          { path: 'hotels/:id', component: HotelDetailPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    harness = await RouterTestingHarness.create();
  });

  const root = () => harness.routeNativeElement as HTMLElement;
  const query = (selector: string) => root().querySelector<HTMLElement>(selector);

  async function open(url: string) {
    await harness.navigateByUrl(url);
    harness.fixture.detectChanges();
    TestBed.tick();
  }

  async function settle() {
    await Promise.resolve();
    harness.fixture.detectChanges();
    TestBed.tick();
    harness.fixture.detectChanges();
  }

  it('shows the loading state while the hotel is requested', async () => {
    await open('/hotels/h1');

    expect(query('[data-testid="detail-loading"]')).not.toBeNull();
    http.expectOne('/api/public/hotels/h1').flush(full);
  });

  it('renders the contextual bar with the return link', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const back = query('[data-testid="back-to-catalog"]');
    expect(back?.textContent?.trim()).toBe('Back to the collection');
    expect(back?.getAttribute('href')).toBe('/');
  });

  it('renders the breadcrumb with the collection link, the country and the hotel name', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const crumbs = query('nav[aria-label="Breadcrumb"]') as HTMLElement;
    const items = [...crumbs.querySelectorAll('li')].map((item) => item.textContent?.trim());
    expect(items).toEqual(['Collection', 'Peru', 'Aurea Palace']);
    expect(crumbs.querySelector('a')?.getAttribute('href')).toBe('/#collection');
    expect(crumbs.querySelectorAll('a').length).toBe(1);
    expect(crumbs.querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('Aurea Palace');
  });

  it('leaves the country out of the breadcrumb when the address has none', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, address: { ...full.address, country: null } });
    await settle();

    const items = [...(query('nav[aria-label="Breadcrumb"]') as HTMLElement).querySelectorAll('li')].map((item) => item.textContent?.trim());
    expect(items).toEqual(['Collection', 'Aurea Palace']);
  });

  it('renders the title block with name, city and region, rating average and count', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, address: { ...full.address, region: 'Costa' } });
    await settle();

    expect(root().querySelectorAll('h1').length).toBe(1);
    expect(query('h1')?.textContent).toContain('Aurea Palace');
    expect(query('h1')?.classList).toContain('font-serif');
    expect(query('[data-testid="detail-location"]')?.textContent?.trim()).toBe('Lima • Costa');
    expect(query('[data-testid="rating-summary"]')?.textContent).toContain('4.67');
    expect(query('[data-testid="rating-summary"]')?.textContent).toContain('3 ratings');
  });

  it('uses the singular for a single rating', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, rating: { sum: 5, count: 1, average: 5 } });
    await settle();

    expect(query('[data-testid="rating-summary"]')?.textContent).toContain('1 rating');
    expect(query('[data-testid="rating-summary"]')?.textContent).not.toContain('1 ratings');
  });

  it('renders the photo mosaic from the image positions with the gallery button', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const mosaic = query('[data-testid="gallery-mosaic"]') as HTMLElement;
    const sources = [...mosaic.querySelectorAll('img')].map((image) => image.getAttribute('src'));
    expect(sources).toEqual(['/api/public/hotels/h1/images/0', '/api/public/hotels/h1/images/1', '/api/public/hotels/h1/images/2']);
    expect(query('[data-testid="gallery-count"]')?.textContent?.trim()).toBe('3');
  });

  it('renders the description under a heading with the hotel name and the real facts', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    expect(query('[data-testid="hotel-narrative"] h2')?.textContent?.trim()).toBe('About Aurea Palace');
    expect(query('[data-testid="hotel-description"]')?.textContent).toContain('A quiet place by the sea.');
    const facts = query('[data-testid="hotel-facts"]') as HTMLElement;
    expect(facts.classList).toContain('grid-cols-2');
    expect(facts.classList).toContain('sm:grid-cols-4');
    const pairs = [...facts.querySelectorAll('div')].map((fact) => [fact.querySelector('dt')?.textContent?.trim(), fact.querySelector('dd')?.textContent?.trim()]);
    expect(pairs).toEqual([
      ['Location', 'Lima'],
      ['Country', 'Peru'],
      ['Postal code', '15001'],
      ['Phone', '+51 1 555 0100'],
    ]);
  });

  it('shows the website as the last fact when the hotel has no phone', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, contact: { ...full.contact, phone: null } });
    await settle();

    const labels = [...(query('[data-testid="hotel-facts"]') as HTMLElement).querySelectorAll('dt')].map((label) => label.textContent?.trim());
    expect(labels).toEqual(['Location', 'Country', 'Postal code', 'Website']);
  });

  it('renders the generic quote, the suites, the amenities and the location block', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const quote = query('[data-testid="detail-quote"]') as HTMLElement;
    expect(quote.querySelector('blockquote')?.textContent?.trim().length).toBeGreaterThan(0);
    expect(quote.textContent).toContain('Lead architect');
    expect(quote.querySelector('svg[aria-hidden="true"]')).not.toBeNull();
    expect(root().querySelectorAll('[role="tab"]').length).toBe(3);
    const amenities = query('[data-testid="amenities"]') as HTMLElement;
    expect(amenities.querySelectorAll('[data-testid="amenity"]').length).toBe(6);
    expect(amenities.querySelector('ul')?.classList).toContain('md:grid-cols-3');
    const location = query('[data-testid="detail-address"]') as HTMLElement;
    expect([...location.querySelectorAll('[data-testid="address-line"]')].map((line) => line.textContent?.trim())).toEqual([
      'Calle 1',
      'Lima, Lima 15001',
      'Peru',
    ]);
    expect(location.querySelector('svg')).not.toBeNull();
  });

  it('keeps the headings in order with a single main title', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const levels = [...root().querySelectorAll('h1, h2, h3, h4, h5, h6')].map((heading) => Number(heading.tagName[1]));
    expect(levels.filter((level) => level === 1).length).toBe(1);
    expect(levels[0]).toBe(1);
    for (let index = 1; index < levels.length; index++) {
      expect(levels[index] - levels[index - 1]).toBeLessThanOrEqual(1);
    }
  });

  it('shows the sample manager card with initials and no photo', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const manager = query('[data-testid="manager-card"]') as HTMLElement;
    expect(manager.textContent).toContain('Alex Morgan');
    expect(manager.textContent).toContain('General Manager');
    expect(manager.querySelector('[data-testid="manager-initials"]')?.textContent?.trim()).toBe('AM');
    expect(manager.querySelector('img')).toBeNull();
  });

  it('shows the contact values the API returned in the sticky contact card', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const card = query('[data-testid="contact-card"]') as HTMLElement;
    expect(card.closest('[data-testid="detail-aside"]')?.classList.contains('lg:sticky')).toBe(true);
    expect(card.querySelector('[data-testid="contact-phone"]')?.textContent).toContain('+51 1 555 0100');
    expect(card.querySelector('[data-testid="contact-email"]')?.textContent).toContain('stay@example.com');
    expect(card.querySelector('[data-testid="contact-website"]')?.textContent).toContain('https://example.com');
    expect(card.querySelector('[data-testid="contact-phone"]')?.getAttribute('href')).toBe('tel:+51 1 555 0100');
    expect(card.querySelector('[data-testid="contact-email"]')?.getAttribute('href')).toBe('mailto:stay@example.com');
    expect(card.querySelector('[data-testid="contact-website"]')?.getAttribute('href')).toBe('https://example.com');
  });

  it('shows only the contact values that exist', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, contact: { phone: null, email: 'stay@example.com', website: null } });
    await settle();

    expect(query('[data-testid="contact-email"]')).not.toBeNull();
    expect(query('[data-testid="contact-phone"]')).toBeNull();
    expect(query('[data-testid="contact-website"]')).toBeNull();
  });

  it('does not link a website that is not http or https', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, contact: { phone: null, email: null, website: 'javascript:alert(1)' } });
    await settle();

    expect(query('[data-testid="contact-website"]')?.getAttribute('href')).toBeNull();
  });

  it('omits absent values and shows the placeholders when there is no image', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({
      ...full,
      description: null,
      contact: { phone: null, email: null, website: null },
      address: { street: null, city: 'Lima', region: null, country: null, postalCode: null },
      rating: { sum: 0, count: 0, average: null },
      image: null,
      images: [],
    });
    await settle();

    expect(query('img')).toBeNull();
    const placeholders = root().querySelectorAll('[data-testid="gallery-mosaic"] [data-testid="image-placeholder"]');
    expect(placeholders.length).toBe(3);
    expect(placeholders[0].textContent?.trim()).toBe('No image available');
    expect(query('[data-testid="gallery-view-all"]')).toBeNull();
    expect(query('[data-testid="contact-card"]')).toBeNull();
    expect(query('[data-testid="hotel-description"]')).toBeNull();
    expect(query('[data-testid="rating-summary"]')).toBeNull();
    expect(query('[data-testid="detail-location"]')?.textContent?.trim()).toBe('Lima');
    const labels = [...(query('[data-testid="hotel-facts"]') as HTMLElement).querySelectorAll('dt')].map((label) => label.textContent?.trim());
    expect(labels).toEqual(['Location']);
    expect([...root().querySelectorAll('[data-testid="address-line"]')].map((line) => line.textContent?.trim())).toEqual(['Lima']);
  });

  it('shows the not found state on a 404', async () => {
    await open('/hotels/missing');
    http.expectOne('/api/public/hotels/missing').flush({}, { status: 404, statusText: 'Not Found' });
    await settle();

    const notFound = query('[data-testid="detail-not-found"]');
    expect(notFound?.textContent).toContain('Hotel not found');
    expect(query('[data-testid="detail-error"]')).toBeNull();
    expect(query('[data-testid="back-to-catalog"]')).not.toBeNull();
  });

  it('shows the error state with a retry on other failures', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush('boom', { status: 500, statusText: 'Server Error' });
    await settle();

    expect(query('[data-testid="detail-error"]')?.textContent).toContain('We could not load this hotel');
    expect(query('[data-testid="detail-retry"]')?.textContent?.trim()).toBe('Try again');
    expect(query('[data-testid="detail-not-found"]')).toBeNull();

    query('[data-testid="detail-retry"]')?.click();
    await settle();
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    expect(query('h1')?.textContent).toContain('Aurea Palace');
  });

  it('shows no omitted claim and loads no remote asset', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const text = root().textContent ?? '';
    for (const forbidden of ['Maison Privée', 'remaining', 'Remaining', 'Real-time', 'availability', 'Availability', 'certified', 'Certified', '24 photos', 'Book', 'Reserv', 'reserv', '€', 'ID:', 'Reseñas', 'Reviews']) {
      expect(text).not.toContain(forbidden);
    }
    for (const element of root().querySelectorAll('[src], [srcset], [style]')) {
      expect(element.getAttribute('src') ?? '').not.toMatch(/^(https?:)?\/\//);
      expect(element.getAttribute('srcset') ?? '').not.toMatch(/https?:/);
      expect(element.getAttribute('style') ?? '').not.toMatch(/url\(/);
    }
  });

  const text = (element: Element | null | undefined) => element?.textContent?.replace(/\s+/g, ' ').trim();

  it('shows the nightly price in the sticky column above the contact card', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const price = query('[data-testid="detail-price"]') as HTMLElement;
    expect(text(price.querySelector('[data-testid="price-current"]'))).toBe('$200');
    expect(text(price)).toContain('$200 per night');
    expect(price.querySelector('s')).toBeNull();
    expect(price.querySelector('[data-testid="price-discount"]')).toBeNull();
    const aside = query('[data-testid="detail-aside"]') as HTMLElement;
    for (const name of ['lg:sticky', 'lg:top-28', 'lg:col-span-4']) {
      expect(aside.classList).toContain(name);
    }
    expect(query('[data-testid="detail-content"]')?.classList).toContain('lg:col-span-8');
    expect(aside.contains(price)).toBe(true);
    const contact = query('[data-testid="contact-card"]') as Node;
    const manager = query('[data-testid="manager-card"]') as Node;
    expect(price.compareDocumentPosition(contact) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(contact.compareDocumentPosition(manager) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(aside.contains(manager)).toBe(true);
  });

  it('shows the struck-through original, the discounted price and the badge when the hotel has a discount', async () => {
    await open('/hotels/h1');
    http
      .expectOne('/api/public/hotels/h1')
      .flush({ ...full, pricing: { currency: 'USD', nightlyRate: 199.99, discountPercent: 15, discountedNightlyRate: 169.99 } });
    await settle();

    const price = query('[data-testid="detail-price"]') as HTMLElement;
    expect(text(price.querySelector('s[data-testid="price-original"]'))).toBe('Original price $199.99');
    expect(text(price.querySelector('[data-testid="price-current"]'))).toBe('Discounted price $169.99');
    expect(text(price.querySelector('[data-testid="price-discount"]'))).toBe('-15%');
    expect(text(price)).toContain('per night');
  });

  it('keeps the price column when the hotel has a price but no contact values', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, contact: { phone: null, email: null, website: null } });
    await settle();

    expect(query('[data-testid="detail-price"]')).not.toBeNull();
    expect(query('[data-testid="contact-card"]')).toBeNull();
  });

  it('shows the price on request and no total when the hotel has no pricing', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, pricing: null });
    await settle();

    expect(query('[data-testid="detail-price"]')).toBeNull();
    expect(query('[data-testid="price-on-request"]')?.textContent?.trim()).toBe('Price on request');
    expect(query('[data-testid="estimated-total"]')).toBeNull();
    expect(query('[data-testid="contact-card"]')).not.toBeNull();
    expect(root().textContent).not.toContain('per night');
    expect(root().textContent).not.toContain('$');
  });

  it('estimates the total from the discounted price and keeps the request buttons inert', async () => {
    await open('/hotels/h1');
    http
      .expectOne('/api/public/hotels/h1')
      .flush({ ...full, pricing: { currency: 'USD', nightlyRate: 240, discountPercent: 15, discountedNightlyRate: 204 } });
    await settle();

    expect(text(query('[data-testid="estimated-total"]'))).toBe('$612');
    query('[data-testid="request-dossier"]')?.click();
    harness.fixture.detectChanges();

    expect(text(query('[data-testid="reservation-feedback"]'))).toBe('Demo only: nothing was sent.');
    http.verify();
    const price = query('[data-testid="detail-price"]') as HTMLElement;
    expect(price.querySelectorAll('button, a').length).toBe(0);
  });
});
