import { FormControl } from '@angular/forms';
import { accountEmailValidator, accountPasswordValidator, emailFieldMessage, passwordFieldMessage } from './account-rules';

function emailErrors(value: string) {
  return accountEmailValidator(new FormControl(value));
}

function passwordErrors(value: string) {
  return accountPasswordValidator(new FormControl(value));
}

describe('account rules mirrored from the API', () => {
  it.each(['guest@example.com', '  guest@example.com  ', 'a@b.co', 'first.last@sub.example.org'])(
    'accepts the email %j',
    (value) => {
      expect(emailErrors(value)).toBeNull();
    },
  );

  it.each(['plain', 'a@b', '@example.com', 'a@', 'a@@example.com', 'a b@example.com', 'a@exa mple.com', 'a@.com', 'a@example.'])(
    'rejects the email %j',
    (value) => {
      expect(emailErrors(value)).toEqual({ email: true });
    },
  );

  it('leaves an empty email to the required rule', () => {
    expect(emailErrors('')).toBeNull();
  });

  it('rejects an email longer than 254 characters', () => {
    expect(emailErrors(`${'a'.repeat(243)}@example.com`)).toEqual({ emailTooLong: true });
    expect(emailErrors(`${'a'.repeat(242)}@example.com`)).toBeNull();
  });

  it.each(['Secret12', 'ñandú123', 'a1'.repeat(64)])('accepts the password %j', (value) => {
    expect(passwordErrors(value)).toBeNull();
  });

  it.each([
    ['Short1', { passwordTooShort: true }],
    ['a1'.repeat(64) + 'x', { passwordTooLong: true }],
    ['abcdefgh', { passwordDigit: true }],
    ['12345678', { passwordLetter: true }],
  ])('rejects the password %j', (value, errors) => {
    expect(passwordErrors(value)).toEqual(errors);
  });

  it('describes each rule with a clear message', () => {
    const email = new FormControl('', { nonNullable: true });
    email.setErrors({ required: true });
    expect(emailFieldMessage(email)).toBe('Enter your email address.');
    email.setErrors({ email: true });
    expect(emailFieldMessage(email)).toBe('Enter a valid email address.');
    email.setErrors({ emailTooLong: true });
    expect(emailFieldMessage(email)).toBe('The email address can have at most 254 characters.');
    email.setErrors({ server: 'From the API.' });
    expect(emailFieldMessage(email)).toBe('From the API.');

    const password = new FormControl('', { nonNullable: true });
    for (const [error, message] of [
      ['required', 'Enter a password.'],
      ['passwordTooShort', 'Use at least 8 characters.'],
      ['passwordTooLong', 'Use at most 128 characters.'],
      ['passwordLetter', 'Include at least one letter.'],
      ['passwordDigit', 'Include at least one digit.'],
    ]) {
      password.setErrors({ [error]: true });
      expect(passwordFieldMessage(password)).toBe(message);
    }
  });
});
