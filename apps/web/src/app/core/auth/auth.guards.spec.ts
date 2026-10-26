import { TestBed } from '@angular/core/testing';
import { ActivatedRouteSnapshot, GuardResult, MaybeAsync, provideRouter, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { firstValueFrom, isObservable } from 'rxjs';
import { administratorGuard, authenticatedGuard, guestGuard, visitorGuestGuard } from './auth.guards';
import { AuthState } from './auth-state.service';
import { Session } from './session';

const route = {} as ActivatedRouteSnapshot;

const administrator: Session = {
  accessToken: 'token-administrator',
  email: 'admin@example.com',
  roles: ['Administrator'],
  expiresAtUtc: '2999-01-01T00:00:00Z',
};

const user: Session = { ...administrator, accessToken: 'token-user', email: 'user@example.com', roles: ['User'] };

function stateFor(url: string): RouterStateSnapshot {
  return { url } as RouterStateSnapshot;
}

async function settle(result: MaybeAsync<GuardResult>): Promise<GuardResult> {
  return isObservable(result) ? firstValueFrom(result) : await result;
}

function asUrl(result: GuardResult): string {
  return TestBed.inject(Router).serializeUrl(result as UrlTree);
}

describe('access guards', () => {
  let authState: AuthState;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({ providers: [provideRouter([])] });
    authState = TestBed.inject(AuthState);
  });

  afterEach(() => sessionStorage.clear());

  describe('authenticatedGuard', () => {
    const run = (url: string) => TestBed.runInInjectionContext(() => authenticatedGuard(route, stateFor(url)));

    it('waits for the session restoration before deciding', async () => {
      let decided: GuardResult | undefined;
      void settle(run('/admin')).then((result) => (decided = result));
      await Promise.resolve();
      expect(decided).toBeUndefined();

      authState.signIn(administrator);
      await new Promise((resolve) => setTimeout(resolve, 0));

      expect(decided).toBe(true);
    });

    it('redirects when the restoration ends without a session', async () => {
      const pending = settle(run('/admin/hotels'));

      authState.settle();

      expect(asUrl(await pending)).toBe('/admin/login?returnUrl=%2Fadmin%2Fhotels');
    });

    it('redirects an anonymous visitor to the login with the requested address', async () => {
      authState.settle();

      expect(asUrl(await settle(run('/admin/hotels')))).toBe('/admin/login?returnUrl=%2Fadmin%2Fhotels');
    });

    it('allows a signed in account', async () => {
      authState.signIn(user);

      expect(await settle(run('/admin'))).toBe(true);
    });

    it('discards an expired session and redirects', async () => {
      authState.signIn({ ...administrator, expiresAtUtc: '2000-01-01T00:00:00Z' });

      expect(asUrl(await settle(run('/admin')))).toBe('/admin/login?returnUrl=%2Fadmin');
      expect(authState.isAuthenticated()).toBe(false);
    });

    it('redirects again after the session is closed', async () => {
      authState.signIn(administrator);
      authState.clear();

      expect(asUrl(await settle(run('/admin')))).toBe('/admin/login?returnUrl=%2Fadmin');
    });
  });

  describe('administratorGuard', () => {
    const run = (url: string) => TestBed.runInInjectionContext(() => administratorGuard(route, stateFor(url)));

    it('allows an administrator', async () => {
      authState.signIn(administrator);

      expect(await settle(run('/admin'))).toBe(true);
    });

    it('sends a signed in account without the administrator role to the login with a reason', async () => {
      authState.signIn(user);

      expect(asUrl(await settle(run('/admin')))).toBe('/admin/login?reason=forbidden');
    });

    it('sends an anonymous visitor to the login with the requested address', async () => {
      authState.settle();

      expect(asUrl(await settle(run('/admin')))).toBe('/admin/login?returnUrl=%2Fadmin');
    });

    it('waits for the restoration before deciding', async () => {
      const pending = settle(run('/admin'));

      authState.signIn(administrator);

      expect(await pending).toBe(true);
    });
  });

  describe('guestGuard', () => {
    const run = () => TestBed.runInInjectionContext(() => guestGuard(route, stateFor('/admin/login')));

    it('allows an anonymous visitor to open the login', async () => {
      authState.settle();

      expect(await settle(run())).toBe(true);
    });

    it('sends a signed in administrator away from the login to the admin area', async () => {
      authState.signIn(administrator);

      expect(asUrl(await settle(run()))).toBe('/admin');
    });

    it('lets a signed in account without the administrator role see the login', async () => {
      authState.signIn(user);

      expect(await settle(run())).toBe(true);
    });

    it('waits for the restoration before deciding', async () => {
      const pending = settle(run());

      authState.signIn(administrator);

      expect(asUrl(await pending)).toBe('/admin');
    });
  });

  describe('visitorGuestGuard', () => {
    function routeWith(returnUrl: string | null): ActivatedRouteSnapshot {
      const router = TestBed.inject(Router);
      const query = returnUrl === null ? '' : `?returnUrl=${encodeURIComponent(returnUrl)}`;
      const tree = router.parseUrl(`/account/sign-in${query}`);
      return { queryParamMap: tree.queryParamMap } as ActivatedRouteSnapshot;
    }

    const run = (returnUrl: string | null = null) =>
      TestBed.runInInjectionContext(() => visitorGuestGuard(routeWith(returnUrl), stateFor('/account/sign-in')));

    it('allows an anonymous visitor to open the visitor pages', async () => {
      authState.settle();

      expect(await settle(run('/hotels/abc'))).toBe(true);
    });

    it.each([
      ['a user', user],
      ['an administrator', administrator],
    ])('sends %s to the safe return address', async (_case, session) => {
      authState.signIn(session);

      expect(asUrl(await settle(run('/hotels/abc')))).toBe('/hotels/abc');
    });

    it.each([null, '//evil.com', 'https://evil.com', '/account/register'])(
      'sends a signed in account to the public home when the return address is %j',
      async (returnUrl) => {
        authState.signIn(user);

        expect(asUrl(await settle(run(returnUrl)))).toBe('/');
      },
    );

    it('waits for the restoration before deciding', async () => {
      const pending = settle(run('/hotels/abc'));

      authState.signIn(user);

      expect(asUrl(await pending)).toBe('/hotels/abc');
    });

    it('lets a visitor in once an expired session is discarded', async () => {
      authState.signIn({ ...user, expiresAtUtc: '2000-01-01T00:00:00Z' });

      expect(await settle(run())).toBe(true);
      expect(authState.isAuthenticated()).toBe(false);
    });
  });
});
