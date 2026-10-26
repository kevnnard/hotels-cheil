import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthState, sessionStorageKey } from '../../core/auth/auth-state.service';
import { SignInResponse } from '../../core/auth/auth.models';
import { authInterceptor } from '../../core/http/auth.interceptor';
import { LoginPage } from './login-page';

@Component({ template: '<p data-testid="destination">destination</p>' })
class DestinationPage {}

const password = 'Sup3rSecretPass';
const token = 'eyJ.secret-token.value';

const administratorAnswer: SignInResponse = {
  accessToken: token,
  expiresAtUtc: '2999-01-01T00:00:00Z',
  sessionId: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  email: 'admin@example.com',
  roles: ['Administrator'],
};

describe('LoginPage', () => {
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
          { path: 'admin/login', component: LoginPage },
          { path: 'admin/hotels', component: DestinationPage },
          { path: 'admin', component: DestinationPage },
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

  async function open(url = '/admin/login'): Promise<HTMLElement> {
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
    (root.querySelector('[data-testid="login-submit"]') as HTMLButtonElement).click();
    harness.detectChanges();
  }

  async function fillAndSubmit(root: HTMLElement, email = 'admin@example.com'): Promise<void> {
    type(field(root, 'login-email'), email);
    type(field(root, 'login-password'), password);
    submit(root);
  }

  function alertText(root: HTMLElement): string {
    return root.querySelector('[data-testid="login-error"]')?.textContent?.trim() ?? '';
  }

  function expectNoSecretsLogged(): void {
    for (const spy of consoleSpies) {
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(password);
    }
  }

  it('renders labelled fields with autocomplete hints and a heading', async () => {
    const root = await open();

    expect(root.querySelector('h1')?.textContent).toContain('Sign in');
    expect(root.querySelector('label[for="login-email"]')?.textContent).toContain('Email');
    expect(root.querySelector('label[for="login-password"]')?.textContent).toContain('Password');
    expect(field(root, 'login-email').type).toBe('email');
    expect(field(root, 'login-email').getAttribute('autocomplete')).toBe('username');
    expect(field(root, 'login-password').type).toBe('password');
    expect(field(root, 'login-password').getAttribute('autocomplete')).toBe('current-password');
    expect(root.querySelector('[data-testid="login-error"]')?.getAttribute('role')).toBe('alert');
  });

  it('shows the required messages, focuses the first invalid field and sends nothing', async () => {
    const root = await open();

    submit(root);

    expect(root.querySelector('[data-testid="login-email-error"]')?.textContent).toContain('Enter your email address.');
    expect(root.querySelector('[data-testid="login-password-error"]')?.textContent).toContain('Enter your password.');
    expect(field(root, 'login-email').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field(root, 'login-email'));
    http.expectNone('/api/auth/login');
  });

  it('validates the email format and focuses the password when only it is missing', async () => {
    const root = await open();

    type(field(root, 'login-email'), 'not-an-email');
    submit(root);
    expect(root.querySelector('[data-testid="login-email-error"]')?.textContent).toContain('Enter a valid email address.');

    type(field(root, 'login-email'), 'admin@example.com');
    submit(root);
    expect(document.activeElement).toBe(field(root, 'login-password'));
    http.expectNone('/api/auth/login');
  });

  it('shows and hides the password', async () => {
    const root = await open();
    const toggle = root.querySelector('[data-testid="login-toggle-password"]') as HTMLButtonElement;

    expect(toggle.getAttribute('aria-pressed')).toBe('false');
    toggle.click();
    harness.detectChanges();

    expect(field(root, 'login-password').type).toBe('text');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Hide password');
  });

  it('signs in, stores the session and goes to the safe return address', async () => {
    const root = await open('/admin/login?returnUrl=%2Fadmin%2Fhotels');

    await fillAndSubmit(root);
    const request = http.expectOne('/api/auth/login');
    expect(request.request.body).toEqual({ email: 'admin@example.com', password });
    request.flush(administratorAnswer);
    await harness.fixture.whenStable();

    expect(router.url).toBe('/admin/hotels');
    expect(state.accessToken()).toBe(token);
    expect(sessionStorage.getItem(sessionStorageKey)).not.toBeNull();
    expectNoSecretsLogged();
  });

  it.each(['%2F%2Fevil.com', 'https%3A%2F%2Fx', '%2F%5Cevil.com'])(
    'goes to the admin home instead of the unsafe return address %s',
    async (returnUrl) => {
      const root = await open(`/admin/login?returnUrl=${returnUrl}`);

      await fillAndSubmit(root);
      http.expectOne('/api/auth/login').flush(administratorAnswer);
      await harness.fixture.whenStable();

      expect(router.url).toBe('/admin');
    },
  );

  it('shows a loading state while the request is pending', async () => {
    const root = await open();

    await fillAndSubmit(root);
    const button = root.querySelector('[data-testid="login-submit"]') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Signing in');
    http.expectOne('/api/auth/login').flush(administratorAnswer);
    await harness.fixture.whenStable();
  });

  it('shows the generic message for invalid credentials and keeps the form', async () => {
    const root = await open();

    await fillAndSubmit(root);
    http
      .expectOne('/api/auth/login')
      .flush({ title: 'The email address or the password is not valid.' }, { status: 401, statusText: 'Unauthorized' });
    harness.detectChanges();

    expect(alertText(root)).toBe('Invalid email or password.');
    expect(router.url).toBe('/admin/login');
    expect(field(root, 'login-email').value).toBe('admin@example.com');
    expect(field(root, 'login-email').getAttribute('aria-invalid')).toBe('false');
    expect(field(root, 'login-password').getAttribute('aria-invalid')).toBe('false');
    expect(state.isAuthenticated()).toBe(false);
    expect((root.querySelector('[data-testid="login-submit"]') as HTMLButtonElement).disabled).toBe(false);
  });

  it.each([
    ['email', 'login-email', 'The email address is not valid.'],
    ['password', 'login-password', 'The password must have between 8 and 128 characters.'],
    ['Email', 'login-email', 'The email address is not valid.'],
  ])('maps a 400 for %s to its field and focuses it', async (key, id, message) => {
    const root = await open();

    await fillAndSubmit(root);
    http
      .expectOne('/api/auth/login')
      .flush({ title: 'One or more validation errors occurred.', errors: { [key]: [message] } }, { status: 400, statusText: 'Bad Request' });
    harness.detectChanges();

    expect(root.querySelector(`[data-testid="${id}-error"]`)?.textContent).toContain(message);
    expect(field(root, id).getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field(root, id));
  });

  it('shows a generic message for a 400 without known fields', async () => {
    const root = await open();

    await fillAndSubmit(root);
    http.expectOne('/api/auth/login').flush({ title: 'Bad' }, { status: 400, statusText: 'Bad Request' });
    harness.detectChanges();

    expect(alertText(root)).toBe('Check the highlighted fields and try again.');
  });

  it('explains a network failure', async () => {
    const root = await open();

    await fillAndSubmit(root);
    http.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    harness.detectChanges();

    expect(alertText(root)).toBe('We could not reach the server. Check your connection and try again.');
  });

  it('explains an unexpected server failure', async () => {
    const root = await open();

    await fillAndSubmit(root);
    http.expectOne('/api/auth/login').flush(null, { status: 500, statusText: 'Server Error' });
    harness.detectChanges();

    expect(alertText(root)).toBe('Something went wrong. Please try again.');
  });

  it('refuses an account without the administrator role and revokes its session', async () => {
    const root = await open();

    await fillAndSubmit(root, 'user@example.com');
    http.expectOne('/api/auth/login').flush({ ...administratorAnswer, email: 'user@example.com', roles: ['User'] });
    const logout = http.expectOne('/api/auth/logout');
    expect(logout.request.headers.get('Authorization')).toBe(`Bearer ${token}`);
    logout.flush(null, { status: 204, statusText: 'No Content' });
    harness.detectChanges();

    expect(alertText(root)).toBe('This account does not have access to the administration area.');
    expect(router.url).toBe('/admin/login');
    expect(state.isAuthenticated()).toBe(false);
  });

  it('explains why a signed in account without the role was sent to the login', async () => {
    const root = await open('/admin/login?reason=forbidden');

    expect(alertText(root)).toBe('This account does not have access to the administration area.');
  });

  it('never renders the token or the password', async () => {
    const root = await open();

    await fillAndSubmit(root);
    http.expectOne('/api/auth/login').flush({ title: 'x' }, { status: 401, statusText: 'Unauthorized' });
    harness.detectChanges();

    expect(root.textContent).not.toContain(password);
    expect(root.innerHTML).not.toContain(password);
    expectNoSecretsLogged();
  });

  it('keeps every interactive target at least 44 px tall', async () => {
    const root = await open();

    for (const element of Array.from(root.querySelectorAll('input, button, a'))) {
      expect(element.className).toMatch(/min-h-11|h-11/);
    }
  });
});
