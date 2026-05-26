import { expect, test } from '@playwright/test';
import { configureVault, masterPassword } from './helpers';

test.describe('authenticated settings security coverage', () => {
  test.skip(({ browserName }) => browserName === 'firefox', 'Authenticated SQLite/OPFS workflows run in Chromium; Firefox covers lock-screen and responsive smoke paths.');

  test.beforeEach(async ({ page }) => {
    test.setTimeout(90_000);
    await page.addInitScript(() => {
      window.localStorage.setItem('aegis_language', 'en');
    });
    page.on('dialog', async (dialog) => {
      await dialog.accept();
    });
    await page.goto('/');
    await configureVault(page);
    await page.locator('nav').getByText('Settings', { exact: true }).click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();
  });

  test('validates and re-keys the master password before unlocking with the new password', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Change Master Password' })).toBeVisible();

    await page.getByPlaceholder('Your current unlock password').fill(masterPassword);
    await page.getByPlaceholder('New password, at least 8 characters').fill('short');
    await page.getByPlaceholder('Confirm the password').fill('short');
    await page.getByRole('button', { name: 'Update Master Password' }).click();
    await expect(page.getByText('New password must be at least 8 characters.')).toBeVisible();

    await page.getByPlaceholder('New password, at least 8 characters').fill('UpdatedMasterPassword123!');
    await page.getByPlaceholder('Confirm the password').fill('DifferentMasterPassword123!');
    await page.getByRole('button', { name: 'Update Master Password' }).click();
    await expect(page.getByText('New password confirmation does not match.')).toBeVisible();

    await page.getByPlaceholder('Confirm the password').fill('UpdatedMasterPassword123!');
    await page.getByRole('button', { name: 'Update Master Password' }).click();
    await expect(page.getByText('Your main vault password was updated successfully.')).toBeVisible({ timeout: 45_000 });

    await page.getByTitle('Lock Vault Securely').click();
    await expect(page.getByRole('heading', { name: 'Open Your AegisVault' })).toBeVisible();

    await page.getByPlaceholder('Enter your master password').fill('UpdatedMasterPassword123!');
    await page.getByRole('button', { name: /Open Locked Vault/i }).click();

    await expect(page.getByRole('heading', { name: 'Open Your AegisVault' })).not.toBeVisible({ timeout: 45_000 });
    await page.locator('nav').getByText('Vault', { exact: true }).click();
    await expect(page.getByText('Chase Private Client')).toBeVisible();
  });

  test('requires the exact reset confirmation phrase before restoring sample vault records', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Factory Settings and Reset' })).toBeVisible();

    await page.getByRole('button', { name: 'Reset System' }).click();
    await expect(page.getByText('FACTORY RESET CONFIRMATION')).toBeVisible();

    const resetButton = page.getByRole('button', { name: 'Reset Vault' });
    await expect(resetButton).toBeDisabled();

    await page.getByPlaceholder('Type SIFIRLA to confirm').fill('RESET');
    await expect(resetButton).toBeDisabled();

    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByText('FACTORY RESET CONFIRMATION')).not.toBeVisible();

    await page.getByRole('button', { name: 'Reset System' }).click();
    await expect(page.getByPlaceholder('Type SIFIRLA to confirm')).toHaveValue('');
    await page.getByPlaceholder('Type SIFIRLA to confirm').fill('SIFIRLA');
    await expect(resetButton).toBeEnabled();

    await resetButton.click();
    await expect(page.getByText('Reset Completed Successfully.')).toBeVisible();
    await expect(page.getByText('The AegisVault local vault was reset successfully and sample records were reloaded.')).toBeVisible();

    await page.locator('nav').getByText('Vault', { exact: true }).click();
    await expect(page.getByText(/Vault Records \(3\)/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Chase Private Client')).toBeVisible();
    await expect(page.getByText('X / Twitter')).toBeVisible();
    await expect(page.getByText('Binance Pro')).toBeVisible();
  });
});
