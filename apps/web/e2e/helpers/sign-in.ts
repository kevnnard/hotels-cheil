import { Page } from '@playwright/test';
import { Credentials } from './env';

export async function submitAdminLogin(page: Page, credentials: Credentials): Promise<void> {
  await page.goto('/admin/login');
  await page.getByLabel('Email', { exact: true }).fill(credentials.email);
  await page.getByLabel('Password', { exact: true }).fill(credentials.password);
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
}
