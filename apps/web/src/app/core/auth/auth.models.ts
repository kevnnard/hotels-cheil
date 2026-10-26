export interface SignInCredentials {
  readonly email: string;
  readonly password: string;
}

export interface SignInResponse {
  readonly accessToken: string;
  readonly expiresAtUtc: string;
  readonly sessionId: string;
  readonly userId: string;
  readonly email: string;
  readonly roles: readonly string[];
}

export interface CurrentAccountResponse {
  readonly userId: string;
  readonly email: string;
  readonly roles: readonly string[];
  readonly sessionId: string;
  readonly expiresAtUtc: string;
}

export interface RegisteredAccount {
  readonly userId: string;
  readonly email: string;
}
