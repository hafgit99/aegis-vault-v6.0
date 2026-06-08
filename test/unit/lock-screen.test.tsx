import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import i18n from '../../src/i18n';
import LockScreen from '../../src/components/LockScreen';
import {
  clearBiometricUnlockBundle,
  getBiometricUnlockBundle,
  getBiometricUnlockStatus,
  saveBiometricUnlockBundle,
} from '../../src/lib/biometricUnlock';
import { clearAllOPFSFiles } from '../../src/lib/SQLiteOPFS';
import { vaultService } from '../../src/lib/vaultService';

vi.mock('../../src/lib/vaultService', () => ({
  vaultService: {
    initDb: vi.fn(),
  },
}));

vi.mock('../../src/lib/SQLiteOPFS', () => ({
  clearAllOPFSFiles: vi.fn(),
}));

vi.mock('../../src/lib/biometricUnlock', () => ({
  clearBiometricUnlockBundle: vi.fn().mockResolvedValue(undefined),
  getBiometricUnlockBundle: vi.fn(),
  getBiometricUnlockStatus: vi.fn(),
  saveBiometricUnlockBundle: vi.fn().mockResolvedValue(undefined),
}));

describe('LockScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.mocked(getBiometricUnlockStatus).mockResolvedValue({
      isAvailable: false,
      isEnrolled: false,
      hasBundle: false,
      label: 'Biometric unlock',
    });
  });

  it('switches between Turkish, English, and Chinese content', async () => {
    const user = userEvent.setup();

    render(<LockScreen onUnlock={vi.fn()} onAddLog={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Kasa Ayarlarını Yapın' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'EN' }));
    expect(await screen.findByRole('heading', { name: /Configure Your Vault/i })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /中文|ä¸­æ–‡/i }));
    expect(await screen.findByRole('heading', { name: /配置保险库|é…ç½®ä¿é™©åº“/i })).toBeInTheDocument();
  });

  it('validates setup password length before generating a secret key', async () => {
    const user = userEvent.setup();

    render(<LockScreen onUnlock={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText(/12 haneli/), 'short');
    await user.type(screen.getByPlaceholderText(/yeniden/), 'short');
    await user.click(screen.getByRole('button', { name: /Devam Et/i }));

    expect(await screen.findByText(/en az 12 karakter/i)).toBeInTheDocument();
  });

  it('validates setup password confirmation before generating a secret key', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();

    render(<LockScreen onUnlock={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Strong password, at least 12 characters'), 'MasterPassword123!');
    await user.type(screen.getByPlaceholderText('Re-enter the password'), 'DifferentPassword123!');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    expect(await screen.findByText('Passwords do not match.')).toBeInTheDocument();
    expect(screen.queryByText(/^A3-/)).not.toBeInTheDocument();
    expect(vaultService.initDb).not.toHaveBeenCalled();
  });

  it('completes setup, stores the generated secret key, and unlocks the vault', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    const onAddLog = vi.fn();

    render(<LockScreen onUnlock={onUnlock} onAddLog={onAddLog} />);

    await user.type(screen.getByPlaceholderText(/12 haneli/), 'MasterPassword123!');
    await user.type(screen.getByPlaceholderText(/yeniden/), 'MasterPassword123!');
    await user.click(screen.getByRole('button', { name: /Devam Et/i }));

    const generatedKey = await screen.findByText(/^A3-/);
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);
    await user.click(screen.getByRole('button', { name: /Kopyala/i }));
    expect(writeText).toHaveBeenCalledWith(generatedKey.textContent);

    await user.click(screen.getByRole('button', { name: /Kayıtları Onayla|Kay.tlar. Onayla/i }));

    await waitFor(() => {
      expect(vaultService.initDb).toHaveBeenCalledWith('MasterPassword123!', generatedKey.textContent, true);
    });
    expect(localStorage.getItem('aegis_vault_configured')).toBe('true');
    expect(localStorage.getItem('aegis_secret_key')).toBeNull();
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe(generatedKey.textContent);
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_secret_key_session_only_warning')).toBe('session-only');
    expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'warning');
    expect(onUnlock).toHaveBeenCalled();
  });

  it('downloads an emergency kit and can avoid remembering setup secret key', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: click });
        Object.defineProperty(element, 'remove', { configurable: true, value: vi.fn() });
      }
      return element;
    });

    render(<LockScreen onUnlock={vi.fn()} onAddLog={onAddLog} />);

    await user.type(screen.getByPlaceholderText('Strong password, at least 12 characters'), 'MasterPassword123!');
    await user.type(screen.getByPlaceholderText('Re-enter the password'), 'MasterPassword123!');
    await user.click(screen.getByRole('button', { name: /Continue/i }));

    const generatedKey = await screen.findByText(/^A3-/);
    await user.click(screen.getByRole('button', { name: 'Download Security Kit' }));

    const anchor = appendChild.mock.calls.at(-1)?.[0] as HTMLAnchorElement;
    expect(anchor.getAttribute('download')).toBe('aegisvault_emergency_kit.txt');
    expect(decodeURIComponent(anchor.getAttribute('href') || '')).toContain(generatedKey.textContent || '');
    expect(click).toHaveBeenCalled();
    expect(onAddLog).toHaveBeenCalledWith('Emergency safety kit (.txt) downloaded.', 'info');

    await user.click(screen.getByLabelText('Remember the secret on this device'));
    await user.click(screen.getByRole('button', { name: 'Confirm Records and Open Vault' }));

    await waitFor(() => {
      expect(vaultService.initDb).toHaveBeenCalledWith('MasterPassword123!', generatedKey.textContent, true);
    });
    expect(localStorage.getItem('aegis_vault_configured')).toBe('true');
    expect(localStorage.getItem('aegis_secret_key')).toBeNull();
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe(generatedKey.textContent);
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
  });

  it('surfaces setup initialization failures without storing generated keys', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    vi.mocked(vaultService.initDb).mockRejectedValueOnce(new Error('setup failed hard'));

    render(<LockScreen onUnlock={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Strong password, at least 12 characters'), 'MasterPassword123!');
    await user.type(screen.getByPlaceholderText('Re-enter the password'), 'MasterPassword123!');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByText(/^A3-/);
    await user.click(screen.getByRole('button', { name: 'Confirm Records and Open Vault' }));

    expect(await screen.findByText('setup failed hard')).toBeInTheDocument();
    expect(localStorage.getItem('aegis_secret_key')).toBeNull();
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
  });

  it('logs in with a remembered secret key and can forget the device', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    localStorage.setItem('aegis_secret_key', 'A3-STORED-STORED-KEY01-KEY02');
    localStorage.setItem('aegis_remembered_secret_key', 'A3-REMEMBERED-KEY01-KEY02-KEY03');

    render(<LockScreen onUnlock={onUnlock} onAddLog={vi.fn()} />);

    expect(await screen.findByDisplayValue('A3-REMEMBERED-KEY01-KEY02-KEY03')).toBeInTheDocument();
    await user.type(screen.getByPlaceholderText(/Master.*girin/i), 'MasterPassword123!');
    const rememberDevice = screen.getByRole('checkbox');
    await user.click(rememberDevice);
    expect(rememberDevice).not.toBeChecked();
    await user.click(screen.getByRole('button', { name: /Kilitli Kasayı Aç|Kilitli Kasay. A./i }));

    await waitFor(() => {
      expect(vaultService.initDb).toHaveBeenCalledWith(
        'MasterPassword123!',
        'A3-REMEMBERED-KEY01-KEY02-KEY03',
        false
      );
    });
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_vault_configured')).toBe('true');
    expect(localStorage.getItem('aegis_secret_key')).toBeNull();
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe('A3-REMEMBERED-KEY01-KEY02-KEY03');
    expect(onUnlock).toHaveBeenCalled();
  });

  it('stores a biometric unlock bundle when the user opts in during login', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    vi.mocked(getBiometricUnlockStatus).mockResolvedValue({
      isAvailable: true,
      isEnrolled: true,
      hasBundle: false,
      label: 'Windows Hello / Touch ID',
    });
    localStorage.setItem('aegis_vault_configured', 'true');

    render(<LockScreen onUnlock={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Enter your master password'), 'MasterPassword123!');
    await user.type(screen.getByPlaceholderText('A3-XXXXXX-XXXXXX-XXXXX-XXXXX'), 'A3-BIOMET-BUNDLE-KEY01-KEY02');
    await screen.findByLabelText('Enable hardware biometric unlock with Windows Hello / Touch ID');
    await user.click(screen.getByRole('button', { name: 'Open Locked Vault' }));

    await waitFor(() => {
      expect(saveBiometricUnlockBundle).toHaveBeenCalledWith(
        'MasterPassword123!',
        'A3-BIOMET-BUNDLE-KEY01-KEY02'
      );
    });
  });

  it('unlocks with a biometric bundle when hardware authentication succeeds', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    const onAddLog = vi.fn();
    vi.mocked(getBiometricUnlockStatus).mockResolvedValue({
      isAvailable: true,
      isEnrolled: true,
      hasBundle: true,
      label: 'Windows Hello / Touch ID',
    });
    vi.mocked(getBiometricUnlockBundle).mockResolvedValue({
      version: 1,
      masterPassword: 'MasterPassword123!',
      secretKey: 'A3-BIOMET-BUNDLE-KEY01-KEY02',
      createdAt: new Date().toISOString(),
    });
    localStorage.setItem('aegis_vault_configured', 'true');

    render(<LockScreen onUnlock={onUnlock} onAddLog={onAddLog} />);

    await user.click(await screen.findByRole('button', { name: 'Unlock with Windows Hello / Touch ID' }));

    await waitFor(() => {
      expect(vaultService.initDb).toHaveBeenCalledWith(
        'MasterPassword123!',
        'A3-BIOMET-BUNDLE-KEY01-KEY02',
        false
      );
    });
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe('A3-BIOMET-BUNDLE-KEY01-KEY02');
    expect(onAddLog).toHaveBeenCalledWith('Vault opened with hardware biometric unlock.', 'info');
    expect(onUnlock).toHaveBeenCalled();
  });

  it('surfaces unlock failures and records a critical log', async () => {
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    vi.mocked(vaultService.initDb).mockRejectedValueOnce(new Error('bad credentials'));
    localStorage.setItem('aegis_secret_key', 'A3-STORED-STORED-KEY01-KEY02');

    render(<LockScreen onUnlock={vi.fn()} onAddLog={onAddLog} />);

    await user.type(screen.getByPlaceholderText(/Master.*girin/i), 'wrong-password');
    await user.type(screen.getByPlaceholderText('A3-XXXXXX-XXXXXX-XXXXX-XXXXX'), 'A3-STORED-STORED-KEY01-KEY02');
    await user.click(screen.getByRole('button', { name: /Kilitli Kasayı Aç|Kilitli Kasay. A./i }));

    expect(await screen.findByText('bad credentials')).toBeInTheDocument();
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('bad credentials'), 'critical');
  });

  it('applies progressive unlock backoff after repeated failed attempts', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    vi.mocked(vaultService.initDb).mockRejectedValueOnce(new Error('bad credentials'));
    localStorage.setItem('aegis_vault_configured', 'true');
    localStorage.setItem('aegis_unlock_guard', JSON.stringify({
      failedAttempts: 4,
      delayUntil: 0,
      lockedUntil: 0,
    }));

    render(<LockScreen onUnlock={vi.fn()} onAddLog={onAddLog} />);

    await user.type(screen.getByPlaceholderText('Enter your master password'), 'wrong-password');
    await user.type(screen.getByPlaceholderText('A3-XXXXXX-XXXXXX-XXXXX-XXXXX'), 'A3-STORED-STORED-KEY01-KEY02');
    await user.click(screen.getByRole('button', { name: 'Open Locked Vault' }));

    expect(await screen.findByText('Too many failed unlock attempts. Try again in 1 seconds.')).toBeInTheDocument();
    const guard = JSON.parse(localStorage.getItem('aegis_unlock_guard') || '{}');
    expect(guard.failedAttempts).toBe(5);
    expect(guard.delayUntil).toBeGreaterThan(Date.now());
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('Unlock backoff activated'), 'warning');
    expect(screen.getByRole('button', { name: 'Open Locked Vault' })).toBeDisabled();
  });

  it('locks vault unlock for five minutes after fifteen failed attempts', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    vi.mocked(vaultService.initDb).mockRejectedValueOnce(new Error('bad credentials'));
    localStorage.setItem('aegis_vault_configured', 'true');
    localStorage.setItem('aegis_unlock_guard', JSON.stringify({
      failedAttempts: 14,
      delayUntil: 0,
      lockedUntil: 0,
    }));

    render(<LockScreen onUnlock={vi.fn()} onAddLog={onAddLog} />);

    await user.type(screen.getByPlaceholderText('Enter your master password'), 'wrong-password');
    await user.type(screen.getByPlaceholderText('A3-XXXXXX-XXXXXX-XXXXX-XXXXX'), 'A3-STORED-STORED-KEY01-KEY02');
    await user.click(screen.getByRole('button', { name: 'Open Locked Vault' }));

    expect(await screen.findByText('Too many failed unlock attempts. Vault unlock is locked for 5 minutes.')).toBeInTheDocument();
    const guard = JSON.parse(localStorage.getItem('aegis_unlock_guard') || '{}');
    expect(guard.failedAttempts).toBe(15);
    expect(guard.lockedUntil).toBeGreaterThan(Date.now() + 4 * 60 * 1000);
    expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('locked for 5 minutes'), 'critical');
    expect(screen.getByRole('button', { name: 'Open Locked Vault' })).toBeDisabled();
  });

  it('resets local vault keys after confirmation while preserving language', async () => {
    const user = userEvent.setup();
    const onAddLog = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);
    localStorage.setItem('aegis_secret_key', 'A3-STORED-STORED-KEY01-KEY02');
    localStorage.setItem('aegis_remembered_secret_key', 'A3-REMEMBERED-KEY01-KEY02-KEY03');

    render(<LockScreen onUnlock={vi.fn()} onAddLog={onAddLog} />);

    await user.click(screen.getByRole('button', { name: /Anahtarları Sıfırla|Anahtarlar. S.f.rla/i }));

    await waitFor(() => {
      expect(clearAllOPFSFiles).toHaveBeenCalled();
    });
    expect(clearBiometricUnlockBundle).toHaveBeenCalled();
    expect(localStorage.getItem('aegis_secret_key')).toBeNull();
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_language')).toBe('tr');
    expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'warning');
  });

  it('does not reset local vault keys when reset confirmation is cancelled', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    vi.spyOn(window, 'confirm').mockReturnValue(false);
    localStorage.setItem('aegis_secret_key', 'A3-STORED-STORED-KEY01-KEY02');
    localStorage.setItem('aegis_remembered_secret_key', 'A3-REMEMBERED-KEY01-KEY02-KEY03');

    render(<LockScreen onUnlock={vi.fn()} onAddLog={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: 'Reset Keys and Reconfigure' }));

    expect(clearAllOPFSFiles).not.toHaveBeenCalled();
    expect(localStorage.getItem('aegis_secret_key')).toBe('A3-STORED-STORED-KEY01-KEY02');
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
    expect(sessionStorage.getItem('aegis_session_secret_key')).toBe('A3-REMEMBERED-KEY01-KEY02-KEY03');
    expect(localStorage.getItem('aegis_secret_key_session_only_warning')).toBe('session-only');
  });
});
