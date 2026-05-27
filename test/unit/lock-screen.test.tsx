import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import i18n from '../../src/i18n';
import LockScreen from '../../src/components/LockScreen';
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

describe('LockScreen', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('tr');
    vi.clearAllMocks();
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

    await user.type(screen.getByPlaceholderText(/8 haneli/), 'short');
    await user.type(screen.getByPlaceholderText(/yeniden/), 'short');
    await user.click(screen.getByRole('button', { name: /Devam Et/i }));

    expect(await screen.findByText(/en az 8 karakter/i)).toBeInTheDocument();
  });

  it('validates setup password confirmation before generating a secret key', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();

    render(<LockScreen onUnlock={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Strong password, at least 8 characters'), 'MasterPassword123!');
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

    await user.type(screen.getByPlaceholderText(/8 haneli/), 'MasterPassword123!');
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
    expect(localStorage.getItem('aegis_secret_key')).toBe(generatedKey.textContent);
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBe(generatedKey.textContent);
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

    await user.type(screen.getByPlaceholderText('Strong password, at least 8 characters'), 'MasterPassword123!');
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
    expect(localStorage.getItem('aegis_secret_key')).toBe(generatedKey.textContent);
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
  });

  it('surfaces setup initialization failures without storing generated keys', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    vi.mocked(vaultService.initDb).mockRejectedValueOnce(new Error('setup failed hard'));

    render(<LockScreen onUnlock={vi.fn()} onAddLog={vi.fn()} />);

    await user.type(screen.getByPlaceholderText('Strong password, at least 8 characters'), 'MasterPassword123!');
    await user.type(screen.getByPlaceholderText('Re-enter the password'), 'MasterPassword123!');
    await user.click(screen.getByRole('button', { name: /Continue/i }));
    await screen.findByText(/^A3-/);
    await user.click(screen.getByRole('button', { name: 'Confirm Records and Open Vault' }));

    expect(await screen.findByText('setup failed hard')).toBeInTheDocument();
    expect(localStorage.getItem('aegis_secret_key')).toBeNull();
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBeNull();
  });

  it('logs in with a remembered secret key and can forget the device', async () => {
    const user = userEvent.setup();
    const onUnlock = vi.fn();
    localStorage.setItem('aegis_secret_key', 'A3-STORED-STORED-KEY01-KEY02');
    localStorage.setItem('aegis_remembered_secret_key', 'A3-REMEMBERED-KEY01-KEY02-KEY03');

    render(<LockScreen onUnlock={onUnlock} onAddLog={vi.fn()} />);

    expect(screen.getByDisplayValue('A3-REMEMBERED-KEY01-KEY02-KEY03')).toBeInTheDocument();
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
    expect(localStorage.getItem('aegis_secret_key')).toBeNull();
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
    expect(localStorage.getItem('aegis_remembered_secret_key')).toBe('A3-REMEMBERED-KEY01-KEY02-KEY03');
  });
});
