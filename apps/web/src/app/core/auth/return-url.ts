const adminHome = '/admin';
const publicHome = '/';
const adminLoginPath = '/admin/login';
const visitorSignInPaths: readonly string[] = [adminLoginPath, '/account/sign-in', '/account/register'];

function hasControlCharacter(value: string): boolean {
  return [...value].some((character) => {
    const code = character.charCodeAt(0);
    return code < 0x20 || code === 0x7f;
  });
}

export function isSafeReturnUrl(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    value.startsWith('/') &&
    !value.startsWith('//') &&
    !value.includes('\\') &&
    !hasControlCharacter(value)
  );
}

function isAddressOf(path: string, value: string): boolean {
  return value === path || value.startsWith(`${path}?`) || value.startsWith(`${path}/`) || value.startsWith(`${path}#`);
}

export function resolveReturnUrl(value: string | null | undefined): string {
  return isSafeReturnUrl(value) && !isAddressOf(adminLoginPath, value) ? value : adminHome;
}

export function resolveVisitorReturnUrl(value: string | null | undefined): string {
  return isSafeReturnUrl(value) && !visitorSignInPaths.some((path) => isAddressOf(path, value)) ? value : publicHome;
}

export function isAdminAreaUrl(value: string): boolean {
  return isAddressOf(adminHome, value);
}
