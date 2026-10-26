import { computed, inject, Injectable, InjectionToken, signal } from '@angular/core';
import { DOCUMENT } from '@angular/common';
import { administratorRole, Session } from './session';

export const sessionStorageKey = 'aurea.admin.session';

export const SESSION_STORAGE = new InjectionToken<Storage | null>('SESSION_STORAGE', {
  providedIn: 'root',
  factory: () => {
    try {
      return inject(DOCUMENT).defaultView?.sessionStorage ?? null;
    } catch {
      return null;
    }
  },
});

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function isUnexpired(expiresAtUtc: string, now: number): boolean {
  const expiresAt = Date.parse(expiresAtUtc);
  return !Number.isNaN(expiresAt) && expiresAt > now;
}

function toSession(value: unknown, now: number): Session | null {
  if (typeof value !== 'object' || value === null) {
    return null;
  }
  const candidate = value as Record<string, unknown>;
  const { accessToken, email, roles, expiresAtUtc } = candidate;
  if (
    typeof accessToken !== 'string' ||
    accessToken === '' ||
    typeof email !== 'string' ||
    !isStringArray(roles) ||
    typeof expiresAtUtc !== 'string' ||
    !isUnexpired(expiresAtUtc, now)
  ) {
    return null;
  }
  return { accessToken, email, roles, expiresAtUtc };
}

function parse(raw: string): unknown {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

@Injectable({ providedIn: 'root' })
export class AuthState {
  private readonly storage = inject(SESSION_STORAGE);
  private readonly currentSession = signal<Session | null>(null);
  private readonly settled = signal(false);
  private markSettled: () => void = () => undefined;
  private readonly settledPromise = new Promise<void>((resolve) => (this.markSettled = resolve));

  readonly session = this.currentSession.asReadonly();
  readonly isSettled = this.settled.asReadonly();
  readonly isAuthenticated = computed(() => this.currentSession() !== null);
  readonly isAdministrator = computed(() => this.currentSession()?.roles.includes(administratorRole) ?? false);
  readonly accessToken = computed(() => this.currentSession()?.accessToken ?? null);
  readonly email = computed(() => this.currentSession()?.email ?? null);

  whenSettled(): Promise<void> {
    return this.settledPromise;
  }

  settle(): void {
    this.settled.set(true);
    this.markSettled();
  }

  signIn(session: Session): void {
    this.currentSession.set(session);
    this.write(JSON.stringify(session));
    this.settle();
  }

  clear(): void {
    this.currentSession.set(null);
    this.remove();
    this.settle();
  }

  readPersisted(): Session | null {
    const raw = this.read();
    if (raw === null) {
      return null;
    }
    const session = toSession(parse(raw), Date.now());
    if (session === null) {
      this.remove();
    }
    return session;
  }

  discardIfExpired(): void {
    const session = this.currentSession();
    if (session !== null && !isUnexpired(session.expiresAtUtc, Date.now())) {
      this.clear();
    }
  }

  private read(): string | null {
    try {
      return this.storage?.getItem(sessionStorageKey) ?? null;
    } catch {
      return null;
    }
  }

  private write(value: string): void {
    try {
      this.storage?.setItem(sessionStorageKey, value);
    } catch {
      return;
    }
  }

  private remove(): void {
    try {
      this.storage?.removeItem(sessionStorageKey);
    } catch {
      return;
    }
  }
}
