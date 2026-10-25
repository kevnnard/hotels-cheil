import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { administratorGuard, authenticatedGuard, guestGuard } from './auth.guards';
import { AuthState } from './auth-state.service';

const route = {} as ActivatedRouteSnapshot;

function stateFor(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

function asUrl(result: unknown): string {
  return TestBed.inject(Router).serializeUrl(result as UrlTree);
}

describe('access guards', () => {
  let authState: AuthState;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    authState = TestBed.inject(AuthState);
  });

  describe('authenticatedGuard', () => {
    it('redirects an anonymous visitor to the login with the requested address', () => {
      const result = TestBed.runInInjectionContext(() =>
        authenticatedGuard(route, stateFor('/admin/hotels')),
      );

      expect(asUrl(result)).toBe('/admin/login?returnUrl=%2Fadmin%2Fhotels');
    });

    it('allows a signed in administrator', () => {
      authState.signIn({ email: 'admin@example.com', role: 'Administrator' });

      const result = TestBed.runInInjectionContext(() => authenticatedGuard(route, stateFor('/admin')));

      expect(result).toBe(true);
    });

    it('allows a signed in user', () => {
      authState.signIn({ email: 'user@example.com', role: 'User' });

      const result = TestBed.runInInjectionContext(() => authenticatedGuard(route, stateFor('/admin')));

      expect(result).toBe(true);
    });

    it('redirects again after the session is closed', () => {
      authState.signIn({ email: 'admin@example.com', role: 'Administrator' });
      authState.signOut();

      const result = TestBed.runInInjectionContext(() => authenticatedGuard(route, stateFor('/admin')));

      expect(asUrl(result)).toBe('/admin/login?returnUrl=%2Fadmin');
    });
  });

  describe('administratorGuard', () => {
    it('allows an administrator', () => {
      authState.signIn({ email: 'admin@example.com', role: 'Administrator' });

      const result = TestBed.runInInjectionContext(() => administratorGuard(route, stateFor('/admin')));

      expect(result).toBe(true);
    });

    it('sends a signed in user without the administrator role to the public home', () => {
      authState.signIn({ email: 'user@example.com', role: 'User' });

      const result = TestBed.runInInjectionContext(() => administratorGuard(route, stateFor('/admin')));

      expect(asUrl(result)).toBe('/');
    });

    it('sends an anonymous visitor to the public home', () => {
      const result = TestBed.runInInjectionContext(() => administratorGuard(route, stateFor('/admin')));

      expect(asUrl(result)).toBe('/');
    });
  });

  describe('guestGuard', () => {
    it('allows an anonymous visitor to open the login', () => {
      const result = TestBed.runInInjectionContext(() => guestGuard(route, stateFor('/admin/login')));

      expect(result).toBe(true);
    });

    it('sends a signed in administrator away from the login to the admin area', () => {
      authState.signIn({ email: 'admin@example.com', role: 'Administrator' });

      const result = TestBed.runInInjectionContext(() => guestGuard(route, stateFor('/admin/login')));

      expect(asUrl(result)).toBe('/admin');
    });
  });
});
