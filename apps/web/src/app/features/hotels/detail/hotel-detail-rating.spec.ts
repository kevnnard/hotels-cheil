import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting, TestRequest } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthState } from '../../../core/auth/auth-state.service';
import { Session } from '../../../core/auth/session';
import { authInterceptor } from '../../../core/http/auth.interceptor';
import { Hotel, HotelRating } from '../data/hotel.models';
import { HotelDetailPage } from './hotel-detail-page';

@Component({ template: '<p>account</p>' })
class AccountPage {}

const hotel: Hotel = {
  id: 'h1',
  name: 'Aurea Palace',
  description: 'A quiet place by the sea.',
  address: { street: 'Calle 1', city: 'Lima', region: 'Lima', country: 'Peru', postalCode: '15001' },
  contact: { phone: null, email: null, website: null },
  isActive: true,
  createdAtUtc: '2026-10-01T00:00:00Z',
  updatedAtUtc: '2026-10-02T00:00:00Z',
  rating: { sum: 14, count: 3, average: 4.67 },
  image: null,
  images: [],
  pricing: null,
};

const token = 'eyJ.rating-visitor-token.value';

const user: Session = {
  accessToken: token,
  email: 'guest@example.com',
  roles: ['User'],
  expiresAtUtc: '2999-01-01T00:00:00Z',
};

const administrator: Session = { ...user, email: 'admin@example.com', roles: ['Administrator'] };

