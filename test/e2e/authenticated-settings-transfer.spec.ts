import { expect, test } from '@playwright/test';
import { configureVault } from './helpers';

test.describe('authenticated settings transfer coverage', () => {
  test.skip(({ browserName }) => browserName === 'firefox', 'Authenticated SQLite/OPFS workflows run in Chromium; Firefox covers lock-screen and responsive smoke paths.');

  test.beforeEach(async ({ page }) => {
    test.setTimeout(75_000);
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

  test('requires matching backup passwords before creating an encrypted settings export', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Encrypted Vault Backup' })).toBeVisible();

    await page.getByPlaceholder('Enter a secure backup password').fill('SettingsBackup123!');
    await page.getByRole('button', { name: 'Generate Secure Backup File' }).click();

    await expect(page.getByRole('heading', { name: 'Backup Encryption Key' })).toBeVisible();
    await expect(page.getByText('AegisVault Secure Data Transfer Protocol')).toBeVisible();
    await expect(page.getByText('Use My Current Master Password')).toBeVisible();

    const backupPassword = page.getByPlaceholder('Independent password only for this backup');
    const confirmPassword = page.getByPlaceholder('Confirm the password').last();
    await expect(backupPassword).toHaveValue('SettingsBackup123!');

    const downloadButton = page.getByRole('button', { name: 'Encrypt and Download Backup Securely' });
    await expect(downloadButton).toBeDisabled();

    await confirmPassword.fill('WrongBackup123!');
    await expect(page.getByText('! The passwords you entered do not match yet.')).toBeVisible();
    await expect(downloadButton).toBeDisabled();

    await confirmPassword.fill('SettingsBackup123!');
    await expect(downloadButton).toBeEnabled();

    const downloadPromise = page.waitForEvent('download');
    await downloadButton.click();
    const download = await downloadPromise;

    expect(download.suggestedFilename()).toMatch(/^AegisVault_Encrypted_Backup_\d{4}-\d{2}-\d{2}\.json$/);
    await expect(page.getByText('Backup File Created Securely.')).toBeVisible();
    await expect(page.getByText('FILE NAME:')).toBeVisible();
    await expect(page.getByText('FILE CONTENT (TEXT EDITOR VIEW):')).toBeVisible();
    await expect(page.getByText('AES-256-GCM Sealed')).toBeVisible();
    await expect(page.getByText(/Nobody can decrypt this file without your password/i)).toBeVisible();
  });

  test('imports a generic CSV from settings and exposes the imported record in vault search', async ({ page }) => {
    const csv = [
      'name,username,password,url,notes',
      'E2E Imported Admin,e2e@example.com,ImportedSecret123!,https://imported.example,Imported from e2e',
    ].join('\n');

    await expect(page.getByRole('heading', { name: 'Universal Import Wizard' })).toBeVisible();
    await page.getByRole('button', { name: 'Generic CSV / Other' }).click();
    await page.locator('input[type="file"]').setInputFiles({
      name: 'aegis-e2e-import.csv',
      mimeType: 'text/csv',
      buffer: Buffer.from(csv),
    });

    await expect(page.getByText('aegis-e2e-import.csv')).toBeVisible();
    await page.getByRole('button', { name: 'Decrypt and Parse Backup File' }).click();

    await expect(page.getByText('RECORDS IN DOCUMENT (1)')).toBeVisible();
    await expect(page.getByText('E2E Imported Admin')).toBeVisible();
    await expect(page.getByText('e2e@example.com')).toBeVisible();
    await expect(page.getByText('Merge With Current Vault')).toBeVisible();

    await page.getByRole('button', { name: 'Import 1 Selected Records Into AegisVault' }).click();
    await expect(page.getByText('Backup Successful')).toBeVisible();
    await expect(page.getByText('1 new records were added to the vault safely and successfully.')).toBeVisible();

    await page.locator('nav').getByText('Vault', { exact: true }).click();
    await page.getByPlaceholder('Search your secure vault...').fill('imported');

    await expect(page.getByRole('heading', { name: 'E2E Imported Admin' })).toBeVisible();
    await expect(page.getByText('e2e@example.com')).toBeVisible();
    await expect(page.getByText('Chase Private Client')).not.toBeVisible();
  });
});
