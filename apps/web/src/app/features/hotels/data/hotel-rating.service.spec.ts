import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { describeRatingFailure } from './hotel-rating-failure';
import { HotelRatingService } from './hotel-rating.service';

const hotelId = '3f2b8a52-6f3d-4c55-9a59-2d1f0f8c1a01';

describe('HotelRatingService', () => {
  let service: HotelRatingService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HotelRatingService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts the integer score and returns the new summary', async () => {
    const result = firstValueFrom(service.rate(hotelId, 4));

    const request = http.expectOne(`/api/hotels/${hotelId}/ratings`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({ score: 4 });
    request.flush({ sum: 9, count: 2, average: 4.5 });

    expect(await result).toEqual({ sum: 9, count: 2, average: 4.5 });
  });

  it.each([
    [{ score: 3 }, 3],
    [{ score: null }, null],
  ])('reads the own score from %j', async (answer, expected) => {
    const result = firstValueFrom(service.ownScore(hotelId));

    const request = http.expectOne(`/api/hotels/${hotelId}/ratings/me`);
    expect(request.request.method).toBe('GET');
    request.flush(answer);

    expect(await result).toBe(expected);
  });

  it('encodes the hotel identifier in the address', () => {
    service.ownScore('a/b').subscribe();

    http.expectOne('/api/hotels/a%2Fb/ratings/me').flush({ score: null });
  });
});

describe('describeRatingFailure', () => {
  it.each([
    [400, 'The rating must be between 1 and 5.'],
    [401, 'Your session has expired. Sign in again.'],
    [403, 'You do not have permission to rate.'],
    [404, 'This hotel no longer exists.'],
    [0, 'Could not save your rating. Try again.'],
    [500, 'Could not save your rating. Try again.'],
  ])('maps the status %s', (status, message) => {
    expect(describeRatingFailure(new HttpErrorResponse({ status }))).toBe(message);
  });

  it('maps an unknown failure to the retry message', () => {
    expect(describeRatingFailure(new Error('boom'))).toBe('Could not save your rating. Try again.');
  });
});
