import { inject } from '@angular/core';
import { CanActivateFn, GuardResult, MaybeAsync, Router, UrlTree } from '@angular/router';
import { from, map } from 'rxjs';
import { AuthState } from './auth-state.service';
import { resolveVisitorReturnUrl } from './return-url';

function afterRestoration(decide: () => GuardResult): MaybeAsync<GuardResult> {
  const authState = inject(AuthState);
  return authState.isSettled() ? decide() : from(authState.whenSettled()).pipe(map(decide));
}

function loginFor(router: Router, returnUrl: string): UrlTree {
  return router.createUrlTree(['/admin', 'login'], { queryParams: { returnUrl } });
}

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const authState = inject(AuthState);
  const router = inject(Router);

  return afterRestoration(() => {
    authState.discardIfExpired();
    return authState.isAuthenticated() ? true : loginFor(router, state.url);
  });
};

export const administratorGuard: CanActivateFn = (_route, state) => {
  const authState = inject(AuthState);
  const router = inject(Router);

  return afterRestoration(() => {
    authState.discardIfExpired();
    if (!authState.isAuthenticated()) {
      return loginFor(router, state.url);
    }
    return authState.isAdministrator()
      ? true
      : router.createUrlTree(['/admin', 'login'], { queryParams: { reason: 'forbidden' } });
  });
};

export const guestGuard: CanActivateFn = () => {
  const authState = inject(AuthState);
  const router = inject(Router);

  return afterRestoration(() => {
    authState.discardIfExpired();
    return authState.isAdministrator() ? router.createUrlTree(['/admin']) : true;
  });
};

export const visitorGuestGuard: CanActivateFn = (route) => {
  const authState = inject(AuthState);
  const router = inject(Router);

  return afterRestoration(() => {
    authState.discardIfExpired();
    return authState.isAuthenticated()
      ? router.parseUrl(resolveVisitorReturnUrl(route.queryParamMap.get('returnUrl')))
      : true;
  });
};
