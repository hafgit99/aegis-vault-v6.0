import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import DatabaseModal from '../../src/components/DatabaseModal';
import Settings from '../../src/components/Settings';
import { decryptData, encryptData } from '../../src/lib/backupCrypto';
import { vaultService } from '../../src/lib/vaultService';
import { VaultEntry } from '../../src/types';

vi.mock('../../src/lib/backupCrypto', () => ({
  encryptData: vi.fn(async () => ({
    data: 'encrypted-backup-data',
    salt: 'backup-salt',
    iv: 'backup-iv',
    kdf: { algorithm: 'argon2id', version: 1, iterations: 3, memorySize: 65536, parallelism: 1, hashLength: 32 },
  })),
  decryptData: vi.fn(),
}));

vi.mock('../../src/lib/vaultService', () => ({
  vaultService: {
    sqliteDb: {},
    isUnlocked: vi.fn(() => true),
    getPasswords: vi.fn(async () => []),
    savePassword: vi.fn(async () => undefined),
    changeMasterPassword: vi.fn(async () => undefined),
  },
}));

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: overrides.id ?? 'entry-1',
  title: overrides.title ?? 'GitHub',
  subtitle: overrides.subtitle ?? 'octo@example.com',
  username: overrides.username ?? 'octo@example.com',
  password: overrides.password ?? 'StrongPassword123!',
  strength: overrides.strength ?? 'EXCELLENT',
  themeColor: overrides.themeColor ?? 'tertiary',
  type: overrides.type ?? 'login',
  createdAt: overrides.createdAt ?? '2026-01-01T00:00:00.000Z',
  ...overrides,
});

beforeEach(async () => {
  vi.useRealTimers();
  vi.clearAllMocks();
  await i18n.changeLanguage('tr');
  vi.spyOn(window, 'alert').mockImplementation(() => {});
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.stubGlobal('URL', {
    createObjectURL: vi.fn(() => 'blob:mock-url'),
    revokeObjectURL: vi.fn(),
  });
});

