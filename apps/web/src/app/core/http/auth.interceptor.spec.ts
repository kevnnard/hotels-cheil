import { Component } from '@angular/core';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AuthApi } from '../auth/auth-api.service';
import { AuthState } from '../auth/auth-state.service';
import { authInterceptor } from './auth.interceptor';

@Component({ template: '' })
class BlankPage {}

function flushNavigation(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

const session = {
  accessToken: 'token-abc',
  email: 'admin@example.com',
  roles: ['Administrator'],
  expiresAtUtc: '2999-01-01T00:00:00Z',
};

describe('authInterceptor', () => {
  let http: HttpClient;
  let httpTesting: HttpTestingController;
  let state: AuthState;
  let router: Router;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin/login', component: BlankPage },
          { path: 'admin/hotels', component: BlankPage },
          { path: 'hotels/:id', component: BlankPage },
          { path: 'administrators', component: BlankPage },
          { path: '', component: BlankPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpClient);
    httpTesting = TestBed.inject(HttpTestingController);
    state = TestBed.inject(AuthState);
    router = TestBed.inject(Router);
  });

  afterEach(() => {
    httpTesting.verify();
    sessionStorage.clear();
  });

  async function failWith(status: number, url = '/api/hotels'): Promise<unknown> {
    const result = firstValueFrom(http.get(url)).catch((error: unknown) => error);
    httpTesting.expectOne(url).flush(null, { status, statusText: 'Failure' });
    return result;
  }

  it('adds the bearer header to same-origin API requests when a session exists', () => {
    state.signIn(session);

    http.get('/api/hotels').subscribe();

    expect(httpTesting.expectOne('/api/hotels').request.headers.get('Authorization')).toBe('Bearer token-abc');
  });

  it('adds the header to an absolute address on the same origin', () => {
    state.signIn(session);
    const url = `${location.origin}/api/hotels`;

    http.get(url).subscribe();

    expect(httpTesting.expectOne(url).request.headers.get('Authorization')).toBe('Bearer token-abc');
  });

  it('sends no header without a session', () => {
    http.get('/api/hotels').subscribe();

    expect(httpTesting.expectOne('/api/hotels').request.headers.has('Authorization')).toBe(false);
  });

  it.each([
    'https://cdn.example.com/api/hotels',
    '//evil.com/api/hotels',
    '/assets/logo.svg',
    '/apix/hotels',
    'https://evil.com/?next=/api/hotels',
  ])('never sends the token to %s', (url) => {
    state.signIn(session);

    http.get(url).subscribe();

    expect(httpTesting.expectOne(url).request.headers.has('Authorization')).toBe(false);
  });

  it('keeps an explicit authorization header', () => {
    state.signIn(session);

    http.get('/api/auth/me', { headers: { Authorization: 'Bearer explicit' } }).subscribe();

    expect(httpTesting.expectOne('/api/auth/me').request.headers.get('Authorization')).toBe('Bearer explicit');
  });

  it('clears the session on a 401 and returns to the login keeping the attempted address', async () => {
    state.signIn(session);
    await router.navigateByUrl('/admin/hotels');

    const error = await failWith(401);
    await flushNavigation();

    expect(error).toBeInstanceOf(HttpErrorResponse);
    expect(state.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/admin/login?returnUrl=%2Fadmin%2Fhotels');
  });

  it.each(['/hotels/abc', '/', '/administrators'])(
    'clears the session on a 401 under %s and stays on the page',
    async (url) => {
      state.signIn(session);
      await router.navigateByUrl(url);
      const navigate = vi.spyOn(router, 'navigate');
      const navigateByUrl = vi.spyOn(router, 'navigateByUrl');

      const error = await failWith(401);
      await flushNavigation();

      expect(error).toBeInstanceOf(HttpErrorResponse);
      expect(state.isAuthenticated()).toBe(false);
      expect(router.url).toBe(url);
      expect(navigate).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
    },
  );

  it('returns to the admin login on a 401 while a navigation into the admin area is under way', async () => {
    state.signIn(session);
    await router.navigateByUrl('/hotels/abc');
    const result = firstValueFrom(http.get('/api/hotels')).catch((error: unknown) => error);
    const navigation = router.navigateByUrl('/admin/hotels');

    httpTesting.expectOne('/api/hotels').flush(null, { status: 401, statusText: 'Failure' });
    await result;
    await navigation;
    await flushNavigation();

    expect(state.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/admin/login?returnUrl=%2Fadmin%2Fhotels');
  });

  it('does not nest the login as its own return address', async () => {
    state.signIn(session);
    await router.navigateByUrl('/admin/login');

    await failWith(401);
    await flushNavigation();

    expect(router.url).toBe('/admin/login');
  });

  it('leaves a failed sign in to the login form', async () => {
    const api = TestBed.inject(AuthApi);
    const navigate = vi.spyOn(router, 'navigate');

    const result = firstValueFrom(api.login({ email: 'a@example.com', password: 'Wrong1234' })).catch((e: unknown) => e);
    httpTesting.expectOne('/api/auth/login').flush(null, { status: 401, statusText: 'Unauthorized' });
    await result;

    expect(navigate).not.toHaveBeenCalled();
  });

  it.each([403, 404, 500])('keeps the session on a %s', async (status) => {
    state.signIn(session);

    await failWith(status);

    expect(state.isAuthenticated()).toBe(true);
  });

  it('ignores a 401 from another origin', async () => {
    state.signIn(session);

    await failWith(401, 'https://other.example.com/api/hotels');

    expect(state.isAuthenticated()).toBe(true);
  });

  it('never retries the failed request', async () => {
    state.signIn(session);

    await failWith(401);

    httpTesting.expectNone('/api/hotels');
  });
});
