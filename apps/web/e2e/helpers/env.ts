export interface Credentials {
  readonly email: string;
  readonly password: string;
}

export function requiredEnv(name: string): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    throw new Error(`Set the ${name} environment variable to run the administration suite.`);
  }
  return value;
}

export function adminCredentials(): Credentials {
  return { email: requiredEnv('E2E_ADMIN_EMAIL'), password: requiredEnv('E2E_ADMIN_PASSWORD') };
}
