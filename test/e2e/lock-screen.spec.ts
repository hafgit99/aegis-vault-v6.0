import { expect, test } from '@playwright/test';

test.setTimeout(60_000);

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem('aegis_language', 'tr');
  });

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 0) {
      await page.goto('/', { waitUntil: 'domcontentloaded' });
    } else {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }

    try {
      await page.locator('#vault-lock-screen').waitFor({ state: 'visible', timeout: 10_000 });
      return;
    } catch (error) {
      if (attempt === 1) throw error;
    }
  }
});

test('changes the lock screen language without reloading app state', async ({ page }) => {
  await expect(page.getByRole('heading', { name: /Kasa Ayarlarını Yapın/ })).toBeVisible();

  await page.getByRole('button', { name: 'EN' }).click();
  await expect(page.getByRole('heading', { name: /Configure Your Vault/ })).toBeVisible();
  await expect(page.getByPlaceholder('Strong password, at least 12 characters')).toBeVisible();

  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.getByRole('heading', { name: /配置保险库/ })).toBeVisible();
  await expect(page.getByPlaceholder(/12/)).toBeVisible();
});

test('shows localized setup validation errors', async ({ page }) => {
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByPlaceholder('Strong password, at least 12 characters').fill('short');
  await page.getByPlaceholder('Re-enter the password').fill('short');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText(/The master password must be at least 12 characters/i)).toBeVisible();
});

test('validates mismatched setup passwords before generating a secret key', async ({ page }) => {
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByPlaceholder('Strong password, at least 12 characters').fill('MasterPassword123!');
  await page.getByPlaceholder('Re-enter the password').fill('DifferentPassword123!');
  await page.getByRole('button', { name: 'Continue' }).click();

  await expect(page.getByText('Passwords do not match.')).toBeVisible();
  await expect(page.getByText(/^A3-/)).not.toBeVisible();
});

test('generates, copies, and downloads the setup emergency kit', async ({ page }) => {
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByPlaceholder('Strong password, at least 12 characters').fill('MasterPassword123!');
  await page.getByPlaceholder('Re-enter the password').fill('MasterPassword123!');
  await page.getByRole('button', { name: 'Continue' }).click();

  const secretKey = page.getByText(/^A3-/);
  await expect(secretKey).toBeVisible();

  await page.getByRole('button', { name: 'Copy Key' }).click();
  await expect(page.getByRole('button', { name: 'Copied' })).toBeVisible();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download Security Kit' }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe('aegisvault_emergency_kit.txt');
});

test('keeps users in setup when login is selected before configuration', async ({ page }) => {
  await page.getByRole('button', { name: 'EN' }).click();
  await page.getByRole('button', { name: 'Open Vault (Login)' }).click();

  await expect(page.getByText('Create a new vault and generate a password first.')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Configure Your Vault' })).toBeVisible();
});