describe('Settings', () => {
  it('updates language and auto-lock preferences', async () => {
    const user = userEvent.setup();
    const onAddLog = vi.fn();

    render(<Settings entries={[entry()]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={onAddLog} />);

    expect(screen.getByRole('heading', { name: 'Ayarlar' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: '30 Dk' }));
    expect(localStorage.getItem('aegis_auto_lock')).toBe('30');
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('30 Dk'), 'info');

    await user.click(screen.getByRole('button', { name: 'English' }));
    await waitFor(() => {
      expect(localStorage.getItem('aegis_language')).toBe('en');
    });
    expect(document.documentElement.lang).toBe('en');
  });

  it('validates and submits master password changes', async () => {
    const user = userEvent.setup();
    const onAddLog = vi.fn();

    render(<Settings entries={[entry()]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={onAddLog} />);

    await user.type(screen.getByPlaceholderText(/Mevcut.*ifre/i), 'old-password');
    await user.type(screen.getByPlaceholderText(/12 haneli yeni/i), 'short');
    await user.type(screen.getByPlaceholderText(/teyit/i), 'short');
    await user.click(screen.getByRole('button', { name: /Ana.*G.ncelle/i }));

    expect(screen.getByText(/en az 12 karakter/i)).toBeInTheDocument();
    expect(vaultService.changeMasterPassword).not.toHaveBeenCalled();

    await user.clear(screen.getByPlaceholderText(/12 haneli yeni/i));
    await user.type(screen.getByPlaceholderText(/12 haneli yeni/i), 'NewPassword123!');
    await user.clear(screen.getByPlaceholderText(/teyit/i));
    await user.type(screen.getByPlaceholderText(/teyit/i), 'NewPassword123!');
    await user.click(screen.getByRole('button', { name: /Ana.*G.ncelle/i }));

    await waitFor(() => {
      expect(vaultService.changeMasterPassword).toHaveBeenCalledWith('old-password', 'NewPassword123!');
      expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'warning');
    });
  }, 15000);

  it('renders only the audited AES-GCM cipher suite for new encryption', async () => {
    await i18n.changeLanguage('en');

    render(<Settings entries={[entry()]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={vi.fn()} />);

    expect(screen.getAllByText(/AES-256-GCM/).length).toBeGreaterThan(0);
    expect(screen.queryByText('ChaCha20-Poly1305')).not.toBeInTheDocument();
    expect(vaultService.getPasswords).not.toHaveBeenCalled();
    expect(vaultService.savePassword).not.toHaveBeenCalled();
  });

  it('runs diagnostics and reports weak and duplicate password risk', async () => {
    vi.useFakeTimers();
    const onAddLog = vi.fn();
    localStorage.setItem('aegis_airgap', 'false');
    localStorage.setItem('aegis_cipher_suite', 'CHACHA20-POLY1305');

    render(
      <Settings
        entries={[
          entry({ id: 'entry-1', password: 'shared', strength: 'GOOD' }),
          entry({ id: 'entry-2', password: 'shared', strength: 'GOOD' }),
          entry({ id: 'entry-3', password: 'VeryStrongPassword123!', strength: 'EXCELLENT' }),
        ]}
        onReset={vi.fn()}
        onImport={vi.fn()}
        onAddLog={onAddLog}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Te.hisi|Teşhisi/i }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(2400);
    });

    expect(screen.getByText('AES-256-GCM')).toBeInTheDocument();
    expect(screen.getByText(/Pasif|A. .zin Verildi|Ağ İzin Verildi/i)).toBeInTheDocument();
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('60'), 'info');
  });

  it('shows a live vault health dashboard with prioritized password risks', async () => {
    await i18n.changeLanguage('en');

    render(
      <Settings
        entries={[
          entry({ id: 'entry-1', password: 'shared', strength: 'GOOD', createdAt: '2025-01-01T00:00:00.000Z' }),
          entry({ id: 'entry-2', password: 'shared', strength: 'GOOD' }),
          entry({ id: 'entry-3', password: 'VeryStrongPassword123!', strength: 'EXCELLENT' }),
          entry({ id: 'entry-4', type: 'note', password: undefined, strength: 'IMMUTABLE' }),
        ]}
        onReset={vi.fn()}
        onImport={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    expect(screen.getByText('Vault Health Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Vault health score')).toBeInTheDocument();
    expect(screen.getByText('Active').parentElement).toHaveTextContent('4');
    expect(screen.getByText('Weak').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Reused').parentElement).toHaveTextContent('2');
    expect(screen.getByText('Old').parentElement).toHaveTextContent('1');
    expect(screen.getByText(/Highest priority: rotate weak login passwords/i)).toBeInTheDocument();
  });

  it('exports an encrypted backup with an independent backup password and shows a sealed preview', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: click });
      }
      return element;
    });

    render(<Settings entries={[entry({ title: 'GitHub' })]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={onAddLog} />);

    await user.type(screen.getByPlaceholderText('Enter a secure backup password'), 'BackupKey123!');
    await user.click(screen.getByRole('button', { name: 'Generate Secure Backup File' }));
    await user.type(screen.getAllByPlaceholderText('Confirm the password').at(-1) as HTMLElement, 'BackupKey123!');
    await user.click(screen.getByRole('button', { name: 'Encrypt and Download Backup Securely' }));

    await waitFor(() => {
      expect(encryptData).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'BackupKey123!');
    });
    expect(click).toHaveBeenCalled();
    expect(screen.getByText(/encrypted-backup-data/)).toBeInTheDocument();
    expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'info');
  });

  it('exports a secure share bundle from settings with a separate transfer password', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: click });
      }
      return element;
    });

    render(
      <Settings
        entries={[
          entry({ id: 'entry-1', title: 'GitHub' }),
          entry({ id: 'entry-2', title: 'Deleted Mail', isDeleted: true }),
        ]}
        onReset={vi.fn()}
        onImport={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getAllByRole('button', { name: /Secure Share/i })[0]);
    await user.type(screen.getByPlaceholderText('Set a one-time transfer password'), 'TransferKey123!');
    await user.click(screen.getByRole('button', { name: 'Generate Secure Backup File' }));
    await user.type(screen.getAllByPlaceholderText('Confirm the password').at(-1) as HTMLElement, 'TransferKey123!');
    await user.selectOptions(screen.getAllByDisplayValue('7 days').at(-1) as HTMLElement, '30');
    await user.click(screen.getByRole('button', { name: 'Create Secure Share Bundle' }));

    await waitFor(() => {
      expect(click).toHaveBeenCalled();
    });
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const exported = JSON.parse(await blob.text());
    expect(exported).toMatchObject({
      app: 'AegisVault',
      kind: 'secure-share-bundle',
      encrypted: true,
      itemCount: 1,
    });
    expect(new Date(exported.expiresAt).getTime()).toBeGreaterThan(Date.now() + 29 * 24 * 60 * 60 * 1000);
    expect(exported.data).toBe('encrypted-backup-data');
    expect(JSON.stringify(exported)).not.toContain('Deleted Mail');
    expect(screen.getByText(/secure-share-bundle/)).toBeInTheDocument();
  });

  it('shows settings encrypted export evidence and closes the success modal', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: vi.fn() });
      }
      return element;
    });

    render(<Settings entries={[entry({ title: 'GitHub' })]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter a secure backup password'), 'BackupKey123!');
    await user.click(screen.getByRole('button', { name: 'Generate Secure Backup File' }));
    await user.type(screen.getAllByPlaceholderText('Confirm the password').at(-1) as HTMLElement, 'BackupKey123!');
    await user.click(screen.getByRole('button', { name: 'Encrypt and Download Backup Securely' }));

    await waitFor(() => {
      expect(screen.getByText('Backup File Created Securely.')).toBeInTheDocument();
    });
    expect(screen.getByText('FILE NAME:')).toBeInTheDocument();
    expect(screen.getByText('FILE CONTENT (TEXT EDITOR VIEW):')).toBeInTheDocument();
    expect(screen.getByText('AES-256-GCM Sealed')).toBeInTheDocument();
    expect(screen.getByText(/AegisVault_Encrypted_Backup_/)).toBeInTheDocument();
    expect(screen.getByText(/encrypted-backup-data/)).toBeInTheDocument();
    expect(screen.getByText(/Nobody can decrypt this file without your password/)).toBeInTheDocument();

    expect(screen.getAllByRole('button', { name: 'Close' }).at(-1)).toBeInTheDocument();
  });

  it('opens the settings export confirmation without exporting immediately', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();

    render(<Settings entries={[entry({ title: 'GitHub' })]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Generate Secure Backup File' }));
    expect(screen.getByText('Backup Encryption Key')).toBeInTheDocument();

    expect(encryptData).not.toHaveBeenCalled();
  });

  it('requires matching custom backup passwords before exporting encrypted settings backup', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: click });
      }
      return element;
    });

    render(<Settings entries={[entry({ title: 'GitHub' })]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter a secure backup password'), 'BackupKey123!');
    await user.click(screen.getByRole('button', { name: 'Generate Secure Backup File' }));

    expect(screen.queryByText('Use My Current Master Password')).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Independent password only for this backup')).toHaveValue('BackupKey123!');
    const confirmBackupPassword = screen.getAllByPlaceholderText('Confirm the password').at(-1) as HTMLInputElement;
    expect(confirmBackupPassword).toBeInTheDocument();

    const exportButton = screen.getByRole('button', { name: 'Encrypt and Download Backup Securely' });
    expect(exportButton).toBeDisabled();

    await user.type(confirmBackupPassword, 'DifferentKey123!');
    expect(screen.getByText('! The passwords you entered do not match yet.')).toBeInTheDocument();
    expect(exportButton).toBeDisabled();
    expect(encryptData).not.toHaveBeenCalled();

    await user.clear(confirmBackupPassword);
    await user.type(confirmBackupPassword, 'BackupKey123!');
    expect(exportButton).toBeEnabled();
    await user.click(exportButton);

    await waitFor(() => {
      expect(encryptData).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'BackupKey123!');
    });
    expect(click).toHaveBeenCalled();
  });

  it('toggles custom settings export password visibility for both password fields', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();

    render(<Settings entries={[entry({ title: 'GitHub' })]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter a secure backup password'), 'BackupKey123!');
    await user.click(screen.getByRole('button', { name: 'Generate Secure Backup File' }));

    const backupPassword = screen.getByPlaceholderText('Independent password only for this backup') as HTMLInputElement;
    const confirmBackupPassword = screen.getAllByPlaceholderText('Confirm the password').at(-1) as HTMLInputElement;
    expect(backupPassword.type).toBe('password');
    expect(confirmBackupPassword.type).toBe('password');

    await user.click(backupPassword.parentElement?.querySelector('button') as HTMLButtonElement);
    expect(backupPassword.type).toBe('text');
    expect(confirmBackupPassword.type).toBe('text');

    await user.click(backupPassword.parentElement?.querySelector('button') as HTMLButtonElement);
    expect(backupPassword.type).toBe('password');
    expect(confirmBackupPassword.type).toBe('password');
  });

  it('keeps encrypted settings export disabled until the independent password is confirmed', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();

    render(<Settings entries={[entry({ title: 'GitHub' })]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Generate Secure Backup File' }));

    const exportButton = screen.getByRole('button', { name: 'Encrypt and Download Backup Securely' });

    expect(screen.getByPlaceholderText('Independent password only for this backup')).toBeInTheDocument();
    expect(screen.getAllByPlaceholderText('Confirm the password').at(-1)).toBeInTheDocument();
    expect(exportButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Independent password only for this backup'), 'BackupKey123!');
    await user.type(screen.getAllByPlaceholderText('Confirm the password').at(-1) as HTMLElement, 'BackupKey123!');
    expect(exportButton).toBeEnabled();
  });

  it('exports a plain settings backup only after the explicit risk acknowledgement', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: click });
      }
      return element;
    });

    render(
      <Settings
        entries={[
          entry({ id: 'entry-1', title: 'GitHub' }),
          entry({ id: 'entry-2', title: 'Deleted Bank', isDeleted: true }),
        ]}
        onReset={vi.fn()}
        onImport={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /plain text/i }));
    await user.click(screen.getByRole('button', { name: 'Generate Secure Backup File' }));
    const downloadButton = screen.getByRole('button', { name: 'Accept Responsibility and Download Unencrypted' });
    expect(downloadButton).toBeDisabled();

    await user.click(screen.getByText('I Accept the Risks'));
    expect(downloadButton).toBeEnabled();
    await user.click(downloadButton);

    await waitFor(() => {
      expect(click).toHaveBeenCalled();
    });
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const exported = JSON.parse(await blob.text());
    expect(exported).toMatchObject({ app: 'AegisVault', encrypted: false, version: '1.1.0' });
    expect(exported.vault).toEqual([expect.objectContaining({ title: 'GitHub' })]);
  });

  it('imports an encrypted backup from settings with the typed restore password', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onAddLog = vi.fn();
    vi.mocked(decryptData).mockResolvedValueOnce(
      JSON.stringify([
        { title: 'Imported GitHub', username: 'octo', password: 'Secret123!', type: 'login' },
      ])
    );
    const file = new File(
      [JSON.stringify({ encrypted: true, data: 'ciphertext', salt: 'salt-value', iv: 'iv-value' })],
      'settings-aegis.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <Settings entries={[entry()]} onReset={vi.fn()} onImport={onImport} onAddLog={onAddLog} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.type(screen.getByPlaceholderText('Enter the backup encryption password'), 'RestoreKey123!');
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(decryptData).toHaveBeenCalledWith('ciphertext', 'salt-value', 'iv-value', 'RestoreKey123!', undefined, { allowLegacyPBKDF2: true });
    });
    expect(screen.getByText('RECORDS IN DOCUMENT (1)')).toBeInTheDocument();
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('1 records'), 'info');

    await user.click(screen.getByRole('button', { name: 'Import 1 Selected Records Into AegisVault' }));

    expect(onImport).toHaveBeenCalledWith(
      [expect.objectContaining({ title: 'Imported GitHub', username: 'octo', password: 'Secret123!' })],
      false
    );
    expect(screen.getByText('Backup Successful')).toBeInTheDocument();
  });

  it('imports a secure share bundle from settings after decrypting its entries payload', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onAddLog = vi.fn();
    vi.mocked(decryptData).mockResolvedValueOnce(
      JSON.stringify({
        entries: [
          { title: 'Shared GitHub', username: 'octo', password: 'SharedSecret123!', type: 'login' },
        ],
      })
    );
    const file = new File(
      [JSON.stringify({
        app: 'AegisVault',
        kind: 'secure-share-bundle',
        version: '1.0',
        encrypted: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        itemCount: 1,
        data: 'ciphertext',
        salt: 'salt-value',
        iv: 'iv-value',
        kdf: { algorithm: 'argon2id', version: 1, iterations: 3, memorySize: 65536, parallelism: 1, hashLength: 32 },
      })],
      'aegis-secure-share.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <Settings entries={[entry()]} onReset={vi.fn()} onImport={onImport} onAddLog={onAddLog} />
    );

    const secureShareButtons = screen.getAllByRole('button', { name: /Secure Share/i });
    await user.click(secureShareButtons[secureShareButtons.length - 1]);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.type(screen.getByPlaceholderText('Enter the backup encryption password'), 'ShareKey123!');
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('RECORDS IN DOCUMENT (1)')).toBeInTheDocument();
    });
    expect(screen.getByText('Shared GitHub')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import 1 Selected Records Into AegisVault' }));

    expect(onImport).toHaveBeenCalledWith(
      [expect.objectContaining({ title: 'Shared GitHub', username: 'octo', password: 'SharedSecret123!' })],
      false
    );
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('1 records'), 'info');
  });

  it('rejects expired secure share bundles from settings before decrypting entries', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onAddLog = vi.fn();
    const file = new File(
      [JSON.stringify({
        app: 'AegisVault',
        kind: 'secure-share-bundle',
        version: '1.0',
        encrypted: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2000-01-01T00:00:00.000Z',
        itemCount: 1,
        data: 'ciphertext',
        salt: 'salt-value',
        iv: 'iv-value',
        kdf: { algorithm: 'argon2id', version: 1, iterations: 3, memorySize: 65536, parallelism: 1, hashLength: 32 },
      })],
      'expired-secure-share.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <Settings entries={[entry()]} onReset={vi.fn()} onImport={onImport} onAddLog={onAddLog} />
    );

    const secureShareButtons = screen.getAllByRole('button', { name: /Secure Share/i });
    await user.click(secureShareButtons[secureShareButtons.length - 1]);
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.type(screen.getByPlaceholderText('Enter the backup encryption password'), 'ShareKey123!');
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('Error Occurred')).toBeInTheDocument();
    });
    expect(screen.getByText(/Secure share bundle has expired/)).toBeInTheDocument();
    expect(decryptData).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('Secure share bundle has expired'), 'warning');
  });

  it('requires the reset confirmation phrase before resetting settings data', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(<Settings entries={[entry()]} onReset={onReset} onImport={vi.fn()} onAddLog={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Reset System' }));
    const resetButton = screen.getByRole('button', { name: 'Reset Vault' });
    expect(resetButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Type SIFIRLA to confirm'), 'SIFIRLA');
    expect(resetButton).toBeEnabled();
    await user.click(resetButton);

    expect(onReset).toHaveBeenCalled();
    expect(screen.getByText('Reset Completed Successfully.')).toBeInTheDocument();
  });

  it('cancels settings reset confirmation and preserves the pending reset state', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onReset = vi.fn();

    render(<Settings entries={[entry()]} onReset={onReset} onImport={vi.fn()} onAddLog={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Reset System' }));
    await user.type(screen.getByPlaceholderText('Type SIFIRLA to confirm'), 'SIFIRLA');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onReset).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Reset Vault' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Reset System' }));
    expect(screen.getByPlaceholderText('Type SIFIRLA to confirm')).toHaveValue('');
  });

  it('shows a service error when master password rotation fails', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    vi.mocked(vaultService.changeMasterPassword).mockRejectedValueOnce(new Error('Current password is invalid'));

    render(<Settings entries={[entry()]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={onAddLog} />);

    await user.type(screen.getByPlaceholderText('Your current unlock password'), 'wrong-password');
    await user.type(screen.getByPlaceholderText('New password, at least 12 characters'), 'NewPassword123!');
    await user.type(screen.getByPlaceholderText('Confirm the password'), 'NewPassword123!');
    await user.click(screen.getByRole('button', { name: 'Update Master Password' }));

    await waitFor(() => {
      expect(screen.getByText('Current password is invalid')).toBeInTheDocument();
    });
    expect(onAddLog).not.toHaveBeenCalledWith(expect.any(String), 'warning');
  });

  it('reports settings import parse errors for incompatible encrypted/plain modes', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    const plainFile = new File(
      [JSON.stringify({ encrypted: false, vault: [{ title: 'Plain GitHub' }] })],
      'plain-aegis.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <Settings entries={[entry()]} onReset={vi.fn()} onImport={vi.fn()} onAddLog={onAddLog} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, plainFile);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('Error Occurred')).toBeInTheDocument();
    });
    expect(screen.getByText(/Please upload an encrypted AegisVault backup/)).toBeInTheDocument();
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('Import parsing phase failed'), 'warning');
    expect(decryptData).not.toHaveBeenCalled();
  });

  it('reports settings encrypted import failures without importing unsafe records', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onAddLog = vi.fn();
    vi.mocked(decryptData).mockRejectedValueOnce(new Error('Password is incorrect or the backup file is corrupted.'));
    const encryptedFile = new File(
      [JSON.stringify({ encrypted: true, data: 'ciphertext', salt: 'salt-value', iv: 'iv-value' })],
      'settings-aegis.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <Settings entries={[entry()]} onReset={vi.fn()} onImport={onImport} onAddLog={onAddLog} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, encryptedFile);
    await user.type(screen.getByPlaceholderText('Enter the backup encryption password'), 'WrongRestoreKey123!');
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('Error Occurred')).toBeInTheDocument();
    });
    expect(screen.getByText(/Password is incorrect or the backup file is corrupted/)).toBeInTheDocument();
    expect(decryptData).toHaveBeenCalledWith('ciphertext', 'salt-value', 'iv-value', 'WrongRestoreKey123!', undefined, { allowLegacyPBKDF2: true });
    expect(onImport).not.toHaveBeenCalled();
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('Import parsing phase failed'), 'warning');
  });

  it('reports malformed settings backup files without attempting decryption or import', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImport = vi.fn();
    const onAddLog = vi.fn();
    const malformedFile = new File(['{"encrypted": true,'], 'corrupted-aegis.json', { type: 'application/json' });

    const { container } = render(
      <Settings entries={[entry()]} onReset={vi.fn()} onImport={onImport} onAddLog={onAddLog} />
    );

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, malformedFile);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('Error Occurred')).toBeInTheDocument();
    });
    expect(screen.getByText(/File parsing error:/)).toBeInTheDocument();
    expect(decryptData).not.toHaveBeenCalled();
    expect(onImport).not.toHaveBeenCalled();
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('Import parsing phase failed'), 'warning');
  });

  it('prevents settings import when every parsed CSV record is deselected', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImport = vi.fn();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const csv = [
      'name,username,password,url',
      'GitHub,octo,Secret123!,https://github.com',
      'Email,ada,MailPass123!,https://mail.example.com',
    ].join('\n');
    const file = new File([csv], 'settings-vault.csv', { type: 'text/csv' });

    const { container } = render(
      <Settings entries={[entry()]} onReset={vi.fn()} onImport={onImport} onAddLog={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Generic CSV / Other' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('RECORDS IN DOCUMENT (2)')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Deselect' }));
    await user.click(screen.getByRole('button', { name: 'Import 0 Selected Records Into AegisVault' }));

    expect(alert).toHaveBeenCalledWith('Please select at least one record to import.');
    expect(onImport).not.toHaveBeenCalled();
  });

  it('reports settings import execution errors without clearing the parsed preview', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImport = vi.fn(() => {
      throw new Error('write failed');
    });
    const csv = [
      'name,username,password,url',
      'GitHub,octo,Secret123!,https://github.com',
    ].join('\n');
    const file = new File([csv], 'settings-vault.csv', { type: 'text/csv' });

    const { container } = render(
      <Settings entries={[entry()]} onReset={vi.fn()} onImport={onImport} onAddLog={vi.fn()} />
    );

    await user.click(screen.getByRole('button', { name: 'Generic CSV / Other' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('RECORDS IN DOCUMENT (1)')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Import 1 Selected Records Into AegisVault' }));

    expect(onImport).toHaveBeenCalled();
    expect(screen.getByText('Error Occurred')).toBeInTheDocument();
    expect(screen.getByText('Application error: write failed')).toBeInTheDocument();
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });
});

