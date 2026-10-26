import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { REDIRECT_ON_UNAUTHORIZED } from './auth-api.service';
import { AuthState, sessionStorageKey } from './auth-state.service';
import { SignInResponse } from './auth.models';
import { AuthService } from './auth.service';
import { Session } from './session';

const future = '2999-01-01T00:00:00Z';

const signInResponse: SignInResponse = {
  accessToken: 'token-123',
  expiresAtUtc: future,
  sessionId: '00000000-0000-4000-8000-000000000001',
  userId: '00000000-0000-4000-8000-000000000002',
  email: 'admin@example.com',
  roles: ['Administrator'],
};

const stored: Session = {
  accessToken: 'stored-token',
  email: 'admin@example.com',
  roles: ['Administrator'],
  expiresAtUtc: future,
};

describe('AuthService', () => {
  let service: AuthService;
  let state: AuthState;
  let http: HttpTestingController;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), provideRouter([])],
    });
    service = TestBed.inject(AuthService);
    state = TestBed.inject(AuthState);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  describe('signIn', () => {
    it('posts the credentials and stores the returned session', async () => {
      const result = firstValueFrom(service.signIn({ email: 'admin@example.com', password: 'Secret123' }));

      const request = http.expectOne('/api/auth/login');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ email: 'admin@example.com', password: 'Secret123' });
      request.flush(signInResponse);

      expect(await result).toEqual({
        accessToken: 'token-123',
        email: 'admin@example.com',
        roles: ['Administrator'],
        expiresAtUtc: future,
      });
      expect(state.accessToken()).toBe('token-123');
      expect(state.isAdministrator()).toBe(true);
      expect(sessionStorage.getItem(sessionStorageKey)).not.toBeNull();
    });

    it('keeps the session of an account with the User role and never revokes it', async () => {
      const result = firstValueFrom(service.signIn({ email: 'user@example.com', password: 'Secret123' }));

      http.expectOne('/api/auth/login').flush({ ...signInResponse, email: 'user@example.com', roles: ['User'] });
      await result;

      http.expectNone('/api/auth/logout');
      expect(state.isAuthenticated()).toBe(true);
      expect(state.isAdministrator()).toBe(false);
      expect(state.email()).toBe('user@example.com');
    });

    it('stores nothing when the credentials are rejected', async () => {
      const result = firstValueFrom(service.signIn({ email: 'admin@example.com', password: 'Wrong1234' }));

      http.expectOne('/api/auth/login').flush({ title: 'x' }, { status: 401, statusText: 'Unauthorized' });

      await expect(result).rejects.toBeInstanceOf(HttpErrorResponse);
      expect(state.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(sessionStorageKey)).toBeNull();
    });
  });

  describe('register', () => {
    it('posts the credentials to the registration endpoint and stores no session', async () => {
      const result = firstValueFrom(service.register({ email: 'new@example.com', password: 'Secret123' }));

      const request = http.expectOne('/api/auth/register');
      expect(request.request.method).toBe('POST');
      expect(request.request.body).toEqual({ email: 'new@example.com', password: 'Secret123' });
      expect(request.request.context.get(REDIRECT_ON_UNAUTHORIZED)).toBe(false);
      request.flush({ userId: signInResponse.userId, email: 'new@example.com' }, { status: 201, statusText: 'Created' });

      expect(await result).toEqual({ userId: signInResponse.userId, email: 'new@example.com' });
      expect(state.isAuthenticated()).toBe(false);
    });

    it('reports a conflict unchanged', async () => {
      const result = firstValueFrom(service.register({ email: 'taken@example.com', password: 'Secret123' }));

      http.expectOne('/api/auth/register').flush({ title: 'x' }, { status: 409, statusText: 'Conflict' });

      await expect(result).rejects.toMatchObject({ status: 409 });
      expect(state.isAuthenticated()).toBe(false);
    });
  });

  describe('restore', () => {
    it('settles at once without a stored session and makes no request', () => {
      service.restore();

      expect(state.isSettled()).toBe(true);
      expect(state.isAuthenticated()).toBe(false);
      http.expectNone('/api/auth/me');
    });

    it('validates the stored session with GET /api/auth/me and refreshes it from the answer', () => {
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(stored));

      service.restore();
      expect(state.isSettled()).toBe(false);
      expect(state.isAuthenticated()).toBe(false);

      const request = http.expectOne('/api/auth/me');
      expect(request.request.method).toBe('GET');
      expect(request.request.headers.get('Authorization')).toBe('Bearer stored-token');
      request.flush({
        userId: signInResponse.userId,
        email: 'admin@example.com',
        roles: ['Administrator', 'User'],
        sessionId: signInResponse.sessionId,
        expiresAtUtc: '2998-01-01T00:00:00Z',
      });

      expect(state.isSettled()).toBe(true);
      expect(state.accessToken()).toBe('stored-token');
      expect(state.session()?.roles).toEqual(['Administrator', 'User']);
      expect(state.session()?.expiresAtUtc).toBe('2998-01-01T00:00:00Z');
    });

    it('discards an invalid stored session silently', () => {
      const navigate = vi.spyOn(TestBed.inject(Router), 'navigate');
      const navigateByUrl = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
      sessionStorage.setItem(sessionStorageKey, JSON.stringify(stored));

      service.restore();
      http.expectOne('/api/auth/me').flush(null, { status: 401, statusText: 'Unauthorized' });

      expect(state.isSettled()).toBe(true);
      expect(state.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(sessionStorageKey)).toBeNull();
      expect(navigate).not.toHaveBeenCalled();
      expect(navigateByUrl).not.toHaveBeenCalled();
    });

    it('discards an expired stored session without asking the API', () => {
      sessionStorage.setItem(sessionStorageKey, JSON.stringify({ ...stored, expiresAtUtc: '2000-01-01T00:00:00Z' }));

      service.restore();

      http.expectNone('/api/auth/me');
      expect(state.isSettled()).toBe(true);
      expect(state.isAuthenticated()).toBe(false);
    });
  });

  describe('signOut', () => {
    it('revokes the session on the API with its token and clears the local state', async () => {
      state.signIn(stored);

      const done = firstValueFrom(service.signOut(), { defaultValue: undefined });
      const request = http.expectOne('/api/auth/logout');
      expect(request.request.method).toBe('POST');
      expect(request.request.headers.get('Authorization')).toBe('Bearer stored-token');
      request.flush(null, { status: 204, statusText: 'No Content' });
      await done;

      expect(state.isAuthenticated()).toBe(false);
      expect(sessionStorage.getItem(sessionStorageKey)).toBeNull();
    });

    it.each([
      ['a server error', { status: 500, statusText: 'Server Error' }],
      ['an expired token', { status: 401, statusText: 'Unauthorized' }],
    ])('clears the local state even when the API answers %s', async (_case, failure) => {
      state.signIn(stored);

      const done = firstValueFrom(service.signOut(), { defaultValue: undefined });
      http.expectOne('/api/auth/logout').flush(null, failure);

      await expect(done).resolves.toBeUndefined();
      expect(state.isAuthenticated()).toBe(false);
    });

    it('clears the local state when the network fails', async () => {
      state.signIn(stored);

      const done = firstValueFrom(service.signOut(), { defaultValue: undefined });
      http.expectOne('/api/auth/logout').error(new ProgressEvent('error'));

      await expect(done).resolves.toBeUndefined();
      expect(state.isAuthenticated()).toBe(false);
    });

    it('makes no request without a session', async () => {
      await firstValueFrom(service.signOut(), { defaultValue: undefined });

      http.expectNone('/api/auth/logout');
      expect(state.isAuthenticated()).toBe(false);
    });
  });
});
