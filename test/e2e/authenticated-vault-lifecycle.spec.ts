import { expect, test } from '@playwright/test';
import { configureVault } from './helpers';

test.describe('authenticated vault lifecycle coverage', () => {
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
  });

  test('favorites, trashes, restores, and permanently deletes a vault item', async ({ page }) => {
    await test.step('Open an item and mark it as favorite from the detail panel', async () => {
      await page.getByText('Chase Private Client').first().click();
      await expect(page.getByRole('heading', { name: 'Chase Private Client', level: 3 })).toBeVisible();

      await page.getByRole('button', { name: 'Add to Favorites' }).last().click();
      await expect(page.getByRole('button', { name: 'Remove from Favorites' }).last()).toBeVisible();
    });

    await test.step('Move the selected item to trash', async () => {
      await page.getByRole('button', { name: /Move to Trash/i }).last().click();
      await expect(page.getByRole('heading', { name: 'Chase Private Client', level: 3 })).not.toBeVisible();
      await expect(page.getByRole('heading', { name: 'Chase Private Client', level: 4 })).not.toBeVisible();
    });

    await test.step('Restore the item from trash and verify it returns to the vault', async () => {
      await page.getByText('Trash').first().click();
      await expect(page.getByRole('heading', { name: 'Trash', exact: true })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Chase Private Client' })).toBeVisible();

      await page.getByTitle('Restore to Vault').click();
      await expect(page.getByRole('heading', { name: 'Chase Private Client' })).not.toBeVisible();

      await page.locator('nav').getByText('Vault', { exact: true }).click();
      await expect(page.getByRole('heading', { name: 'Chase Private Client', level: 4 })).toBeVisible();
    });

    await test.step('Permanently delete a trashed item', async () => {
      await page.getByText('X / Twitter').first().click();
      await page.getByRole('button', { name: /Move to Trash/i }).last().click();
      await page.getByText('Trash').first().click();
      await expect(page.getByRole('heading', { name: 'X / Twitter', level: 4 })).toBeVisible();

      await page.getByTitle('Delete Permanently').click();
      await expect(page.getByRole('heading', { name: 'X / Twitter', level: 4 })).not.toBeVisible();
    });
  });

  test('opens security logs, records sync activity, and clears the audit log', async ({ page }) => {
    await page.getByTitle('Local Vault Sync').click();
    await expect.poll(async () => page.evaluate(() => window.sessionStorage.getItem('aegis_security_logs') ?? '')).toContain('database I/O synchronization started');
    await expect.poll(async () => page.evaluate(() => window.sessionStorage.getItem('aegis_security_logs') ?? ''), {
      timeout: 5_000,
    }).toContain('database I/O synchronization completed');

    await page.getByTitle('Security Log').click();
    await expect(page.getByRole('heading', { name: /Local Security Log/i })).toBeVisible();
    await expect(page.getByText(/synchronization completed/i)).toBeVisible();

    await page.getByRole('button', { name: /Clear Log/i }).click();
    await expect.poll(async () => page.evaluate(() => window.sessionStorage.getItem('aegis_security_logs') ?? '')).toContain('Local software security log was cleared');
  });

  test('guards database encrypted and plain backup exports before downloading', async ({ page }) => {
    await page.getByTitle('Database Management & Backup').click();
    await expect(page.getByRole('heading', { name: 'Database Management & Backup' })).toBeVisible();

    const encryptedExport = page.getByRole('button', { name: 'Encrypt and Download Backup File' });
    await expect(encryptedExport).toBeDisabled();

    await page.getByPlaceholder('Set an independent password to encrypt the document').fill('abc');
    await page.getByPlaceholder('Confirm the backup password').fill('abc');
    await expect(encryptedExport).toBeDisabled();

    await page.getByPlaceholder('Set an independent password to encrypt the document').fill('VaultBackup123!');
    await page.getByPlaceholder('Confirm the backup password').fill('DifferentBackup123!');
    await expect(page.getByText('! Passwords do not match. Please try again.')).toBeVisible();
    await expect(encryptedExport).toBeDisabled();

    await page.getByPlaceholder('Confirm the backup password').fill('VaultBackup123!');
    await expect(encryptedExport).toBeEnabled();

    await page.getByRole('button', { name: /plain text/i }).click();
    await expect(encryptedExport).toBeDisabled();
    await expect(page.getByText('I accept the risks as a responsible expert')).toBeVisible();
    await page.getByText('I accept the risks as a responsible expert').click();
    await expect(encryptedExport).toBeEnabled();
  });
});
