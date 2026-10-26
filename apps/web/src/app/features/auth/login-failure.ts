import { HttpErrorResponse } from '@angular/common/http';

export type LoginField = 'email' | 'password';

export interface LoginFailure {
  readonly message: string;
  readonly fieldErrors: Partial<Record<LoginField, string>>;
}

export const invalidCredentialsMessage = 'Invalid email or password.';
export const invalidFieldsMessage = 'Check the highlighted fields and try again.';
export const networkFailureMessage = 'We could not reach the server. Check your connection and try again.';
export const unexpectedFailureMessage = 'Something went wrong. Please try again.';
export const accessDeniedMessage = 'This account does not have access to the administration area.';

const loginFields: readonly LoginField[] = ['email', 'password'];

function toLoginField(key: string): LoginField | null {
  const normalized = key.replace(/^\$\./, '').toLowerCase();
  return loginFields.find((field) => field === normalized) ?? null;
}

function firstMessage(value: unknown): string | null {
  const messages = Array.isArray(value) ? value : [value];
  const message = messages.find((item): item is string => typeof item === 'string' && item.trim() !== '');
  return message ?? null;
}

function readFieldErrors(body: unknown): Partial<Record<LoginField, string>> {
  const errors = typeof body === 'object' && body !== null ? (body as { errors?: unknown }).errors : null;
  if (typeof errors !== 'object' || errors === null) {
    return {};
  }
  const fieldErrors: Partial<Record<LoginField, string>> = {};
  for (const [key, value] of Object.entries(errors)) {
    const field = toLoginField(key);
    const message = firstMessage(value);
    if (field !== null && message !== null && fieldErrors[field] === undefined) {
      fieldErrors[field] = message;
    }
  }
  return fieldErrors;
}

export function describeLoginFailure(error: unknown): LoginFailure {
  if (!(error instanceof HttpErrorResponse)) {
    return { message: unexpectedFailureMessage, fieldErrors: {} };
  }
  switch (error.status) {
    case 0:
      return { message: networkFailureMessage, fieldErrors: {} };
    case 400:
      return { message: invalidFieldsMessage, fieldErrors: readFieldErrors(error.error) };
    case 401:
      return { message: invalidCredentialsMessage, fieldErrors: {} };
    default:
      return { message: unexpectedFailureMessage, fieldErrors: {} };
  }
}
