import { HttpClient, HttpContext, HttpContextToken, HttpHeaders } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CurrentAccountResponse, RegisteredAccount, SignInCredentials, SignInResponse } from './auth.models';

export const REDIRECT_ON_UNAUTHORIZED = new HttpContextToken<boolean>(() => true);

const authUrl = '/api/auth';

function withoutUnauthorizedRedirect(): HttpContext {
  return new HttpContext().set(REDIRECT_ON_UNAUTHORIZED, false);
}

function bearer(accessToken: string): HttpHeaders {
  return new HttpHeaders({ Authorization: `Bearer ${accessToken}` });
}

@Injectable({ providedIn: 'root' })
export class AuthApi {
  private readonly http = inject(HttpClient);

  register(credentials: SignInCredentials): Observable<RegisteredAccount> {
    return this.http.post<RegisteredAccount>(`${authUrl}/register`, credentials, {
      context: withoutUnauthorizedRedirect(),
    });
  }

  login(credentials: SignInCredentials): Observable<SignInResponse> {
    return this.http.post<SignInResponse>(`${authUrl}/login`, credentials, { context: withoutUnauthorizedRedirect() });
  }

  me(accessToken: string): Observable<CurrentAccountResponse> {
    return this.http.get<CurrentAccountResponse>(`${authUrl}/me`, {
      headers: bearer(accessToken),
      context: withoutUnauthorizedRedirect(),
    });
  }

  logout(accessToken: string): Observable<void> {
    return this.http.post<void>(`${authUrl}/logout`, null, {
      headers: bearer(accessToken),
      context: withoutUnauthorizedRedirect(),
    });
  }
}