describe('HotelDetailPage rating panel', () => {
  let http: HttpTestingController;
  let harness: RouterTestingHarness;
  let state: AuthState;
  let router: Router;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'hotels/:id', component: HotelDetailPage },
          { path: 'account/sign-in', component: AccountPage },
          { path: 'account/register', component: AccountPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    state = TestBed.inject(AuthState);
    router = TestBed.inject(Router);
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  const root = () => harness.routeNativeElement as HTMLElement;
  const query = (selector: string) => root().querySelector<HTMLElement>(selector);
  const text = (selector: string) => query(selector)?.textContent?.replace(/\s+/g, ' ').trim() ?? '';
  const stars = () => Array.from(root().querySelectorAll<HTMLButtonElement>('[data-testid="rating-panel"] [role="radio"]'));

  async function settle(): Promise<void> {
    for (let round = 0; round < 3; round += 1) {
      await Promise.resolve();
      harness.fixture.detectChanges();
      TestBed.tick();
    }
    harness.fixture.detectChanges();
  }

  async function open(session: Session | null, rating: HotelRating = hotel.rating): Promise<void> {
    if (session === null) {
      state.settle();
    } else {
      state.signIn(session);
    }
    await harness.navigateByUrl('/hotels/h1');
    harness.fixture.detectChanges();
    http.expectOne('/api/public/hotels/h1').flush({ ...hotel, rating });
    await settle();
  }

  function ownScoreRequest(): TestRequest {
    return http.expectOne('/api/hotels/h1/ratings/me');
  }

  async function openSignedIn(score: number | null, session: Session = user, rating?: HotelRating): Promise<void> {
    await open(session, rating);
    ownScoreRequest().flush({ score });
    await settle();
  }

  async function rate(value: number): Promise<TestRequest> {
    stars()[value - 1].click();
    await settle();
    return http.expectOne((request) => request.method === 'POST' && request.url === '/api/hotels/h1/ratings');
  }

  it('invites an anonymous visitor to sign in or register and come back to this hotel', async () => {
    await open(null);

    expect(text('[data-testid="rating-panel"] h2')).toBe('Rate this hotel');
    expect(text('[data-testid="rating-panel-anonymous"]')).toBe('Sign in to rate this hotel.');
    expect(query('[data-testid="rating-sign-in"]')?.textContent?.trim()).toBe('Sign in');
    expect(query('[data-testid="rating-sign-in"]')?.getAttribute('href')).toBe('/account/sign-in?returnUrl=%2Fhotels%2Fh1');
    expect(query('[data-testid="rating-register"]')?.textContent?.trim()).toBe('Create an account');
    expect(query('[data-testid="rating-register"]')?.getAttribute('href')).toBe('/account/register?returnUrl=%2Fhotels%2Fh1');
    expect(stars()).toEqual([]);
    http.expectNone('/api/hotels/h1/ratings/me');
  });

  it('loads the own score of a signed in user with the token and shows it in the control', async () => {
    await open(user);

    expect(query('[data-testid="own-rating-loading"]')?.getAttribute('aria-busy')).toBe('true');
    const request = ownScoreRequest();
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    request.flush({ score: 3 });
    await settle();

    expect(query('[data-testid="own-rating-loading"]')).toBeNull();
    expect(stars().map((star) => star.getAttribute('aria-checked'))).toEqual(['false', 'false', 'true', 'false', 'false']);
    expect(text('[data-testid="rating-control-value"]')).toBe('3 of 5');
  });

  it('lets an administrator rate from the detail as well', async () => {
    await openSignedIn(null, administrator);

    expect(stars().length).toBe(5);
    expect(text('[data-testid="rating-control-value"]')).toBe('Not rated yet');
  });

  it('saves a rating, thanks the visitor and updates the summary without reloading the hotel', async () => {
    await openSignedIn(null);

    const request = await rate(4);
    expect(request.request.body).toEqual({ score: 4 });
    expect(query('[data-testid="rating-panel"] [role="radiogroup"]')?.getAttribute('aria-busy')).toBe('true');
    request.flush({ sum: 18, count: 4, average: 4.5 });
    await settle();

    expect(text('[data-testid="rating-status"]')).toBe('Thanks, your rating was saved.');
    expect(query('[data-testid="rating-status"]')?.getAttribute('role')).toBe('status');
    expect(text('[data-testid="rating-summary"]')).toContain('4.50');
    expect(text('[data-testid="rating-summary"]')).toContain('4 ratings');
    expect(text('[data-testid="rating-control-value"]')).toBe('4 of 5');
    expect(query('[data-testid="rating-panel"] [role="radiogroup"]')?.getAttribute('aria-busy')).toBe('false');
    http.expectNone('/api/public/hotels/h1');
  });

  it('replaces the vote and updates the summary again', async () => {
    await openSignedIn(4);

    (await rate(2)).flush({ sum: 16, count: 4, average: 4 });
    await settle();

    expect(text('[data-testid="rating-summary"]')).toContain('4.00');
    expect(text('[data-testid="rating-summary"]')).toContain('4 ratings');
    expect(text('[data-testid="rating-control-value"]')).toBe('2 of 5');
    expect(text('[data-testid="rating-status"]')).toBe('Thanks, your rating was saved.');
  });

  it('shows the rating card after the first rating of a hotel without ratings', async () => {
    await openSignedIn(null, user, { sum: 0, count: 0, average: null });
    expect(query('[data-testid="rating-summary"]')).toBeNull();

    (await rate(5)).flush({ sum: 5, count: 1, average: 5 });
    await settle();

    expect(text('[data-testid="rating-summary"]')).toContain('5.00');
    expect(text('[data-testid="rating-summary"]')).toContain('1 rating');
  });

  it('ignores a second selection while the first one is saving', async () => {
    await openSignedIn(null);

    stars()[2].click();
    stars()[4].click();
    await settle();
    stars()[3].click();
    await settle();

    const requests = http.match((request) => request.method === 'POST' && request.url === '/api/hotels/h1/ratings');
    expect(requests.length).toBe(1);
    expect(requests[0].request.body).toEqual({ score: 3 });
    requests[0].flush({ sum: 17, count: 4, average: 4.25 });
    await settle();
  });

  it.each([
    [400, 'The rating must be between 1 and 5.'],
    [403, 'You do not have permission to rate.'],
    [404, 'This hotel no longer exists.'],
    [500, 'Could not save your rating. Try again.'],
  ])('explains a %s and keeps the previous vote', async (status, message) => {
    await openSignedIn(3);

    (await rate(5)).flush(null, { status, statusText: 'Failure' });
    await settle();

    expect(text('[data-testid="rating-error"]')).toBe(message);
    expect(query('[data-testid="rating-error"]')?.getAttribute('role')).toBe('alert');
    expect(text('[data-testid="rating-status"]')).toBe('');
    expect(text('[data-testid="rating-control-value"]')).toBe('3 of 5');
    expect(text('[data-testid="rating-summary"]')).toContain('4.67');
    expect(state.isAuthenticated()).toBe(true);
  });

  it('explains a network failure', async () => {
    await openSignedIn(3);

    (await rate(5)).error(new ProgressEvent('error'));
    await settle();

    expect(text('[data-testid="rating-error"]')).toBe('Could not save your rating. Try again.');
  });

  it('clears an expired session on a 401, stays on the hotel and asks to sign in again', async () => {
    await openSignedIn(3);

    (await rate(5)).flush(null, { status: 401, statusText: 'Unauthorized' });
    await settle();

    expect(text('[data-testid="rating-error"]')).toBe('Your session has expired. Sign in again.');
    expect(state.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/hotels/h1');
    expect(query('[data-testid="rating-sign-in"]')).not.toBeNull();
    expect(query('h1')?.textContent).toContain('Aurea Palace');
  });

  it('keeps the page usable when the own score cannot be loaded and retries on demand', async () => {
    await open(user);

    ownScoreRequest().flush(null, { status: 500, statusText: 'Server Error' });
    await settle();

    expect(text('[data-testid="own-rating-error"]')).toContain('We could not load your rating.');
    expect(query('[data-testid="own-rating-error"]')?.getAttribute('role')).toBe('alert');
    expect(query('h1')?.textContent).toContain('Aurea Palace');
    expect(query('[data-testid="hotel-narrative"]')).not.toBeNull();
    expect(stars()).toEqual([]);

    query('[data-testid="own-rating-retry"]')?.click();
    await settle();
    ownScoreRequest().flush({ score: 2 });
    await settle();

    expect(query('[data-testid="own-rating-error"]')).toBeNull();
    expect(text('[data-testid="rating-control-value"]')).toBe('2 of 5');
  });

  it('returns to the invitation when the visitor signs out on the page', async () => {
    await openSignedIn(3);

    state.clear();
    await settle();

    expect(stars()).toEqual([]);
    expect(query('[data-testid="rating-sign-in"]')).not.toBeNull();
  });

  it('keeps one main title and never renders the token or the account email in the panel', async () => {
    await openSignedIn(3);

    expect(root().querySelectorAll('h1').length).toBe(1);
    expect(root().innerHTML).not.toContain(token);
    const panel = text('[data-testid="rating-panel"]');
    expect(panel).not.toContain('guest@example.com');
    expect(panel.toLowerCase()).not.toContain('public');
  });
});
