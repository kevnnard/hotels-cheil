import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthState, sessionStorageKey } from '../core/auth/auth-state.service';
import { authInterceptor } from '../core/http/auth.interceptor';
import { AdminLayout } from './admin-layout';

@Component({ template: '<p data-testid="admin-child">child</p>' })
class ChildPage {}

@Component({ template: '<p data-testid="login-stub">login</p>' })
class LoginStub {}

const token = 'layout-secret-token';

describe('AdminLayout', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let state: AuthState;

  beforeEach(async () => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'admin/login', component: LoginStub },
          { path: 'admin', component: AdminLayout, children: [{ path: '', component: ChildPage, children: [{ path: 'hotels/new', component: ChildPage }] }] },
          { path: '', component: ChildPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    state = TestBed.inject(AuthState);
    state.signIn({ accessToken: token, email: 'admin@example.com', roles: ['Administrator'], expiresAtUtc: '2999-01-01T00:00:00Z' });
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  async function open(): Promise<HTMLElement> {
    await harness.navigateByUrl('/admin');
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  async function signOut(root: HTMLElement): Promise<void> {
    (root.querySelector('[data-testid="admin-sign-out"]') as HTMLButtonElement).click();
    harness.detectChanges();
  }

  it('renders the brand, the navigation, the signed in email and the routed page', async () => {
    const root = await open();
    const nav = root.querySelector('nav[aria-label="Administration"]') as HTMLElement;
    const links = Array.from(nav.querySelectorAll('a')).map((link) => [link.textContent?.trim(), link.getAttribute('href')]);

    expect(root.querySelector('[data-testid="admin-layout"]')).not.toBeNull();
    expect(root.textContent).toContain('AUREA');
    expect(links).toEqual([
      ['Hotels', '/admin'],
      ['View public site', '/'],
    ]);
    expect(nav.querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Hotels');
    expect(root.querySelector('[data-testid="admin-email"]')?.textContent?.trim()).toBe('admin@example.com');
    expect(root.querySelector('[data-testid="admin-child"]')).not.toBeNull();
    expect(root.innerHTML).not.toContain(token);
  });

  it.each(['/admin?name=sea&page=2', '/admin/hotels/new?name=sea'])(
    'keeps the Hotels link current at %s',
    async (url) => {
      await harness.navigateByUrl(url);
      harness.detectChanges();
      const nav = (harness.routeNativeElement as HTMLElement).querySelector('nav[aria-label="Administration"]') as HTMLElement;

      expect(nav.querySelector('a[aria-current="page"]')?.textContent?.trim()).toBe('Hotels');
    },
  );

  it('signs out through the API, clears the session and opens the login', async () => {
    const root = await open();

    await signOut(root);
    const request = http.expectOne('/api/auth/logout');
    expect(request.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    request.flush(null, { status: 204, statusText: 'No Content' });
    await harness.fixture.whenStable();

    expect(state.isAuthenticated()).toBe(false);
    expect(sessionStorage.getItem(sessionStorageKey)).toBeNull();
    expect(router.url).toBe('/admin/login');
  });

  it('signs out locally even when the API fails', async () => {
    const root = await open();

    await signOut(root);
    http.expectOne('/api/auth/logout').flush(null, { status: 500, statusText: 'Server Error' });
    await harness.fixture.whenStable();

    expect(state.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/admin/login');
  });
});
