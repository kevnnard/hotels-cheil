import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { AuthState } from '../../../core/auth/auth-state.service';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { Hotel, HotelImage, HotelPage } from '../../hotels/data/hotel.models';
import { HotelRequest } from './admin-hotel.models';
import { AdminHotelsService } from './admin-hotels.service';

const hotel: Hotel = {
  id: '3f0c1d9e-0000-4000-8000-000000000001',
  name: 'Aurea Hidden',
  description: null,
  address: { street: null, city: 'Lima', region: null, country: 'Peru', postalCode: null },
  contact: { phone: null, email: null, website: null },
  isActive: false,
  createdAtUtc: '2026-10-01T00:00:00Z',
  updatedAtUtc: '2026-10-01T00:00:00Z',
  rating: { sum: 0, count: 0, average: null },
  image: null,
  images: [],
  pricing: null,
};

describe('AdminHotelsService', () => {
  let service: AdminHotelsService;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AdminHotelsService);
    http = TestBed.inject(HttpTestingController);
    TestBed.inject(AuthState).signIn({
      accessToken: 'admin-token',
      email: 'admin@example.com',
      roles: ['Administrator'],
      expiresAtUtc: '2999-01-01T00:00:00Z',
    });
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('lists through the administrative route with the controller parameter names and the bearer token', () => {
    let received: HotelPage | undefined;
    service
      .list({ name: '  sea  ', minRating: 4.5, maxPrice: 300, page: 2, pageSize: 10 })
      .subscribe((value) => (received = value));

    const request = http.expectOne((r) => r.url === '/api/hotels');
    expect(request.request.method).toBe('GET');
    expect(request.request.params.keys().sort()).toEqual(['maxPrice', 'minRating', 'name', 'page', 'pageSize']);
    expect(request.request.params.get('name')).toBe('sea');
    expect(request.request.params.get('minRating')).toBe('4.5');
    expect(request.request.params.get('maxPrice')).toBe('300');
    expect(request.request.params.get('page')).toBe('2');
    expect(request.request.params.get('pageSize')).toBe('10');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    const page: HotelPage = { items: [hotel], page: 2, pageSize: 10, totalItems: 11, totalPages: 2 };
    request.flush(page);

    expect(received?.items[0].isActive).toBe(false);
  });

  it('omits the name, rating and price limit when they are unset', () => {
    service.list({ name: '   ', minRating: null, maxPrice: null, page: 1, pageSize: 10 }).subscribe();

    const request = http.expectOne((r) => r.url === '/api/hotels');
    expect(request.request.params.keys().sort()).toEqual(['page', 'pageSize']);
    request.flush({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
  });

  it('gets one hotel through the administrative route', () => {
    let received: Hotel | undefined;
    service.get(hotel.id).subscribe((value) => (received = value));

    const request = http.expectOne(`/api/hotels/${hotel.id}`);
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-token');
    request.flush(hotel);

    expect(received?.name).toBe('Aurea Hidden');
  });

  it('deletes one hotel through the administrative route', () => {
    let completed = false;
    service.delete(hotel.id).subscribe({ complete: () => (completed = true) });

    const request = http.expectOne(`/api/hotels/${hotel.id}`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  const request: HotelRequest = {
    name: 'Aurea Cliff',
    description: null,
    street: null,
    city: 'Positano',
    region: null,
    country: 'Italy',
    postalCode: null,
    phone: null,
    email: null,
    website: null,
    pricePerNight: 250,
    discountPercent: 20,
  };

  it('creates a hotel with a POST of the full request body', () => {
    let received: Hotel | undefined;
    service.create(request).subscribe((value) => (received = value));

    const call = http.expectOne('/api/hotels');
    expect(call.request.method).toBe('POST');
    expect(call.request.body).toEqual(request);
    expect(call.request.headers.get('Authorization')).toBe('Bearer admin-token');
    call.flush({ ...hotel, name: 'Aurea Cliff' }, { status: 201, statusText: 'Created' });

    expect(received?.name).toBe('Aurea Cliff');
  });

  it('replaces a hotel with a PUT of the full request body', () => {
    let received: Hotel | undefined;
    service.update(hotel.id, request).subscribe((value) => (received = value));

    const call = http.expectOne(`/api/hotels/${hotel.id}`);
    expect(call.request.method).toBe('PUT');
    expect(call.request.body).toEqual(request);
    call.flush({ ...hotel, name: 'Aurea Cliff' });

    expect(received?.name).toBe('Aurea Cliff');
  });

  it('uploads an image as the multipart field image to its position', () => {
    const file = new File(['pixels'], 'cliff.webp', { type: 'image/webp' });
    let received: HotelImage | undefined;
    service.uploadImage(hotel.id, 2, file).subscribe((value) => (received = value));

    const call = http.expectOne(`/api/hotels/${hotel.id}/images/2`);
    expect(call.request.method).toBe('PUT');
    const body = call.request.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect([...body.keys()]).toEqual(['image']);
    expect((body.get('image') as File).name).toBe('cliff.webp');
    expect(call.request.headers.get('Authorization')).toBe('Bearer admin-token');
    call.flush({ contentType: 'image/webp', width: 800, height: 600, sizeBytes: 1000 });

    expect(received?.contentType).toBe('image/webp');
  });

  it('removes the image of a position with a DELETE', () => {
    let completed = false;
    service.deleteImage(hotel.id, 1).subscribe({ complete: () => (completed = true) });

    const call = http.expectOne(`/api/hotels/${hotel.id}/images/1`);
    expect(call.request.method).toBe('DELETE');
    call.flush(null, { status: 204, statusText: 'No Content' });

    expect(completed).toBe(true);
  });

  it('passes a failed delete to the caller', () => {
    let failure: unknown;
    service.delete(hotel.id).subscribe({ error: (error: unknown) => (failure = error) });

    http.expectOne(`/api/hotels/${hotel.id}`).flush(null, { status: 404, statusText: 'Not Found' });

    expect(failure).toBeInstanceOf(HttpErrorResponse);
    expect((failure as HttpErrorResponse).status).toBe(404);
  });
});
