import { isSafeReturnUrl, resolveReturnUrl, resolveVisitorReturnUrl } from './return-url';

describe('return address validation', () => {
  it.each(['/admin', '/admin/hotels?page=2', '/hotels/abc#rooms', '/'])('keeps the internal address %s', (value) => {
    expect(isSafeReturnUrl(value)).toBe(true);
    expect(resolveReturnUrl(value)).toBe(value);
  });

  it.each([
    '//evil.com',
    '//evil.com/admin',
    'https://x',
    'http://x/admin',
    '/\\evil.com',
    '\\\\evil.com',
    '/admin\\..\\x',
    'javascript:alert(1)',
    'admin',
    '',
    ' /admin',
    '/\t/evil.com',
    '/admin\nx',
  ])('rejects %j and falls back to the admin home', (value) => {
    expect(isSafeReturnUrl(value)).toBe(false);
    expect(resolveReturnUrl(value)).toBe('/admin');
  });

  it('falls back when the address is missing', () => {
    expect(resolveReturnUrl(null)).toBe('/admin');
    expect(resolveReturnUrl(undefined)).toBe('/admin');
  });

  it('never returns to the login itself', () => {
    expect(resolveReturnUrl('/admin/login')).toBe('/admin');
    expect(resolveReturnUrl('/admin/login?returnUrl=%2Fadmin')).toBe('/admin');
  });
});

describe('visitor return address validation', () => {
  it.each(['/', '/hotels/abc', '/hotels/abc?tab=1#rooms', '/admin'])('keeps the internal address %s', (value) => {
    expect(resolveVisitorReturnUrl(value)).toBe(value);
  });

  it.each(['//evil.com', 'https://x', '/\\evil.com', 'javascript:alert(1)', '', 'hotels'])(
    'rejects %j and falls back to the public home',
    (value) => {
      expect(resolveVisitorReturnUrl(value)).toBe('/');
    },
  );

  it('falls back when the address is missing', () => {
    expect(resolveVisitorReturnUrl(null)).toBe('/');
    expect(resolveVisitorReturnUrl(undefined)).toBe('/');
  });

  it.each(['/account/sign-in', '/account/register?returnUrl=%2F', '/admin/login', '/account/sign-in/x'])(
    'never returns to the sign in pages such as %s',
    (value) => {
      expect(resolveVisitorReturnUrl(value)).toBe('/');
    },
  );
});
