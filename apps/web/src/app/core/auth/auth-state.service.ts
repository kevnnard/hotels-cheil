import { computed, Injectable, signal } from '@angular/core';
import { Session, UserRole } from './session';

@Injectable({ providedIn: 'root' })
export class AuthState {
  private readonly currentSession = signal<Session | null>(null);

  readonly session = this.currentSession.asReadonly();
  readonly isAuthenticated = computed(() => this.currentSession() !== null);

  hasRole(role: UserRole): boolean {
    return this.currentSession()?.role === role;
  }

  signIn(session: Session): void {
    this.currentSession.set(session);
  }

  signOut(): void {
    this.currentSession.set(null);
  }
}
