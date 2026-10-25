import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { HotelCatalogService } from './hotel-catalog.service';
import { Hotel, HotelPage } from './hotel.models';

const hotel: Hotel = {
  id: '3f0c1d9e-0000-4000-8000-000000000001',
  name: 'Aurea Test',
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
};

const page: HotelPage = { items: [hotel], page: 2, pageSize: 6, totalItems: 7, totalPages: 2 };

describe('HotelCatalogService', () => {
  let service: HotelCatalogService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HotelCatalogService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests the public list with name, minimum rating, page and page size', () => {
    let received: HotelPage | undefined;
    service.list({ name: 'sea', minRating: 4, page: 2, pageSize: 6 }).subscribe((value) => (received = value));

    const request = http.expectOne((r) => r.url === '/api/public/hotels');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('name')).toBe('sea');
    expect(request.request.params.get('minRating')).toBe('4');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('6');
    request.flush(page);

    expect(received).toEqual(page);
  });

  it('omits the name and the minimum rating when they are unset', () => {
    service.list({ name: '', minRating: null, page: 1, pageSize: 12 }).subscribe();

    const request = http.expectOne((r) => r.url === '/api/public/hotels');
    expect(request.request.params.has('name')).toBe(false);
    expect(request.request.params.has('minRating')).toBe(false);
    expect(request.request.params.get('page')).toBe('1');
    expect(request.request.params.get('pageSize')).toBe('12');
    request.flush(page);
  });

  it('sends the maximum price when it is set', () => {
    service.list({ name: '', minRating: null, maxPrice: 300, page: 1, pageSize: 8 }).subscribe();

    const request = http.expectOne((r) => r.url === '/api/public/hotels');
    expect(request.request.params.get('maxPrice')).toBe('300');
    request.flush(page);
  });

  it('sends a decimal maximum price exactly', () => {
    service.list({ name: '', minRating: null, maxPrice: 199.99, page: 1, pageSize: 8 }).subscribe();

    const request = http.expectOne((r) => r.url === '/api/public/hotels');
    expect(request.request.params.get('maxPrice')).toBe('199.99');
    request.flush(page);
  });

  it('omits the maximum price when it is null or absent', () => {
    service.list({ name: '', minRating: null, maxPrice: null, page: 1, pageSize: 8 }).subscribe();
    service.list({ name: '', minRating: null, page: 1, pageSize: 8 }).subscribe();

    const requests = http.match((r) => r.url === '/api/public/hotels');
    expect(requests.length).toBe(2);
    for (const request of requests) {
      expect(request.request.params.has('maxPrice')).toBe(false);
      request.flush(page);
    }
  });

  it('trims the name before sending it', () => {
    service.list({ name: '  sea  ', minRating: null, page: 1, pageSize: 12 }).subscribe();

    const request = http.expectOne((r) => r.url === '/api/public/hotels');
    expect(request.request.params.get('name')).toBe('sea');
    request.flush(page);
  });

  it('requests one hotel by identifier', () => {
    let received: Hotel | undefined;
    service.get(hotel.id).subscribe((value) => (received = value));

    const request = http.expectOne(`/api/public/hotels/${hotel.id}`);
    expect(request.request.method).toBe('GET');
    request.flush(hotel);

    expect(received).toEqual(hotel);
  });

  it('builds the public image address of a hotel', () => {
    expect(service.imageUrl(hotel.id)).toBe(`/api/public/hotels/${hotel.id}/image`);
  });

  it('builds the public address of the image stored at a given position', () => {
    expect(service.imagePositionUrl(hotel.id, 0)).toBe(`/api/public/hotels/${hotel.id}/images/0`);
    expect(service.imagePositionUrl(hotel.id, 2)).toBe(`/api/public/hotels/${hotel.id}/images/2`);
  });

  it('keeps the explicit positions of a sparse image list', () => {
    let received: Hotel | undefined;
    service.get(hotel.id).subscribe((value) => (received = value));

    http.expectOne(`/api/public/hotels/${hotel.id}`).flush({
      ...hotel,
      images: [
        { position: 0, contentType: 'image/jpeg', width: 900, height: 600, sizeBytes: 1000 },
        { position: 2, contentType: 'image/webp', width: 800, height: 500, sizeBytes: 2000 },
      ],
    });

    expect(received?.images.map((image) => image.position)).toEqual([0, 2]);
    expect(received?.images[1].contentType).toBe('image/webp');
  });
});
