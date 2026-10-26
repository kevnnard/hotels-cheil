import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { AuthState } from './core/auth/auth-state.service';
import { Session } from './core/auth/session';
import { installDialogStub, removeDialogStub } from './features/admin/ui/dialog-test-support';

const administrator: Session = {
  accessToken: 'route-token',
  email: 'admin@example.com',
  roles: ['Administrator'],
  expiresAtUtc: '2999-01-01T00:00:00Z',
};

const user: Session = { ...administrator, email: 'user@example.com', roles: ['User'] };

describe('route table', () => {
  let harness: RouterTestingHarness;
  let router: Router;
  let authState: AuthState;

  beforeEach(async () => {
    installDialogStub();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter(routes)] });
    harness = await RouterTestingHarness.create();
    router = TestBed.inject(Router);
    authState = TestBed.inject(AuthState);
    authState.settle();
  });

  afterEach(() => {
    removeDialogStub();
    document.body.classList.remove('overflow-hidden');
  });

  async function settle(): Promise<void> {
    harness.detectChanges();
    for (const request of TestBed.inject(HttpTestingController).match((candidate) => candidate.url === '/api/hotels')) {
      request.flush({ items: [], page: 1, pageSize: 10, totalItems: 0, totalPages: 0 });
    }
    for (let round = 0; round < 3; round += 1) {
      await new Promise((resolve) => setTimeout(resolve));
      TestBed.tick();
    }
  }

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

  it('opens the hotel directory inside the admin layout for an administrator', async () => {
    authState.signIn(administrator);

    await harness.navigateByUrl('/admin');

    const page = harness.routeNativeElement?.querySelector('[data-testid="admin-hotels"]');
    expect(router.url).toBe('/admin');
    expect(harness.routeNativeElement?.querySelector('[data-testid="admin-layout"]')).not.toBeNull();
    expect(page?.querySelectorAll('h1').length).toBe(1);
    expect(page?.querySelector('h1')?.textContent?.trim()).toBe('Hotels');
    TestBed.inject(HttpTestingController).expectOne((request) => request.url === '/api/hotels');
  });

  it.each([
    ['/admin/hotels/new?name=sea', 'New hotel', 'hotel-form'],
    ['/admin/hotels/abc/edit?name=sea', 'Edit hotel', 'hotel-sheet-loading'],
  ])('opens %s in a bottom sheet over the directory', async (url, title, body) => {
    authState.signIn(administrator);

    await harness.navigateByUrl(url);
    await settle();

    const root = harness.routeNativeElement as HTMLElement;
    const sheet = root.querySelector('dialog[data-testid="admin-sheet"]') as HTMLDialogElement;
    expect(router.url).toBe(url);
    expect(root.querySelector('[data-testid="admin-hotels"]')).not.toBeNull();
    expect(sheet.hasAttribute('open')).toBe(true);
    expect(sheet.querySelector('h2')?.textContent?.trim()).toBe(title);
    expect(sheet.querySelector(`[data-testid="${body}"]`)).not.toBeNull();
    expect(root.querySelectorAll('h1').length).toBe(1);
  });

  it('loads the hotel of the edit address through the administrative route', async () => {
    authState.signIn(administrator);

    await harness.navigateByUrl('/admin/hotels/abc/edit');
    await settle();

    const request = TestBed.inject(HttpTestingController).expectOne('/api/hotels/abc');
    expect(request.request.method).toBe('GET');
  });

  it('returns to the directory with the same filters when the sheet closes', async () => {
    authState.signIn(administrator);
    await harness.navigateByUrl('/admin/hotels/abc/edit?name=sea&page=2');
    await settle();

    (harness.routeNativeElement?.querySelector('[data-testid="sheet-close"]') as HTMLButtonElement).click();
    await settle();

    expect(router.url).toBe('/admin?name=sea&page=2');
    expect(harness.routeNativeElement?.querySelector('dialog[data-testid="admin-sheet"]')).toBeNull();
    expect(harness.routeNativeElement?.querySelector('[data-testid="admin-hotels"]')).not.toBeNull();
  });

  it.each(['/admin/hotels/new', '/admin/hotels/abc/edit'])(
    'sends anonymous visitors of %s to the login keeping the requested address',
    async (url) => {
      await harness.navigateByUrl(url);

      expect(router.url).toBe(`/admin/login?returnUrl=${encodeURIComponent(url)}`);
      expect(harness.routeNativeElement?.querySelector('dialog')).toBeNull();
    },
  );

  it.each(['/admin/hotels/new', '/admin/hotels/abc/edit'])(
    'keeps a signed in user without the administrator role out of %s',
    async (url) => {
      authState.signIn(user);

      await harness.navigateByUrl(url);

      expect(router.url).toBe('/admin/login?reason=forbidden');
      expect(harness.routeNativeElement?.querySelector('dialog')).toBeNull();
    },
  );

  it('sends a signed in user without the administrator role to the login with an explanation', async () => {
    authState.signIn(user);

    await harness.navigateByUrl('/admin');

    expect(router.url).toBe('/admin/login?reason=forbidden');
    expect(harness.routeNativeElement?.textContent).toContain(
      'This account does not have access to the administration area.',
    );
  });

  it('moves a signed in administrator from the login to the admin area', async () => {
    authState.signIn(administrator);

    await harness.navigateByUrl('/admin/login');

    expect(router.url).toBe('/admin');
  });

  it.each([
    ['/account/sign-in', 'account-sign-in', 'Sign in to rate hotels'],
    ['/account/register', 'account-register', 'Create your account'],
  ])('serves %s inside the public layout with one main title', async (url, testId, title) => {
    await harness.navigateByUrl(url);

    const root = harness.routeNativeElement as HTMLElement;
    expect(router.url).toBe(url);
    expect(root.querySelector('[data-testid="public-layout"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="admin-layout"]')).toBeNull();
    expect(root.querySelector(`[data-testid="${testId}"]`)).not.toBeNull();
    expect(root.querySelectorAll('h1').length).toBe(1);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe(title);
  });

  it('opens the sign in for the bare account address', async () => {
    await harness.navigateByUrl('/account');

    expect(router.url).toBe('/account/sign-in');
  });

  it.each(['/account/sign-in', '/account/register'])(
    'sends a signed in user away from %s to the safe return address',
    async (path) => {
      authState.signIn(user);

      await harness.navigateByUrl(`${path}?returnUrl=%2Fhotels%2Fabc`);

      expect(router.url).toBe('/hotels/abc');
    },
  );

  it.each(['/account/sign-in?returnUrl=%2F%2Fevil.com', '/account/register'])(
    'sends a signed in administrator from %s to the public home',
    async (url) => {
      authState.signIn(administrator);

      await harness.navigateByUrl(url);

      expect(router.url).toBe('/');
    },
  );

  it('keeps the admin login refusing a signed in user as before', async () => {
    authState.signIn(user);

    await harness.navigateByUrl('/admin/login');

    expect(router.url).toBe('/admin/login');
    expect(harness.routeNativeElement?.querySelector('[data-testid="admin-login"]')).not.toBeNull();
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
