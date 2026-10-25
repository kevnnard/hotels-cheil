export type UserRole = 'Administrator' | 'User';

export interface Session {
  readonly email: string;
  readonly role: UserRole;
}
