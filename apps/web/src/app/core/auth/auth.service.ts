import { inject, Injectable } from '@angular/core';
import { catchError, finalize, map, Observable, of, tap } from 'rxjs';
import { AuthApi } from './auth-api.service';
import { AuthState } from './auth-state.service';
import { RegisteredAccount, SignInCredentials } from './auth.models';
import { Session } from './session';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(AuthApi);
  private readonly state = inject(AuthState);

  signIn(credentials: SignInCredentials): Observable<Session> {
    return this.api.login(credentials).pipe(
      map(({ accessToken, email, roles, expiresAtUtc }) => ({ accessToken, email, roles, expiresAtUtc })),
      tap((session) => this.state.signIn(session)),
    );
  }

  register(credentials: SignInCredentials): Observable<RegisteredAccount> {
    return this.api.register(credentials);
  }

  restore(): void {
    const stored = this.state.readPersisted();
    if (stored === null) {
      this.state.settle();
      return;
    }
    this.api.me(stored.accessToken).subscribe({
      next: ({ email, roles, expiresAtUtc }) =>
        this.state.signIn({ accessToken: stored.accessToken, email, roles, expiresAtUtc }),
      error: () => this.state.clear(),
    });
  }

  signOut(): Observable<void> {
    const accessToken = this.state.accessToken();
    if (accessToken === null) {
      this.state.clear();
      return of(undefined);
    }
    return this.api.logout(accessToken).pipe(
      map(() => undefined),
      catchError(() => of(undefined)),
      finalize(() => this.state.clear()),
    );
  }
}
