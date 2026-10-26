import { TestBed } from '@angular/core/testing';
import { AuthState, sessionStorageKey } from './auth-state.service';
import { Session } from './session';

const future = '2999-01-01T00:00:00Z';

const administrator: Session = {
  accessToken: 'token-administrator',
  email: 'admin@example.com',
  roles: ['Administrator'],
  expiresAtUtc: future,
};

describe('AuthState', () => {
  let state: AuthState;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({});
    state = TestBed.inject(AuthState);
  });

  afterEach(() => sessionStorage.clear());

  it('starts anonymous with the restoration pending', () => {
    expect(state.isAuthenticated()).toBe(false);
    expect(state.isSettled()).toBe(false);
    expect(state.accessToken()).toBeNull();
  });

  it('holds the token, email, roles and expiry after a sign in and persists them under one key', () => {
    state.signIn(administrator);

    expect(state.isAuthenticated()).toBe(true);
    expect(state.isSettled()).toBe(true);
    expect(state.accessToken()).toBe('token-administrator');
    expect(state.email()).toBe('admin@example.com');
    expect(state.session()?.roles).toEqual(['Administrator']);
    expect(state.session()?.expiresAtUtc).toBe(future);
    expect(sessionStorage.length).toBe(1);
    expect(JSON.parse(sessionStorage.getItem(sessionStorageKey) ?? 'null')).toEqual(administrator);
  });

  it('recognises the administrator only from the roles array', () => {
    state.signIn({ ...administrator, roles: ['User', 'Administrator'] });
    expect(state.isAdministrator()).toBe(true);

    state.signIn({ ...administrator, roles: ['User'] });
    expect(state.isAdministrator()).toBe(false);

    state.signIn({ ...administrator, roles: [] });
    expect(state.isAdministrator()).toBe(false);
  });

  it('clears the signals and the stored session', () => {
    state.signIn(administrator);

    state.clear();

    expect(state.isAuthenticated()).toBe(false);
    expect(state.email()).toBeNull();
    expect(sessionStorage.getItem(sessionStorageKey)).toBeNull();
  });

  it('resolves the settled promise once the restoration ends', async () => {
    let settled = false;
    void state.whenSettled().then(() => (settled = true));
    await Promise.resolve();
    expect(settled).toBe(false);

    state.settle();
    await state.whenSettled();

    expect(settled).toBe(true);
  });

  it('reads a valid stored session', () => {
    sessionStorage.setItem(sessionStorageKey, JSON.stringify(administrator));

    expect(state.readPersisted()).toEqual(administrator);
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['a missing token', JSON.stringify({ ...administrator, accessToken: '' })],
    ['roles that are not an array', JSON.stringify({ ...administrator, roles: 'Administrator' })],
    ['roles that are not strings', JSON.stringify({ ...administrator, roles: [1] })],
    ['an unreadable expiry', JSON.stringify({ ...administrator, expiresAtUtc: 'soon' })],
    ['an expired session', JSON.stringify({ ...administrator, expiresAtUtc: '2000-01-01T00:00:00Z' })],
    ['a non object', JSON.stringify('token')],
  ])('discards a stored session with %s', (_case, stored) => {
    sessionStorage.setItem(sessionStorageKey, stored);

    expect(state.readPersisted()).toBeNull();
    expect(sessionStorage.getItem(sessionStorageKey)).toBeNull();
  });

  it('discards the current session when it has expired', () => {
    state.signIn({ ...administrator, expiresAtUtc: '2000-01-01T00:00:00Z' });

    state.discardIfExpired();

    expect(state.isAuthenticated()).toBe(false);
  });

  it('keeps the current session while it is valid', () => {
    state.signIn(administrator);

    state.discardIfExpired();

    expect(state.isAuthenticated()).toBe(true);
  });
});
