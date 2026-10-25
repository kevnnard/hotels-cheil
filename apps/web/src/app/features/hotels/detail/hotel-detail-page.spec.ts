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

  it('renders the title block with name, city and region, rating average and count', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({ ...full, address: { ...full.address, region: 'Costa' } });
    await settle();

    expect(query('h1')?.textContent).toContain('Aurea Palace');
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

  it('renders the photo as one full-width image', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    expect(root().querySelectorAll('img').length).toBe(1);
    expect(query('img')?.getAttribute('src')).toBe('/api/public/hotels/h1/image');
    expect(query('[data-testid="detail-photo"]')?.classList.contains('w-full')).toBe(true);
  });

  it('renders the description and the address facts', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    expect(query('[data-testid="hotel-description"]')?.textContent).toContain('A quiet place by the sea.');
    const facts = query('[data-testid="hotel-facts"]')?.textContent ?? '';
    for (const value of ['Calle 1', 'Lima', 'Peru', '15001']) {
      expect(facts).toContain(value);
    }
  });

  it('shows the contact values the API returned in the sticky contact card', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const card = query('[data-testid="contact-card"]') as HTMLElement;
    expect(card.classList.contains('sticky')).toBe(true);
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

  it('omits absent values and shows the placeholder when there is no image', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush({
      ...full,
      description: null,
      contact: { phone: null, email: null, website: null },
      address: { street: null, city: 'Lima', region: null, country: null, postalCode: null },
      rating: { sum: 0, count: 0, average: null },
      image: null,
    });
    await settle();

    expect(query('img')).toBeNull();
    const placeholder = query('[data-testid="detail-photo"] [data-testid="image-placeholder"]');
    expect(placeholder?.textContent?.trim()).toBe('No image available');
    expect(query('[data-testid="contact-card"]')).toBeNull();
    expect(query('[data-testid="hotel-description"]')).toBeNull();
    expect(query('[data-testid="rating-summary"]')).toBeNull();
    expect(query('[data-testid="detail-location"]')?.textContent?.trim()).toBe('Lima');
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

  it('shows no omitted element', async () => {
    await open('/hotels/h1');
    http.expectOne('/api/public/hotels/h1').flush(full);
    await settle();

    const text = root().textContent ?? '';
    for (const forbidden of ['Precio', 'Reservar', 'Calibrar', 'Categoría', 'Maison Privée', 'Suites', 'Amenidades', 'Newsletter', 'Price', 'Book', 'Reservation', 'Calibrate', 'Category', 'Amenities', 'Suite', '$', '€', 'ID:', 'Reseñas', 'Reviews']) {
      expect(text).not.toContain(forbidden);
    }
  });
});
