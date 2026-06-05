import { expect, type Page } from '@playwright/test';

export const masterPassword = 'MasterPassword123!';

export async function configureVault(page: Page) {
  await expect(page.getByRole('heading', { name: /Configure Your Vault/i })).toBeVisible();

  await page.getByPlaceholder('Strong password, at least 12 characters').fill(masterPassword);
  await page.getByPlaceholder('Re-enter the password').fill(masterPassword);
  await page.getByRole('button', { name: /Continue/i }).click();

  const secretKey = page.getByText(/^A3-/);
  await expect(secretKey).toBeVisible();
  await expect(secretKey).toContainText(/^A3-[A-Z0-9]{6}-[A-Z0-9]{6}-[A-Z0-9]{5}-[A-Z0-9]{5}$/);

  await page.getByRole('button', { name: /Confirm Records and Open Vault/i }).click();
  if (await page.getByRole('heading', { name: /Open Your AegisVault/i }).isVisible({ timeout: 5_000 }).catch(() => false)) {
    await page.getByPlaceholder('Enter your master password').fill(masterPassword);
    await page.getByRole('button', { name: /Open Locked Vault/i }).click();
  }
  await expect(page.getByRole('heading', { name: /Security Overview/i })).toBeVisible({ timeout: 45_000 });
}