describe('DatabaseModal', () => {
  it('does not render database controls when the modal is closed', async () => {
    await i18n.changeLanguage('en');

    render(
      <DatabaseModal
        isOpen={false}
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={vi.fn()}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    expect(screen.queryByText('Database Management & Backup')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Encrypt and Download Backup File' })).not.toBeInTheDocument();
  });

  it('closes database modal from the header action and backdrop', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onClose = vi.fn();

    const { container, rerender } = render(
      <DatabaseModal
        isOpen
        onClose={onClose}
        entries={[entry()]}
        onImportBackup={vi.fn()}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Close modal' }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <DatabaseModal
        isOpen
        onClose={onClose}
        entries={[entry()]}
        onImportBackup={vi.fn()}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(container.querySelector('#database-modal-overlay > div') as HTMLElement);
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('guards encrypted backup export until the password inputs are valid', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();

    render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={vi.fn()}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    expect(screen.getByRole('button', { name: 'Encrypt and Download Backup File' })).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Set an independent password to encrypt the document'), 'abc');
    await user.type(screen.getByPlaceholderText('Confirm the backup password'), 'abc');
    expect(screen.getByRole('button', { name: 'Encrypt and Download Backup File' })).toBeDisabled();
    expect(encryptData).not.toHaveBeenCalled();

    await user.clear(screen.getByPlaceholderText('Set an independent password to encrypt the document'));
    await user.clear(screen.getByPlaceholderText('Confirm the backup password'));
    await user.type(screen.getByPlaceholderText('Set an independent password to encrypt the document'), 'VaultKey123!');
    await user.type(screen.getByPlaceholderText('Confirm the backup password'), 'DifferentKey123!');

    expect(screen.getByText('! Passwords do not match. Please try again.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Encrypt and Download Backup File' })).toBeDisabled();
    expect(encryptData).not.toHaveBeenCalled();

    await user.clear(screen.getByPlaceholderText('Confirm the backup password'));
    await user.type(screen.getByPlaceholderText('Confirm the backup password'), 'VaultKey123!');

    expect(screen.getByRole('button', { name: 'Encrypt and Download Backup File' })).toBeEnabled();
  }, 10000);

  it('exports only active records in an encrypted backup', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: click });
      }
      return element;
    });

    render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[
          entry({ id: 'entry-1', title: 'GitHub' }),
          entry({ id: 'entry-2', title: 'Deleted Mail', isDeleted: true }),
        ]}
        onImportBackup={vi.fn()}
        onClearStorage={vi.fn()}
        onAddLog={onAddLog}
      />
    );

    await user.type(screen.getByPlaceholderText('Set an independent password to encrypt the document'), 'VaultKey123!');
    await user.type(screen.getByPlaceholderText('Confirm the backup password'), 'VaultKey123!');
    await user.click(screen.getByRole('button', { name: 'Encrypt and Download Backup File' }));

    await waitFor(() => {
      expect(encryptData).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'VaultKey123!');
    });
    expect(encryptData).toHaveBeenCalledWith(expect.not.stringContaining('Deleted Mail'), 'VaultKey123!');
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(screen.getByText(/encrypted-backup-data/)).toBeInTheDocument();
    expect(onAddLog).toHaveBeenCalledWith('Vault backup file (Encrypted) downloaded.');

    await user.click(screen.getByRole('button', { name: 'Create Another Backup' }));
    expect(screen.queryByText(/encrypted-backup-data/)).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText('Set an independent password to encrypt the document')).toBeInTheDocument();
  }, 10000);

  it('requires acknowledgement before exporting a plain JSON backup', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const click = vi.fn();
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: click });
      }
      return element;
    });

    render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[
          entry({ id: 'entry-1', title: 'GitHub' }),
          entry({ id: 'entry-2', title: 'Old Note', type: 'note', isDeleted: true }),
        ]}
        onImportBackup={vi.fn()}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /plain text/i }));
    const exportButton = screen.getByRole('button', { name: 'Encrypt and Download Backup File' });
    expect(exportButton).toBeDisabled();

    await user.click(screen.getByText('I accept the risks as a responsible expert'));
    expect(exportButton).toBeEnabled();
    await user.click(exportButton);

    await waitFor(() => {
      expect(click).toHaveBeenCalled();
    });
    const blob = vi.mocked(URL.createObjectURL).mock.calls[0][0] as Blob;
    const exported = JSON.parse(await blob.text());
    expect(exported).toMatchObject({ app: 'AegisVault', encrypted: false, version: '1.1.0' });
    expect(exported.vault).toEqual([expect.objectContaining({ title: 'GitHub' })]);
  });

  it('decrypts an encrypted AegisVault backup and imports selected records', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImportBackup = vi.fn(async () => undefined);
    vi.mocked(decryptData).mockResolvedValueOnce(
      JSON.stringify([
        { title: 'Imported GitHub', username: 'octo', password: 'Secret123!', type: 'login' },
        { title: 'Imported Card', cardNumber: '4111111111111111', type: 'card' },
      ])
    );
    const file = new File(
      [JSON.stringify({ encrypted: true, data: 'ciphertext', salt: 'salt-value', iv: 'iv-value' })],
      'aegis-encrypted.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={onImportBackup}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Import Backup' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.type(screen.getByPlaceholderText('Enter the backup encryption password'), 'VaultKey123!');
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(decryptData).toHaveBeenCalledWith('ciphertext', 'salt-value', 'iv-value', 'VaultKey123!', undefined, { allowLegacyPBKDF2: true });
    });
    expect(screen.getByText('Import review')).toBeInTheDocument();
    expect(screen.getByText('Legacy KDF compatibility')).toBeInTheDocument();
    expect(screen.getByText('RECORDS IN DOCUMENT (2)')).toBeInTheDocument();
    expect(screen.getByText('Imported GitHub')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import 2 Selected Records Into AegisVault' }));

    await waitFor(() => {
      expect(onImportBackup).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'Imported GitHub', username: 'octo', password: 'Secret123!' }),
          expect.objectContaining({ title: 'Imported Card', type: 'card' }),
        ]),
        false
      );
    });
    expect(screen.getByText('Import result report')).toBeInTheDocument();
    expect(screen.getByText(/2 selected record/)).toBeInTheDocument();
  });

  it('decrypts a secure share bundle in the database import flow and imports its entries', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImportBackup = vi.fn(async () => undefined);
    vi.mocked(decryptData).mockResolvedValueOnce(
      JSON.stringify({
        entries: [
          { title: 'Shared Mail', username: 'ada', password: 'MailShare123!', type: 'login' },
        ],
      })
    );
    const file = new File(
      [JSON.stringify({
        app: 'AegisVault',
        kind: 'secure-share-bundle',
        version: '1.0',
        encrypted: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        itemCount: 1,
        data: 'ciphertext',
        salt: 'salt-value',
        iv: 'iv-value',
        kdf: { algorithm: 'argon2id', version: 1, iterations: 3, memorySize: 65536, parallelism: 1, hashLength: 32 },
      })],
      'aegis-secure-share.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={onImportBackup}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Import Backup' }));
    await user.click(screen.getByRole('button', { name: 'Secure Share' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.type(screen.getByPlaceholderText('Enter the backup encryption password'), 'ShareKey123!');
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('RECORDS IN DOCUMENT (1)')).toBeInTheDocument();
    });
    expect(screen.getByText('Import review')).toBeInTheDocument();
    expect(screen.getByText(/Secure Share contains 1 item/)).toBeInTheDocument();
    expect(screen.getByText('Shared Mail')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Import 1 Selected Records Into AegisVault' }));

    await waitFor(() => {
      expect(onImportBackup).toHaveBeenCalledWith(
        [expect.objectContaining({ title: 'Shared Mail', username: 'ada', password: 'MailShare123!' })],
        false
      );
    });
    expect(screen.getByText('Import result report')).toBeInTheDocument();
    expect(screen.getByText('Secure Share import')).toBeInTheDocument();
  });

  it('rejects expired secure share bundles in the database import flow before decryption', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImportBackup = vi.fn();
    const file = new File(
      [JSON.stringify({
        app: 'AegisVault',
        kind: 'secure-share-bundle',
        version: '1.0',
        encrypted: true,
        createdAt: '2026-01-01T00:00:00.000Z',
        expiresAt: '2000-01-01T00:00:00.000Z',
        itemCount: 1,
        data: 'ciphertext',
        salt: 'salt-value',
        iv: 'iv-value',
        kdf: { algorithm: 'argon2id', version: 1, iterations: 3, memorySize: 65536, parallelism: 1, hashLength: 32 },
      })],
      'expired-secure-share.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={onImportBackup}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Import Backup' }));
    await user.click(screen.getByRole('button', { name: 'Secure Share' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.type(screen.getByPlaceholderText('Enter the backup encryption password'), 'ShareKey123!');
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('Wizard Error: Secure share bundle has expired.')).toBeInTheDocument();
    });
    expect(decryptData).not.toHaveBeenCalled();
    expect(onImportBackup).not.toHaveBeenCalled();
  });

  it('reports encrypted import validation errors before parsing records', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImportBackup = vi.fn();
    const encryptedFile = new File(
      [JSON.stringify({ encrypted: true, data: 'ciphertext', salt: 'salt-value', iv: 'iv-value' })],
      'encrypted-aegis.json',
      { type: 'application/json' }
    );
    const plainFile = new File(
      [JSON.stringify({ encrypted: false, vault: [{ title: 'Plain GitHub' }] })],
      'plain-aegis.json',
      { type: 'application/json' }
    );

    const { container } = render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={onImportBackup}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Import Backup' }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, encryptedFile);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));
    expect(screen.getByText('Wizard Error: Enter the backup password to decrypt the encrypted backup file.')).toBeInTheDocument();

    await user.upload(fileInput, plainFile);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));
    expect(screen.getByText('Wizard Error: The selected file does not contain encrypted items. Try the AegisVault Plain Text mode.')).toBeInTheDocument();
    expect(decryptData).not.toHaveBeenCalled();
    expect(onImportBackup).not.toHaveBeenCalled();
  });

  it('clears selected import file and parsed preview when switching database import source', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const csv = [
      'name,username,password,url',
      'GitHub,octo,Secret123!,https://github.com',
    ].join('\n');
    const file = new File([csv], 'vault.csv', { type: 'text/csv' });

    const { container } = render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={vi.fn()}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Import Backup' }));
    await user.click(screen.getByRole('button', { name: /CSV/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('RECORDS IN DOCUMENT (1)')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'AegisVault Encrypted' }));

    expect(screen.queryByText('vault.csv')).not.toBeInTheDocument();
    expect(screen.queryByText('RECORDS IN DOCUMENT (1)')).not.toBeInTheDocument();
    expect(screen.getByText('Drag or Select the Exported File Here')).toBeInTheDocument();
  });

  it('prevents importing when every parsed record is deselected', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImportBackup = vi.fn();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const csv = [
      'name,username,password,url',
      'GitHub,octo,Secret123!,https://github.com',
      'Email,ada,MailPass123!,https://mail.example.com',
    ].join('\n');
    const file = new File([csv], 'vault.csv', { type: 'text/csv' });

    const { container } = render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={onImportBackup}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Import Backup' }));
    await user.click(screen.getByRole('button', { name: /CSV/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('RECORDS IN DOCUMENT (2)')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Deselect' }));
    await user.click(screen.getByRole('button', { name: 'Import 0 Selected Records Into AegisVault' }));

    expect(alert).toHaveBeenCalledWith('Please select at least one record from the list to load into your vault.');
    expect(onImportBackup).not.toHaveBeenCalled();
  });

  it('reports database import write failures without discarding parsed records', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onImportBackup = vi.fn(async () => {
      throw new Error('database write failed');
    });
    const csv = [
      'name,username,password,url',
      'GitHub,octo,Secret123!,https://github.com',
    ].join('\n');
    const file = new File([csv], 'vault.csv', { type: 'text/csv' });

    const { container } = render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={onImportBackup}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Import Backup' }));
    await user.click(screen.getByRole('button', { name: /CSV/i }));
    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    await user.click(screen.getByRole('button', { name: 'Decrypt and Parse Backup File' }));

    await waitFor(() => {
      expect(screen.getByText('RECORDS IN DOCUMENT (1)')).toBeInTheDocument();
    });
    await user.click(screen.getByRole('button', { name: 'Import 1 Selected Records Into AegisVault' }));

    await waitFor(() => {
      expect(screen.getByText('An error occurred while writing: database write failed')).toBeInTheDocument();
    });
    expect(screen.getByText('GitHub')).toBeInTheDocument();
  });

  it('reports database analytics by active, deleted and typed records', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();

    render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[
          entry({ id: 'entry-1', title: 'GitHub', type: 'login' }),
          entry({ id: 'entry-2', title: 'Email', type: 'login' }),
          entry({ id: 'entry-3', title: 'Visa', type: 'card' }),
          entry({ id: 'entry-4', title: 'Recovery Codes', type: 'note' }),
          entry({ id: 'entry-5', title: 'SSH Notes', type: 'note' }),
          entry({ id: 'entry-6', title: 'Travel Note', type: 'note' }),
          entry({ id: 'entry-7', title: 'Archived Login', type: 'login', isDeleted: true }),
          entry({ id: 'entry-8', title: 'Archived Card', type: 'card', isDeleted: true }),
          entry({ id: 'entry-9', title: 'Archived Note', type: 'note', isDeleted: true }),
          entry({ id: 'entry-10', title: 'Archived Codes', type: 'note', isDeleted: true }),
        ]}
        onImportBackup={vi.fn()}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Data Analytics' }));

    expect(screen.getByText('Vault Storage Detail Analysis')).toBeInTheDocument();
    expect(screen.getByText('Total Items')).toBeInTheDocument();
    expect(screen.getByText('Active Cards and Passwords')).toBeInTheDocument();
    expect(screen.getByText('Logins / Passwords:')).toBeInTheDocument();
    expect(screen.getByText('Credit / Debit Cards:')).toBeInTheDocument();
    expect(screen.getByText('Secure Notes and Descriptions:')).toBeInTheDocument();
    expect(screen.getByText('Trash Items Pending Cleanup:')).toBeInTheDocument();
    expect(screen.getByText('Logins / Passwords:').parentElement).toHaveTextContent('2 Records');
    expect(screen.getByText('Credit / Debit Cards:').parentElement).toHaveTextContent('1 Records');
    expect(screen.getByText('Secure Notes and Descriptions:').parentElement).toHaveTextContent('3 Records');
    expect(screen.getByText('Trash Items Pending Cleanup:').parentElement).toHaveTextContent('4 Items');
    expect(screen.getByText('Total Items').parentElement).toHaveTextContent('10');
    expect(screen.getByText('Active Cards and Passwords').parentElement).toHaveTextContent('6');
  });

  it('imports selected records from a generic CSV backup', async () => {
    const user = userEvent.setup();
    const onImportBackup = vi.fn(async () => undefined);
    const csv = [
      'name,username,password,url,notes',
      'GitHub,octo,Secret123!,https://github.com,main account',
      'Email,ada,MailPass123!,https://mail.example.com,mailbox',
    ].join('\n');
    const file = new File([csv], 'vault.csv', { type: 'text/csv' });

    const { container } = render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={onImportBackup}
        onClearStorage={vi.fn()}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Yedek.*Aktar/i }));
    await user.click(screen.getByRole('button', { name: /CSV/i }));

    const fileInput = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(fileInput, file);
    expect(screen.getByText('vault.csv')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Yedek.*Ç.z|Yedek.*.z/i }));

    await waitFor(() => {
      expect(screen.getByText(/KAYITLAR \(2\)/i)).toBeInTheDocument();
    });
    expect(screen.getByText('GitHub')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();

    await user.click(screen.getByText(/S.f.rla.*Yaz|Sıfırla.*Yaz/i));
    await user.click(screen.getByRole('button', { name: /Se.ilen 2|Seçilen 2/i }));

    await waitFor(() => {
      expect(onImportBackup).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ title: 'GitHub', username: 'octo', password: 'Secret123!' }),
          expect.objectContaining({ title: 'Email', username: 'ada', password: 'MailPass123!' }),
        ]),
        true
      );
    });
  });

  it('requires explicit confirmation before wiping local storage', async () => {
    const user = userEvent.setup();
    const onClearStorage = vi.fn();
    const onAddLog = vi.fn();

    render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry(), entry({ id: 'entry-2', title: 'Email' })]}
        onImportBackup={vi.fn()}
        onClearStorage={onClearStorage}
        onAddLog={onAddLog}
      />
    );

    await user.click(screen.getByRole('button', { name: /S.f.rlama|Sıfırlama/i }));
    await user.click(screen.getByRole('button', { name: /Kal.c. Olarak Silme|Kalıcı Olarak Silme/i }));

    const deleteButton = screen.getByRole('button', { name: /Kal.c. Olarak Sil|Kalıcı Olarak Sil/i });
    expect(deleteButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText(/S.L yaz|SİL yaz/i), 'SIL');
    expect(deleteButton).toBeEnabled();
    await user.click(deleteButton);

    expect(onClearStorage).toHaveBeenCalled();
    expect(onAddLog).toHaveBeenCalledWith(expect.any(String));
    expect(screen.getByText(/temizlendi|imha/i)).toBeInTheDocument();
  });

  it('accepts the localized Turkish wipe confirmation phrase', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onClearStorage = vi.fn();

    render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={vi.fn()}
        onClearStorage={onClearStorage}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Start Permanent Vault Deletion Step' }));

    const deleteButton = screen.getByRole('button', { name: 'Delete Data Permanently' });
    expect(deleteButton).toBeDisabled();

    await user.type(screen.getByPlaceholderText('Type SIL to confirm'), 'SİL');
    expect(deleteButton).toBeEnabled();

    await user.click(deleteButton);
    expect(onClearStorage).toHaveBeenCalledTimes(1);
  });

  it('cancels database wipe confirmation and resets typed confirmation text', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onClearStorage = vi.fn();

    render(
      <DatabaseModal
        isOpen
        onClose={vi.fn()}
        entries={[entry()]}
        onImportBackup={vi.fn()}
        onClearStorage={onClearStorage}
        onAddLog={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Reset' }));
    await user.click(screen.getByRole('button', { name: 'Start Permanent Vault Deletion Step' }));
    await user.type(screen.getByPlaceholderText('Type SIL to confirm'), 'SIL');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onClearStorage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'Delete Data Permanently' })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start Permanent Vault Deletion Step' }));
    expect(screen.getByPlaceholderText('Type SIL to confirm')).toHaveValue('');
  });
});

