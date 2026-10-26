import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthState, sessionStorageKey } from '../../core/auth/auth-state.service';
import { SignInResponse } from '../../core/auth/auth.models';
import { authInterceptor } from '../../core/http/auth.interceptor';
import { SignInPage } from './sign-in-page';

@Component({ template: '<p data-testid="destination">destination</p>' })
class DestinationPage {}

const password = 'Sup3rSecretPass';
const token = 'eyJ.visitor-token.value';

const userAnswer: SignInResponse = {
  accessToken: token,
  expiresAtUtc: '2999-01-01T00:00:00Z',
  sessionId: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  email: 'guest@example.com',
  roles: ['User'],
};

describe('SignInPage', () => {
  let harness: RouterTestingHarness;
  let http: HttpTestingController;
  let router: Router;
  let state: AuthState;
  let consoleSpies: ReturnType<typeof vi.spyOn>[];

  beforeEach(async () => {
    sessionStorage.clear();
    consoleSpies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) =>
      vi.spyOn(console, method).mockImplementation(() => undefined),
    );
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([
          { path: 'account/sign-in', component: SignInPage },
          { path: 'account/register', component: DestinationPage },
          { path: 'hotels/:id', component: DestinationPage },
          { path: '', component: DestinationPage },
        ]),
      ],
    });
    http = TestBed.inject(HttpTestingController);
    router = TestBed.inject(Router);
    state = TestBed.inject(AuthState);
    state.settle();
    harness = await RouterTestingHarness.create();
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  async function open(url = '/account/sign-in'): Promise<HTMLElement> {
    await harness.navigateByUrl(url);
    harness.detectChanges();
    return harness.routeNativeElement as HTMLElement;
  }

  function field(root: HTMLElement, id: string): HTMLInputElement {
    return root.querySelector(`#${id}`) as HTMLInputElement;
  }

  function type(input: HTMLInputElement, value: string): void {
    input.value = value;
    input.dispatchEvent(new Event('input'));
  }

  function submit(root: HTMLElement): void {
    (root.querySelector('[data-testid="sign-in-submit"]') as HTMLButtonElement).click();
    harness.detectChanges();
  }

  function fillAndSubmit(root: HTMLElement, email = 'guest@example.com'): void {
    type(field(root, 'sign-in-email'), email);
    type(field(root, 'sign-in-password'), password);
    submit(root);
  }

  function alertText(root: HTMLElement): string {
    return root.querySelector('[data-testid="account-error"]')?.textContent?.trim() ?? '';
  }

  function expectNoSecretsLogged(): void {
    for (const spy of consoleSpies) {
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(password);
    }
  }

  it('renders the public heading, labelled fields and the alert region', async () => {
    const root = await open();

    expect(root.querySelectorAll('h1').length).toBe(1);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Sign in to rate hotels');
    expect(root.querySelector('label[for="sign-in-email"]')?.textContent).toContain('Email');
    expect(root.querySelector('label[for="sign-in-password"]')?.textContent).toContain('Password');
    expect(field(root, 'sign-in-email').getAttribute('autocomplete')).toBe('username');
    expect(field(root, 'sign-in-password').type).toBe('password');
    expect(field(root, 'sign-in-password').getAttribute('autocomplete')).toBe('current-password');
    const alert = root.querySelector('[data-testid="account-error"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.getAttribute('aria-live')).toBe('assertive');
    expect(root.textContent).not.toContain('administrator');
  });

  it('shows the required messages, focuses the first invalid field and sends nothing', async () => {
    const root = await open();

    submit(root);

    expect(root.querySelector('[data-testid="sign-in-email-error"]')?.textContent).toContain('Enter your email address.');
    expect(root.querySelector('[data-testid="sign-in-password-error"]')?.textContent).toContain('Enter your password.');
    expect(field(root, 'sign-in-email').getAttribute('aria-invalid')).toBe('true');
    expect(field(root, 'sign-in-email').getAttribute('aria-describedby')).toBe('sign-in-email-error');
    expect(document.activeElement).toBe(field(root, 'sign-in-email'));
    http.expectNone('/api/auth/login');
  });

  it('validates the email format and focuses the password when only it is missing', async () => {
    const root = await open();

    type(field(root, 'sign-in-email'), 'guest@example');
    submit(root);
    expect(root.querySelector('[data-testid="sign-in-email-error"]')?.textContent).toContain('Enter a valid email address.');

    type(field(root, 'sign-in-email'), 'guest@example.com');
    submit(root);
    expect(document.activeElement).toBe(field(root, 'sign-in-password'));
    http.expectNone('/api/auth/login');
  });

  it('shows and hides the password', async () => {
    const root = await open();
    const toggle = root.querySelector('[data-testid="sign-in-password-toggle"]') as HTMLButtonElement;

    toggle.click();
    harness.detectChanges();

    expect(field(root, 'sign-in-password').type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
  });

  it('keeps the session of a User account, never revokes it and goes to the safe return address', async () => {
    const root = await open('/account/sign-in?returnUrl=%2Fhotels%2Fabc');

    fillAndSubmit(root);
    const request = http.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ email: 'guest@example.com', password });
    request.flush(userAnswer);
    await harness.fixture.whenStable();

    http.expectNone('/api/auth/logout');
    expect(router.url).toBe('/hotels/abc');
    expect(state.isAuthenticated()).toBe(true);
    expect(state.isAdministrator()).toBe(false);
    expect(sessionStorage.getItem(sessionStorageKey)).not.toBeNull();
    expectNoSecretsLogged();
  });

  it('keeps the session of an administrator and goes to the public home without a return address', async () => {
    const root = await open();

    fillAndSubmit(root, 'admin@example.com');
    http.expectOne('/api/auth/login').flush({ ...userAnswer, email: 'admin@example.com', roles: ['Administrator'] });
    await harness.fixture.whenStable();

    http.expectNone('/api/auth/logout');
    expect(router.url).toBe('/');
    expect(state.isAdministrator()).toBe(true);
  });

  it.each(['%2F%2Fevil.com', 'https%3A%2F%2Fx', '%2F%5Cevil.com', '%2Faccount%2Fsign-in'])(
    'goes to the public home instead of the return address %s',
    async (returnUrl) => {
      const root = await open(`/account/sign-in?returnUrl=${returnUrl}`);

      fillAndSubmit(root);
      http.expectOne('/api/auth/login').flush(userAnswer);
      await harness.fixture.whenStable();

      expect(router.url).toBe('/');
    },
  );

  it('shows a loading state and ignores a second submit while the request is pending', async () => {
    const root = await open();

    fillAndSubmit(root);
    const button = root.querySelector('[data-testid="sign-in-submit"]') as HTMLButtonElement;
    submit(root);

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Signing in');
    http.expectOne('/api/auth/login').flush(userAnswer);
    await harness.fixture.whenStable();
  });

  it('shows the generic message for invalid credentials', async () => {
    const root = await open();

    fillAndSubmit(root);
    http.expectOne('/api/auth/login').flush({ title: 'x' }, { status: 401, statusText: 'Unauthorized' });
    harness.detectChanges();

    expect(alertText(root)).toBe('Invalid email or password.');
    expect(router.url).toBe('/account/sign-in');
    expect(state.isAuthenticated()).toBe(false);
    expect((root.querySelector('[data-testid="sign-in-submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it('maps a 400 to its field and focuses it', async () => {
    const root = await open();

    fillAndSubmit(root);
    http
      .expectOne('/api/auth/login')
      .flush({ errors: { password: ['The password must have between 8 and 128 characters.'] } }, { status: 400, statusText: 'Bad Request' });
    harness.detectChanges();

    expect(root.querySelector('[data-testid="sign-in-password-error"]')?.textContent).toContain(
      'The password must have between 8 and 128 characters.',
    );
    expect(document.activeElement).toBe(field(root, 'sign-in-password'));
  });

  it('explains a network failure', async () => {
    const root = await open();

    fillAndSubmit(root);
    http.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    harness.detectChanges();

    expect(alertText(root)).toBe('We could not reach the server. Check your connection and try again.');
  });

  it('links to the registration keeping the return address', async () => {
    const root = await open('/account/sign-in?returnUrl=%2Fhotels%2Fabc');

    const link = root.querySelector('[data-testid="sign-in-register-link"]');
    expect(link?.textContent?.trim()).toBe('Create an account');
    expect(link?.getAttribute('href')).toBe('/account/register?returnUrl=%2Fhotels%2Fabc');
  });

  it('never renders the token or the password and keeps 44 px targets', async () => {
    const root = await open();

    fillAndSubmit(root);
    http.expectOne('/api/auth/login').flush({ title: 'x' }, { status: 401, statusText: 'Unauthorized' });
    harness.detectChanges();

    expect(root.innerHTML).not.toContain(password);
    expectNoSecretsLogged();
    for (const element of Array.from(root.querySelectorAll('input, button, a'))) {
      expect(element.className).toMatch(/min-h-11|h-11/);
    }
  });
});
