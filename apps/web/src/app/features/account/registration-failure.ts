import { HttpErrorResponse } from '@angular/common/http';
import { describeLoginFailure, LoginFailure } from '../auth/login-failure';

export const duplicateEmailMessage = 'This email address is already registered. Sign in instead.';
export const duplicateEmailFieldMessage = 'This email address is already registered.';
export const signInAfterRegistrationMessage =
  'Your account was created, but we could not sign you in. Sign in to continue.';

export function describeRegistrationFailure(error: unknown): LoginFailure {
  if (error instanceof HttpErrorResponse && error.status === 409) {
    return { message: duplicateEmailMessage, fieldErrors: { email: duplicateEmailFieldMessage } };
  }
  return describeLoginFailure(error);
}
