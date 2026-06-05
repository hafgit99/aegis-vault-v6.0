import { expect, test } from '@playwright/test';
import { configureVault, masterPassword } from './helpers';

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('aegis_language', 'en');
  });
  await page.goto('/');
});

test('sets up a new vault and reaches the searchable dashboard', async ({ page, browserName }) => {
  test.skip(browserName === 'firefox', 'Full SQLite/OPFS setup is covered in Chromium; Firefox remains covered by lock-screen e2e smoke tests.');
  test.setTimeout(60_000);
  await configureVault(page);
  await expect(page.getByText(/Vault Records \(3\)/i)).toBeVisible();
  await expect(page.getByText('Chase Private Client')).toBeVisible();
  await expect(page.getByText('X / Twitter')).toBeVisible();

  await page.getByPlaceholder('Search your secure vault...').fill('binance');
  await expect(page.getByText('Binance Pro')).toBeVisible();
  await expect(page.getByText('Chase Private Client')).not.toBeVisible();
});

test.describe('authenticated vault workflows', () => {
  test.skip(({ browserName }) => browserName === 'firefox', 'Authenticated SQLite/OPFS workflows run in Chromium; Firefox covers lock-screen smoke paths.');

  test.beforeEach(async ({ page }) => {
    test.setTimeout(60_000);
    await configureVault(page);
  });

  test('adds a login item and finds it through vault search', async ({ page }) => {
    await page.getByRole('button', { name: /Add New Entry/i }).click();
    await expect(page.getByRole('heading', { name: /New Vault Item/i })).toBeVisible();

    await page.getByPlaceholder(/ProtonMail/i).fill('Linear Admin');
    await page.getByPlaceholder(/email address or alias/i).fill('admin@linear.example');
    await page.getByPlaceholder(/set a password/i).fill('LinearSecret123!');
    await page.getByPlaceholder('https://example.com').fill('https://linear.example');
    await page.getByRole('button', { name: /Save Item/i }).click();

    await expect(page.getByRole('heading', { name: 'Linear Admin' })).toBeVisible();
    await page.getByPlaceholder('Search your secure vault...').fill('linear');
    await expect(page.getByRole('heading', { name: 'Linear Admin' })).toBeVisible();
    await expect(page.getByText('Chase Private Client')).not.toBeVisible();
  });

  test('opens the password generator and copies a generated password', async ({ page }) => {
    await page.getByText('Password Generator').click();
    await expect(page.getByRole('heading', { name: 'Password Generator' })).toBeVisible();
    await expect(page.getByText('Generated Password')).toBeVisible();

    await page.getByRole('button', { name: /Copy/i }).click();
    await expect(page.getByRole('button', { name: /Copied/i })).toBeVisible();

    await page.getByRole('button', { name: 'Diceware Words' }).click();
    await expect(page.getByText('Wordlist Language')).toBeVisible();
    await expect(page.getByText('Wordlist Mode')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Clean List' })).toBeVisible();
    await expect(page.getByText(/Estimated Diceware entropy: 7[6-8]\./)).toBeVisible();
    await page.getByRole('button', { name: 'Full List' }).click();
    await expect(page.getByText('7776')).toBeVisible();
    await page.getByRole('button', { name: /Copy/i }).click();
    await expect(page.getByRole('button', { name: /Copied/i })).toBeVisible();
  });

  test('reviews security audit and trash views without losing vault state', async ({ page }) => {
    await page.getByText('Security Audit').first().click();
    await expect(page.getByRole('heading', { name: 'Security Audit' })).toBeVisible();
    await expect(page.getByText('Overall Health Score')).toBeVisible();
    await expect(page.getByText('Vault Integrity')).toBeVisible();

    await page.getByText('Trash').first().click();
    await expect(page.getByRole('heading', { name: 'Trash', exact: true })).toBeVisible();

    await page.getByText('Password Generator').first().click();
    await expect(page.getByRole('heading', { name: 'Password Generator' })).toBeVisible();
  });

  test('updates settings auto-lock preference and runs diagnostics', async ({ page }) => {
    await page.getByText('Settings').first().click();
    await expect(page.getByRole('heading', { name: 'Settings', exact: true })).toBeVisible();

    await page.getByRole('button', { name: '30 Min' }).click();
    await expect.poll(() => page.evaluate(() => window.localStorage.getItem('aegis_auto_lock'))).toBe('30');

    await page.getByRole('button', { name: /Run Security Diagnostic/i }).click();
    await expect(page.getByText('System Status and Diagnostics')).toBeVisible();
    await expect(page.getByText('SECURITY SCORE')).toBeVisible({ timeout: 5_000 });
  });

  test('opens database management and reviews analytics', async ({ page }) => {
    await page.getByTitle('Database Management & Backup').click();
    await expect(page.getByRole('heading', { name: 'Database Management & Backup' })).toBeVisible();

    await page.getByRole('button', { name: 'Data Analytics' }).click();
    await expect(page.getByText('Vault Storage Detail Analysis')).toBeVisible();
    await expect(page.getByText('Total Items')).toBeVisible();
    await expect(page.getByText('Active Cards and Passwords')).toBeVisible();
  });

  test('opens profile details and saves a display name change', async ({ page }) => {
    await page.getByAltText('Admin Profile').click();
    await expect(page.getByRole('heading', { name: 'Profile & Session Info' })).toBeVisible();

    await page.getByTitle('Edit name').click();
    const nameInput = page.locator('#profile-modal-overlay input[type="text"]').first();
    await nameInput.fill('E2E Owner');
    await nameInput.press('Enter');

    await expect(page.getByText('E2E Owner')).toBeVisible();
  });

  test('locks the vault and unlocks again with the remembered secret key', async ({ page }) => {
    await page.getByTitle('Lock Vault Securely').click();
    await expect(page.getByRole('heading', { name: 'Open Your AegisVault' })).toBeVisible();

    await page.getByPlaceholder('Enter your master password').fill(masterPassword);
    await page.getByRole('button', { name: /Open Locked Vault/i }).click();

    await expect(page.getByRole('heading', { name: /Security Overview/i })).toBeVisible({ timeout: 45_000 });
  });
});
