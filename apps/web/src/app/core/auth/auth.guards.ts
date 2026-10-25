import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthState } from './auth-state.service';

export const authenticatedGuard: CanActivateFn = (_route, state) => {
  const authState = inject(AuthState);
  const router = inject(Router);

  return authState.isAuthenticated()
    ? true
    : router.createUrlTree(['/admin', 'login'], { queryParams: { returnUrl: state.url } });
};

export const administratorGuard: CanActivateFn = () => {
  const authState = inject(AuthState);
  const router = inject(Router);

  return authState.hasRole('Administrator') ? true : router.createUrlTree(['/']);
};

export const guestGuard: CanActivateFn = () => {
  const authState = inject(AuthState);
  const router = inject(Router);

  return authState.isAuthenticated() ? router.createUrlTree(['/admin']) : true;
};
