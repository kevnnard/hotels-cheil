import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { DOCUMENT } from '@angular/common';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { REDIRECT_ON_UNAUTHORIZED } from '../auth/auth-api.service';
import { AuthState } from '../auth/auth-state.service';
import { isAdminAreaUrl, resolveReturnUrl } from '../auth/return-url';

function isSameOriginApi(url: string, document: Document): boolean {
  const origin = document.location.origin;
  let target: URL;
  try {
    target = new URL(url, document.baseURI);
  } catch {
    return false;
  }
  return target.origin === origin && (target.pathname === '/api' || target.pathname.startsWith('/api/'));
}

function attemptedUrl(router: Router): string {
  const navigation = router.currentNavigation();
  return navigation ? router.serializeUrl(navigation.finalUrl ?? navigation.initialUrl) : router.url;
}

function loginQueryParams(attempted: string): Record<string, string> {
  return resolveReturnUrl(attempted) === attempted ? { returnUrl: attempted } : {};
}

function withBearer(request: HttpRequest<unknown>, accessToken: string | null): HttpRequest<unknown> {
  return accessToken === null || request.headers.has('Authorization')
    ? request
    : request.clone({ setHeaders: { Authorization: `Bearer ${accessToken}` } });
}

export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const document = inject(DOCUMENT);
  if (!isSameOriginApi(request.url, document)) {
    return next(request);
  }
  const authState = inject(AuthState);
  const router = inject(Router);

  return next(withBearer(request, authState.accessToken())).pipe(
    catchError((error: unknown) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        request.context.get(REDIRECT_ON_UNAUTHORIZED)
      ) {
        const attempted = attemptedUrl(router);
        authState.clear();
        if (isAdminAreaUrl(attempted)) {
          void router.navigate(['/admin', 'login'], { queryParams: loginQueryParams(attempted) });
        }
      }
      return throwError(() => error);
    }),
  );
};
