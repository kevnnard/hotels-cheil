export const administratorRole = 'Administrator';

export interface Session {
  readonly accessToken: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly expiresAtUtc: string;
}
