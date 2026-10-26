import { Component } from '@angular/core';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { AuthState } from '../../core/auth/auth-state.service';
import { SignInResponse } from '../../core/auth/auth.models';
import { authInterceptor } from '../../core/http/auth.interceptor';
import { RegisterPage } from './register-page';

@Component({ template: '<p data-testid="destination">destination</p>' })
class DestinationPage {}

const password = 'N3wVisitorPass';
const token = 'eyJ.new-visitor-token.value';

const signInAnswer: SignInResponse = {
  accessToken: token,
  expiresAtUtc: '2999-01-01T00:00:00Z',
  sessionId: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  email: 'new@example.com',
  roles: ['User'],
};

describe('RegisterPage', () => {
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
          { path: 'account/register', component: RegisterPage },
          { path: 'account/sign-in', component: DestinationPage },
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

  async function open(url = '/account/register'): Promise<HTMLElement> {
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
    (root.querySelector('[data-testid="register-submit"]') as HTMLButtonElement).click();
    harness.detectChanges();
  }

  function fill(root: HTMLElement, email: string, first: string, second = first): void {
    type(field(root, 'register-email'), email);
    type(field(root, 'register-password'), first);
    type(field(root, 'register-confirm-password'), second);
  }

  function errorOf(root: HTMLElement, id: string): string {
    return root.querySelector(`[data-testid="${id}-error"]`)?.textContent?.trim() ?? '';
  }

  function alertText(root: HTMLElement): string {
    return root.querySelector('[data-testid="account-error"]')?.textContent?.trim() ?? '';
  }

  function expectNoSecrets(root: HTMLElement): void {
    expect(root.innerHTML).not.toContain(password);
    expect(root.innerHTML).not.toContain(token);
    for (const spy of consoleSpies) {
      const logged = JSON.stringify(spy.mock.calls);
      expect(logged).not.toContain(token);
      expect(logged).not.toContain(password);
    }
  }

  it('renders the public heading, the three labelled fields and the password rules', async () => {
    const root = await open();

    expect(root.querySelectorAll('h1').length).toBe(1);
    expect(root.querySelector('h1')?.textContent?.trim()).toBe('Create your account');
    expect(root.querySelector('label[for="register-email"]')?.textContent).toContain('Email');
    expect(root.querySelector('label[for="register-password"]')?.textContent).toContain('Password');
    expect(root.querySelector('label[for="register-confirm-password"]')?.textContent).toContain('Confirm password');
    expect(field(root, 'register-password').getAttribute('autocomplete')).toBe('new-password');
    expect(field(root, 'register-confirm-password').getAttribute('autocomplete')).toBe('new-password');
    expect(root.querySelector('#register-password-hint')?.textContent?.trim()).toBe(
      'Use 8 to 128 characters with at least one letter and one digit.',
    );
    expect(field(root, 'register-password').getAttribute('aria-describedby')).toBe('register-password-hint');
    expect(root.querySelector('[data-testid="account-error"]')?.getAttribute('role')).toBe('alert');
  });

  it('shows the required messages, focuses the first invalid field and sends nothing', async () => {
    const root = await open();

    submit(root);

    expect(errorOf(root, 'register-email')).toBe('Enter your email address.');
    expect(errorOf(root, 'register-password')).toBe('Enter a password.');
    expect(errorOf(root, 'register-confirm-password')).toBe('Confirm your password.');
    expect(document.activeElement).toBe(field(root, 'register-email'));
    http.expectNone('/api/auth/register');
  });

  it.each([
    ['Short1', 'Use at least 8 characters.'],
    ['abcdefgh', 'Include at least one digit.'],
    ['12345678', 'Include at least one letter.'],
    ['a1'.repeat(64) + 'x', 'Use at most 128 characters.'],
  ])('explains why the password %j is refused and focuses it', async (value, message) => {
    const root = await open();

    fill(root, 'new@example.com', value);
    submit(root);

    expect(errorOf(root, 'register-password')).toBe(message);
    expect(field(root, 'register-password').getAttribute('aria-describedby')).toBe(
      'register-password-hint register-password-error',
    );
    expect(document.activeElement).toBe(field(root, 'register-password'));
    http.expectNone('/api/auth/register');
  });

  it.each(['new@example', 'new user@example.com', 'new@@example.com'])('refuses the email %j', async (email) => {
    const root = await open();

    fill(root, email, password);
    submit(root);

    expect(errorOf(root, 'register-email')).toBe('Enter a valid email address.');
    http.expectNone('/api/auth/register');
  });

  it('refuses passwords that do not match and focuses the confirmation', async () => {
    const root = await open();

    fill(root, 'new@example.com', password, `${password}x`);
    submit(root);

    expect(errorOf(root, 'register-confirm-password')).toBe('The passwords do not match.');
    expect(field(root, 'register-confirm-password').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe(field(root, 'register-confirm-password'));
    http.expectNone('/api/auth/register');
  });

  it('accepts the confirmation again once the password is changed to match it', async () => {
    const root = await open();

    fill(root, 'new@example.com', `${password}x`, password);
    submit(root);
    expect(errorOf(root, 'register-confirm-password')).toBe('The passwords do not match.');

    type(field(root, 'register-password'), password);
    harness.detectChanges();

    expect(errorOf(root, 'register-confirm-password')).toBe('');
  });

  it('creates the account, signs in with the same credentials and goes to the safe return address', async () => {
    const root = await open('/account/register?returnUrl=%2Fhotels%2Fabc');

    fill(root, '  new@example.com ', password);
    submit(root);
    const registration = http.expectOne('/api/auth/register');
    expect(registration.request.method).toBe('POST');
    expect(registration.request.body).toEqual({ email: 'new@example.com', password });
    registration.flush({ userId: signInAnswer.userId, email: 'new@example.com' }, { status: 201, statusText: 'Created' });
    const login = http.expectOne('/api/auth/login');
    expect(login.request.body).toEqual({ email: 'new@example.com', password });
    login.flush(signInAnswer);
    await harness.fixture.whenStable();

    http.expectNone('/api/auth/logout');
    expect(router.url).toBe('/hotels/abc');
    expect(state.isAuthenticated()).toBe(true);
    expect(state.isAdministrator()).toBe(false);
    expectNoSecrets(root);
  });

  it.each(['%2F%2Fevil.com', 'https%3A%2F%2Fevil.com', '%2Faccount%2Fregister'])(
    'goes to the public home instead of the return address %s',
    async (returnUrl) => {
      const root = await open(`/account/register?returnUrl=${returnUrl}`);

      fill(root, 'new@example.com', password);
      submit(root);
      http.expectOne('/api/auth/register').flush({ userId: signInAnswer.userId, email: 'new@example.com' });
      http.expectOne('/api/auth/login').flush(signInAnswer);
      await harness.fixture.whenStable();

      expect(router.url).toBe('/');
    },
  );

  it('explains a duplicate email without signing in', async () => {
    const root = await open();

    fill(root, 'taken@example.com', password);
    submit(root);
    http
      .expectOne('/api/auth/register')
      .flush({ title: 'The email address is already registered.' }, { status: 409, statusText: 'Conflict' });
    harness.detectChanges();

    expect(alertText(root)).toBe('This email address is already registered. Sign in instead.');
    expect(errorOf(root, 'register-email')).toBe('This email address is already registered.');
    expect(document.activeElement).toBe(field(root, 'register-email'));
    http.expectNone('/api/auth/login');
    expect(state.isAuthenticated()).toBe(false);
    expect(router.url).toBe('/account/register');
  });

  it('maps the field errors of a 400', async () => {
    const root = await open();

    fill(root, 'new@example.com', password);
    submit(root);
    http.expectOne('/api/auth/register').flush(
      {
        errors: {
          password: ['The password must have between 8 and 128 characters, with at least one letter and one digit.'],
        },
      },
      { status: 400, statusText: 'Bad Request' },
    );
    harness.detectChanges();

    expect(alertText(root)).toBe('Check the highlighted fields and try again.');
    expect(errorOf(root, 'register-password')).toBe(
      'The password must have between 8 and 128 characters, with at least one letter and one digit.',
    );
    expect(document.activeElement).toBe(field(root, 'register-password'));
  });

  it('explains a network failure', async () => {
    const root = await open();

    fill(root, 'new@example.com', password);
    submit(root);
    http.expectOne('/api/auth/register').error(new ProgressEvent('error'));
    harness.detectChanges();

    expect(alertText(root)).toBe('We could not reach the server. Check your connection and try again.');
  });

  it('asks to sign in when the account was created but the automatic sign in failed', async () => {
    const root = await open();

    fill(root, 'new@example.com', password);
    submit(root);
    http.expectOne('/api/auth/register').flush({ userId: signInAnswer.userId, email: 'new@example.com' });
    http.expectOne('/api/auth/login').error(new ProgressEvent('error'));
    harness.detectChanges();

    expect(alertText(root)).toBe('Your account was created, but we could not sign you in. Sign in to continue.');
    expect(state.isAuthenticated()).toBe(false);
  });

  it('shows a loading state and ignores a second submit', async () => {
    const root = await open();

    fill(root, 'new@example.com', password);
    submit(root);
    submit(root);
    const button = root.querySelector('[data-testid="register-submit"]') as HTMLButtonElement;

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Creating account');
    http.expectOne('/api/auth/register').flush({ userId: signInAnswer.userId, email: 'new@example.com' });
    http.expectOne('/api/auth/login').flush(signInAnswer);
    await harness.fixture.whenStable();
  });

  it('links to the sign in keeping the return address and keeps 44 px targets', async () => {
    const root = await open('/account/register?returnUrl=%2Fhotels%2Fabc');

    const link = root.querySelector('[data-testid="register-sign-in-link"]');
    expect(link?.textContent?.trim()).toBe('Sign in');
    expect(link?.getAttribute('href')).toBe('/account/sign-in?returnUrl=%2Fhotels%2Fabc');
    for (const element of Array.from(root.querySelectorAll('input, button, a'))) {
      expect(element.className).toMatch(/min-h-11|h-11/);
    }
  });
});
