import { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const emailMaximumLength = 254;
const passwordMinimumLength = 8;
const passwordMaximumLength = 128;

export const passwordRulesHint = 'Use 8 to 128 characters with at least one letter and one digit.';

const emailMessages: Record<string, string> = {
  required: 'Enter your email address.',
  email: 'Enter a valid email address.',
  emailTooLong: 'The email address can have at most 254 characters.',
};

const passwordMessages: Record<string, string> = {
  required: 'Enter a password.',
  passwordTooShort: 'Use at least 8 characters.',
  passwordTooLong: 'Use at most 128 characters.',
  passwordLetter: 'Include at least one letter.',
  passwordDigit: 'Include at least one digit.',
};

function isAccountEmail(email: string): boolean {
  const separator = email.indexOf('@');
  if (separator <= 0 || separator !== email.lastIndexOf('@') || separator === email.length - 1) {
    return false;
  }
  const localPart = email.slice(0, separator);
  const domain = email.slice(separator + 1);
  if (localPart.includes(' ') || domain.includes(' ')) {
    return false;
  }
  const dot = domain.indexOf('.');
  return dot > 0 && dot < domain.length - 1;
}

export const accountEmailValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const email = String(control.value ?? '').trim();
  if (email === '') {
    return null;
  }
  if (email.length > emailMaximumLength) {
    return { emailTooLong: true };
  }
  return isAccountEmail(email) ? null : { email: true };
};

export const accountPasswordValidator: ValidatorFn = (control: AbstractControl): ValidationErrors | null => {
  const password = String(control.value ?? '');
  if (password === '') {
    return null;
  }
  if (password.length < passwordMinimumLength) {
    return { passwordTooShort: true };
  }
  if (password.length > passwordMaximumLength) {
    return { passwordTooLong: true };
  }
  if (!/\p{L}/u.test(password)) {
    return { passwordLetter: true };
  }
  return /\p{Nd}/u.test(password) ? null : { passwordDigit: true };
};

function messageFor(control: AbstractControl, messages: Record<string, string>): string | null {
  const server: unknown = control.getError('server');
  if (typeof server === 'string') {
    return server;
  }
  const key = Object.keys(messages).find((name) => control.hasError(name));
  return key === undefined ? null : messages[key];
}

export function emailFieldMessage(control: AbstractControl): string | null {
  return messageFor(control, emailMessages);
}

export function passwordFieldMessage(control: AbstractControl): string | null {
  return messageFor(control, passwordMessages);
}
