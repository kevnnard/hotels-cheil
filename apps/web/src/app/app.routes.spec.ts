import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthState } from './core/auth/auth-state.service';

describe('route table', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let authState: AuthState;

  beforeEach(async () => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)] });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
    authState = TestBed.inject(AuthState);
  });

  it('serves the public home at the root without a session', async () => {
    await harness.navigateByUrl('/');

    expect(router.url).toBe('/');
    expect(harness.routeNativeElement?.querySelector('[data-testid="public-home"]')).not.toBeNull();
  });

  it('serves the hotel detail at hotels/:id inside the public layout', async () => {
    await harness.navigateByUrl('/hotels/abc');

    expect(router.url).toBe('/hotels/abc');
    expect(harness.routeNativeElement?.querySelector('[data-testid="public-layout"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('[data-testid="detail-loading"]')).not.toBeNull();
  });

  it('renders the public layout around the public home', async () => {
    await harness.navigateByUrl('/');

    expect(harness.routeNativeElement?.querySelector('[data-testid="public-layout"]')).not.toBeNull();
  });

  it('sends anonymous visitors from the admin area to the login keeping the requested address', async () => {
    await harness.navigateByUrl('/admin');

    expect(router.url).toBe('/admin/login?returnUrl=%2Fadmin');
    expect(harness.routeNativeElement?.querySelector('[data-testid="admin-login"]')).not.toBeNull();
  });

  it('opens the admin dashboard inside the admin layout for an administrator', async () => {
    authState.signIn({ email: 'admin@example.com', role: 'Administrator' });

    await harness.navigateByUrl('/admin');

    expect(router.url).toBe('/admin');
    expect(harness.routeNativeElement?.querySelector('[data-testid="admin-layout"]')).not.toBeNull();
    expect(harness.routeNativeElement?.querySelector('[data-testid="admin-dashboard"]')).not.toBeNull();
  });

  it('keeps a signed in user without the administrator role out of the admin area', async () => {
    authState.signIn({ email: 'user@example.com', role: 'User' });

    await harness.navigateByUrl('/admin');

    expect(router.url).toBe('/');
  });

  it('moves a signed in administrator from the login to the admin area', async () => {
    authState.signIn({ email: 'admin@example.com', role: 'Administrator' });

    await harness.navigateByUrl('/admin/login');

    expect(router.url).toBe('/admin');
  });

  it('sends unknown addresses to the public home', async () => {
    await harness.navigateByUrl('/does-not-exist');

    expect(router.url).toBe('/');
  });

  it('keeps unknown admin addresses behind the login for anonymous visitors', async () => {
    await harness.navigateByUrl('/admin/unknown');

    expect(router.url.startsWith('/admin/login')).toBe(true);
  });
});
