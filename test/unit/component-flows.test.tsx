import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { act } from 'react';
import { describe, expect, it, vi } from 'vitest';
import '../../src/i18n';
import i18n from '../../src/i18n';
import AddEntryModal from '../../src/components/AddEntryModal';
import DetailPanel from '../../src/components/DetailPanel';
import ProfileModal from '../../src/components/ProfileModal';
import SecurityAudit from '../../src/components/SecurityAudit';
import SecurityLogsModal from '../../src/components/SecurityLogsModal';
import Sidebar from '../../src/components/Sidebar';
import TrashBin from '../../src/components/TrashBin';
import { VaultEntry } from '../../src/types';

const fileStoreMock = vi.hoisted(() => ({
  getEncryptedFile: vi.fn(async () => new Blob(['attachment payload'], { type: 'text/plain' })),
  saveEncryptedFile: vi.fn(async () => undefined),
}));

vi.mock('../../src/lib/fileStore', () => fileStoreMock);

const baseEntry = (entry: Partial<VaultEntry>): VaultEntry => ({
  id: entry.id ?? 'entry-1',
  title: entry.title ?? 'Entry',
  subtitle: entry.subtitle ?? 'entry@example.com',
  username: entry.username ?? 'entry@example.com',
  password: entry.password ?? 'StrongPassword123!',
  strength: entry.strength ?? 'EXCELLENT',
  themeColor: entry.themeColor ?? 'tertiary',
  type: entry.type ?? 'login',
  createdAt: entry.createdAt ?? '2026-01-01T00:00:00.000Z',
  ...entry,
});

describe('AddEntryModal', () => {
  it('does not render or save when closed or missing a required title', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    const { container, rerender } = render(<AddEntryModal isOpen={false} onClose={onClose} onSave={onSave} />);

    expect(container).toBeEmptyDOMElement();

    rerender(<AddEntryModal isOpen onClose={onClose} onSave={onSave} />);
    const saveButton = screen.getByRole('button', { name: 'Save Item' });

    expect(saveButton).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onSave).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('saves a login entry with localized form fields', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();

    render(<AddEntryModal isOpen onClose={onClose} onSave={onSave} />);

    await user.type(screen.getByPlaceholderText(/ProtonMail/i), 'GitHub');
    await user.type(screen.getByPlaceholderText(/e-posta adresi/i), 'octo@example.com');
    await user.type(screen.getByPlaceholderText('şifre belirleyin'), 'Secret123!');
    await user.type(screen.getByPlaceholderText('https://example.com'), 'https://github.com');
    await user.click(screen.getByRole('button', { name: 'Ögeyi Kaydet' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'GitHub',
      username: 'octo@example.com',
      password: 'Secret123!',
      url: 'https://github.com',
      type: 'login',
      strength: 'GOOD',
    }));
    expect(onClose).toHaveBeenCalled();
  });

  it('saves a card entry and masks the subtitle with the final digits', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<AddEntryModal isOpen onClose={vi.fn()} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Kredi Kartı' }));
    await user.type(screen.getByPlaceholderText(/ProtonMail/i), 'Backup Visa');
    await user.type(screen.getByPlaceholderText('Kart üzerindeki isim'), 'Ada Lovelace');
    await user.type(screen.getByPlaceholderText('0000 0000 0000 0000'), '4111111111111111');
    await user.type(screen.getByPlaceholderText('AA/YY'), '12/30');
    await user.type(screen.getByPlaceholderText('***'), '123');
    await user.click(screen.getByRole('button', { name: 'Ögeyi Kaydet' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Backup Visa',
      type: 'card',
      cardholder: 'Ada Lovelace',
      cardNumber: '4111 1111 1111 1111',
      expiryDate: '12/30',
      cvv: '123',
      subtitle: expect.stringContaining('1111'),
    }));
  });

  it('saves a passkey entry with generated credential metadata', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<AddEntryModal isOpen onClose={vi.fn()} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Passkey' }));
    await user.type(screen.getByPlaceholderText(/ProtonMail/i), 'GitHub Passkey');
    await user.type(screen.getByPlaceholderText(/google.com/i), 'github.com');
    await user.type(screen.getByPlaceholderText(/email address/i), 'octo@example.com');
    await user.click(screen.getByRole('button', { name: /Generate Secure Key/i }));
    await user.click(screen.getByRole('button', { name: 'Save Item' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'GitHub Passkey',
      type: 'passkey',
      username: 'octo@example.com',
      passkeyDomain: 'github.com',
      passkeyUser: 'octo@example.com',
      passkeyCredentialId: expect.stringMatching(/^[a-f0-9]{32}$/),
      passkeyPublicKey: expect.stringContaining('BEGIN PUBLIC KEY'),
      passkeyAAGUID: expect.stringMatching(/^adce0002-35bc-c60a-2b7b-/),
      strength: 'IMMUTABLE',
      subtitle: 'Passkey (github.com)',
    }));
  });

  it('generates an inline login password and saves excellent strength', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<AddEntryModal isOpen onClose={vi.fn()} onSave={onSave} />);

    await user.type(screen.getByPlaceholderText(/ProtonMail/i), 'Generated Login');
    await user.type(screen.getByPlaceholderText(/email address/i), 'generated@example.com');
    await user.click(screen.getByTitle('Generate Random Strong Password'));
    await user.click(screen.getByRole('button', { name: 'Save Item' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Generated Login',
      username: 'generated@example.com',
      type: 'login',
      password: expect.any(String),
      strength: 'EXCELLENT',
      themeColor: 'tertiary',
    }));
    expect(onSave.mock.calls[0][0].password.length).toBeGreaterThan(12);
  });

  it('saves an identity entry and derives the title from the full name', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(<AddEntryModal isOpen onClose={vi.fn()} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Identity Card' }));
    await user.type(screen.getByPlaceholderText(/full name/i), 'Ada Lovelace');
    await user.type(screen.getByPlaceholderText(/national ID/i), 'ABC123456789');
    await user.type(screen.getByPlaceholderText(/A12B34567/i), 'xy987');
    const nationalityInput = screen.getByDisplayValue('Turkey');
    await user.clear(nationalityInput);
    await user.type(nationalityInput, 'TR');
    await user.selectOptions(screen.getByRole('combobox'), 'female');
    await user.click(screen.getByRole('button', { name: 'Save Item' }));

    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Ada Lovelace Identity Card',
      type: 'identity',
      username: 'Ada Lovelace',
      idFullName: 'Ada Lovelace',
      idNumber: '123456789',
      idSerial: 'XY987',
      idNationality: 'TR',
      idGender: 'female',
      strength: 'IMMUTABLE',
      subtitle: 'Identity: Ada Lovelace',
    }));
  });

  it('shows an attachment size error before saving oversized files', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onSave = vi.fn();

    const { container } = render(<AddEntryModal isOpen onClose={vi.fn()} onSave={onSave} />);
    const hugeFile = new File(['x'], 'huge.zip', { type: 'application/zip' });
    Object.defineProperty(hugeFile, 'size', { configurable: true, value: 201 * 1024 * 1024 });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, hugeFile);

    expect(screen.getByText('File size cannot exceed the 200MB limit.')).toBeInTheDocument();
    expect(fileStoreMock.saveEncryptedFile).not.toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves a secure note with an encrypted attachment and can remove it before saving', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onSave = vi.fn();

    const { container } = render(<AddEntryModal isOpen onClose={vi.fn()} onSave={onSave} />);

    await user.click(screen.getByRole('button', { name: 'Secure Note' }));
    await user.type(screen.getByPlaceholderText(/ProtonMail/i), 'Recovery Note');
    await user.type(screen.getByPlaceholderText('Add secret details, recovery codes, or encrypted reminders for this item'), 'Keep offline only.');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['payload'], 'recovery.txt', { type: 'text/plain' }));

    await waitFor(() => {
      expect(fileStoreMock.saveEncryptedFile).toHaveBeenCalledWith(expect.stringMatching(/^file-/), expect.any(Blob));
    });
    await waitFor(() => {
      expect(screen.getByText('recovery.txt')).toBeInTheDocument();
    });

    await user.click(screen.getByTitle('Remove File Attachment'));
    expect(screen.queryByText('recovery.txt')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Save Item' }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({
      title: 'Recovery Note',
      type: 'note',
      notes: 'Keep offline only.',
      subtitle: 'Secure Note',
      attachment: undefined,
    }));
  });
});

describe('SecurityAudit', () => {
  it('surfaces weak and reused passwords and can reveal a duplicate password', async () => {
    const user = userEvent.setup();
    localStorage.setItem('aegis_master_password', 'short');
    const entries = [
      baseEntry({ id: '1', title: 'GitHub', username: 'octo', password: 'shared123', strength: 'GOOD' }),
      baseEntry({ id: '2', title: 'Email', username: 'ada', password: 'shared123', strength: 'GOOD' }),
      baseEntry({ id: '3', title: 'Bank', password: 'VeryStrongPassword123!', strength: 'IMMUTABLE' }),
      baseEntry({ id: '4', title: 'Deleted', password: 'shared123', isDeleted: true }),
    ];

    render(<SecurityAudit entries={entries} />);

    expect(screen.getByRole('heading', { name: 'Güvenlik Denetimi' })).toBeInTheDocument();
    expect(screen.getByText('Çakışan Parola Eşleşmeleri (1)')).toBeInTheDocument();
    expect(screen.getByText('Güçlendirilmesi Önerilen Zayıf Şifreler (2)')).toBeInTheDocument();
    expect(screen.getAllByText('GitHub')).toHaveLength(2);
    expect(screen.getAllByText('Email')).toHaveLength(2);
    expect(screen.queryByText('Deleted')).not.toBeInTheDocument();

    await user.click(screen.getByTitle('Göster'));
    expect(screen.getByText('shared123')).toBeInTheDocument();
  });
  it('shows clean audit states for unique strong passwords and a strong master key', async () => {
    await i18n.changeLanguage('en');
    localStorage.setItem('aegis_master_password', 'VeryStrongMasterKey123!');

    render(
      <SecurityAudit
        entries={[
          baseEntry({ id: '1', title: 'Bank', username: 'ada', password: 'VeryStrongPassword123!', strength: 'EXCELLENT' }),
          baseEntry({ id: '2', title: 'Mail', username: '', password: 'AnotherStrongPassword456!', strength: 'IMMUTABLE' }),
          baseEntry({ id: '3', title: 'Card', type: 'card', password: undefined }),
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Security Audit' })).toBeInTheDocument();
    expect(screen.getByText('PERFECT')).toBeInTheDocument();
    expect(screen.getByText('Zero Collisions')).toBeInTheDocument();
    expect(screen.getByText('All Secure')).toBeInTheDocument();
    expect(screen.getByText('Great! No Colliding Records Found')).toBeInTheDocument();
    expect(screen.getByText('Nice! No Weak Passwords')).toBeInTheDocument();
    expect(screen.getByText(/exceeds the 12-character threshold/)).toBeInTheDocument();
    expect(screen.queryByText('Show All')).not.toBeInTheDocument();
  });

  it('collapses and expands duplicate password groups', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();

    render(
      <SecurityAudit
        entries={[
          baseEntry({ id: '1', title: 'GitHub', username: 'octo', password: 'shared123', strength: 'GOOD' }),
          baseEntry({ id: '2', title: 'Email', username: 'ada', password: 'shared123', strength: 'GOOD' }),
          baseEntry({ id: '3', title: 'Calendar', username: 'time', password: 'shared123', strength: 'GOOD' }),
        ]}
      />
    );

    expect(screen.getByText('Risky Record Details:')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Collapse All' }));
    expect(screen.getByRole('button', { name: 'Show All' })).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Show All' }));
    expect(screen.getByRole('button', { name: 'Collapse All' })).toBeInTheDocument();
    expect(screen.getByText('Risky Record Details:')).toBeInTheDocument();

    await user.click(screen.getByText(/Records Collide/));
    expect(screen.getByRole('button', { name: 'Show All' })).toBeInTheDocument();
  });
});

describe('DetailPanel', () => {
  it('renders nothing when no entry is selected', () => {
    const { container } = render(
      <DetailPanel
        entry={null}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('updates login details, toggles favorite, and confirms trash move', async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'login-1',
          title: 'GitHub',
          username: 'octo',
          subtitle: 'octo',
          password: 'Secret123!',
          url: 'https://github.com',
          notes: 'Recovery stored offline',
        })}
        onClose={onClose}
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByRole('heading', { name: 'GitHub' })).toBeInTheDocument();
    expect(screen.getByText('Recovery stored offline')).toBeInTheDocument();

    await user.click(screen.getByTitle('Favorilere Ekle'));
    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'login-1', favorite: true }));

    await user.click(screen.getByRole('button', { name: 'Düzenle' }));
    const titleInput = screen.getByDisplayValue('GitHub');
    await user.clear(titleInput);
    await user.type(titleInput, 'GitHub Enterprise');

    const usernameInput = screen.getByDisplayValue('octo');
    await user.clear(usernameInput);
    await user.type(usernameInput, 'enterprise-octo');

    await user.click(screen.getByRole('button', { name: 'Değişiklikleri Kaydet' }));
    expect(onUpdate).toHaveBeenLastCalledWith(expect.objectContaining({
      id: 'login-1',
      title: 'GitHub Enterprise',
      username: 'enterprise-octo',
      subtitle: 'enterprise-octo',
    }));

    await user.click(screen.getByRole('button', { name: 'Çöpe Taşı' }));
    expect(onDelete).toHaveBeenCalledWith('login-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('edits identity details and normalizes numeric identity fields', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'identity-1',
          title: 'Ada ID',
          type: 'identity',
          username: 'Ada Lovelace',
          idFullName: 'Ada Lovelace',
          idNumber: '123',
          idSerial: 'AB123',
          idNationality: 'TR',
          idGender: 'female',
          idBirthDate: '1815-12-10',
          idExpiry: '01.01.2030',
          strength: 'IMMUTABLE',
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));

    const nameInput = screen.getByDisplayValue('Ada Lovelace');
    await user.clear(nameInput);
    await user.type(nameInput, 'Grace Hopper');

    const idInput = screen.getByDisplayValue('123');
    await user.clear(idInput);
    await user.type(idInput, 'ID-987654321');

    await user.selectOptions(screen.getByRole('combobox'), 'other');
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'identity-1',
      title: 'Ada ID',
      username: 'Grace Hopper',
      idFullName: 'Grace Hopper',
      idNumber: '987654321',
      idGender: 'other',
      strength: 'IMMUTABLE',
      subtitle: 'Identity: Grace Hopper',
    }));
  });

  it('edits card details and keeps deletion behind confirmation', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'card-1',
          title: 'Travel Visa',
          type: 'card',
          cardholder: 'Ada Lovelace',
          cardNumber: '4111 1111 1111 1111',
          expiryDate: '12/30',
          cvv: '123',
          strength: 'EXCELLENT',
        })}
        onClose={onClose}
        onDelete={onDelete}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText('Ada Lovelace')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Move to Trash' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const holderInput = screen.getByDisplayValue('Ada Lovelace');
    await user.clear(holderInput);
    await user.type(holderInput, 'Grace Hopper');

    const cardInput = screen.getByDisplayValue('4111 1111 1111 1111');
    await user.clear(cardInput);
    await user.type(cardInput, '5555444433332222');

    const expiryInput = screen.getByDisplayValue('12/30');
    await user.clear(expiryInput);
    await user.type(expiryInput, '01/31');

    const cvvInput = screen.getByDisplayValue('123');
    await user.clear(cvvInput);
    await user.type(cvvInput, '987');
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'card-1',
      type: 'card',
      cardholder: 'Grace Hopper',
      cardNumber: '5555 4444 3333 2222',
      expiryDate: '01/31',
      cvv: '987',
      subtitle: expect.stringContaining('2222'),
    }));
  });

  it('edits secure note entries and saves note-specific defaults', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'note-1',
          title: 'Recovery Procedure',
          type: 'note',
          username: undefined,
          password: undefined,
          notes: '',
          strength: 'GOOD',
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
      />
    );

    expect(screen.getByText('No note content found.')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('Recovery Procedure');
    await user.clear(titleInput);
    await user.type(titleInput, 'Recovery Runbook');
    await user.type(screen.getByPlaceholderText('Add private documents for this item'), 'Rotate emergency keys quarterly.');
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'note-1',
      title: 'Recovery Runbook',
      type: 'note',
      password: undefined,
      notes: 'Rotate emergency keys quarterly.',
      subtitle: 'Secure Note',
      strength: 'GOOD',
      themeColor: 'secondary',
    }));
  });

  it('copies passkey secrets and saves refreshed passkey metadata', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'passkey-1',
          title: 'GitHub Passkey',
          type: 'passkey',
          passkeyDomain: 'github.com',
          passkeyUser: 'octo@example.com',
          passkeyCredentialId: 'cred-123',
          passkeyPublicKey: 'public-key-abc',
          passkeyAAGUID: 'aaguid-xyz',
          strength: 'IMMUTABLE',
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
      />
    );

    let credentialRow = screen.getByText('cred-123').parentElement as HTMLElement | null;
    while (credentialRow && !credentialRow.querySelector('button')) {
      credentialRow = credentialRow.parentElement;
    }
    const credentialCopyButton = credentialRow!.querySelector('button') as HTMLButtonElement;
    await user.click(credentialCopyButton);
    expect(writeText).toHaveBeenCalled();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: /Refresh/i }));
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'passkey-1',
      type: 'passkey',
      username: 'octo@example.com',
      passkeyDomain: 'github.com',
      passkeyCredentialId: expect.stringMatching(/^[a-f0-9]{32}$/),
      passkeyPublicKey: expect.stringContaining('BEGIN PUBLIC KEY'),
      passkeyAAGUID: expect.stringMatching(/^adce0002-35bc-c60a-2b7b-/),
      strength: 'IMMUTABLE',
      subtitle: 'Passkey (github.com)',
    }));
  });

  it('downloads an attached encrypted file from local storage', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const click = vi.fn();
    const appendChild = vi.spyOn(document.body, 'appendChild');
    const removeChild = vi.spyOn(document.body, 'removeChild');
    vi.stubGlobal('URL', {
      createObjectURL: vi.fn(() => 'blob:attachment-url'),
      revokeObjectURL: vi.fn(),
    });
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = document.createElementNS('http://www.w3.org/1999/xhtml', tagName) as HTMLElement;
      if (tagName.toLowerCase() === 'a') {
        Object.defineProperty(element, 'click', { configurable: true, value: click });
      }
      return element;
    });

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'attachment-1',
          title: 'Attachment Entry',
          attachment: {
            id: 'file-1',
            name: 'recovery.txt',
            size: 1024,
            type: 'text/plain',
          },
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Download/i }));

    await waitFor(() => {
      expect(fileStoreMock.getEncryptedFile).toHaveBeenCalledWith('file-1');
    });
    expect(URL.createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    expect(appendChild).toHaveBeenCalled();
    expect(removeChild).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:attachment-url');
  });

  it('alerts when an attachment cannot be found during download', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    fileStoreMock.getEncryptedFile.mockResolvedValueOnce(null);
    vi.mocked(URL.createObjectURL).mockClear();

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'missing-attachment-1',
          title: 'Missing Attachment',
          attachment: {
            id: 'missing-file',
            name: 'missing.txt',
            size: 512,
            type: 'text/plain',
          },
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Download/i }));

    await waitFor(() => {
      expect(fileStoreMock.getEncryptedFile).toHaveBeenCalledWith('missing-file');
    });
    expect(alert).toHaveBeenCalledWith('Encrypted file was not found in the local database.');
    expect(URL.createObjectURL).not.toHaveBeenCalled();
  });
  it('uploads an attachment while editing and saves it with the entry', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    fileStoreMock.saveEncryptedFile.mockClear();

    const { container } = render(
      <DetailPanel
        entry={baseEntry({
          id: 'upload-attachment-1',
          title: 'Attachment Upload',
          type: 'login',
          username: 'ada',
          password: 'VeryStrongPassword123!',
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['attachment body'], 'contract.pdf', { type: 'application/pdf' }));

    await waitFor(() => {
      expect(fileStoreMock.saveEncryptedFile).toHaveBeenCalledWith(expect.stringMatching(/^file-/), expect.any(Blob));
    });
    await waitFor(() => {
      expect(screen.getByText('contract.pdf')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(onUpdate).toHaveBeenCalledWith(expect.objectContaining({
      id: 'upload-attachment-1',
      attachment: expect.objectContaining({
        id: expect.stringMatching(/^file-/),
        name: 'contract.pdf',
        type: 'application/pdf',
      }),
    }));
  });

  it('cancels editing and refuses to save an empty title', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onUpdate = vi.fn();

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'cancel-edit-1',
          title: 'Editable Login',
          type: 'login',
          username: 'ada',
          password: 'VeryStrongPassword123!',
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={onUpdate}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByDisplayValue('Editable Login')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const titleInput = screen.getByDisplayValue('Editable Login');
    await user.clear(titleInput);
    await user.click(screen.getByRole('button', { name: /Save Changes/i }));

    expect(onUpdate).not.toHaveBeenCalled();
    expect(screen.getByPlaceholderText('Enter a title')).toBeInTheDocument();
  });

  it('renders a read-only detail view without edit or favorite controls', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onDelete = vi.fn();
    const onClose = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'readonly-1',
          title: 'Read Only Login',
          username: 'viewer@example.com',
          password: 'ViewerPassword123!',
          url: '',
        })}
        onClose={onClose}
        onDelete={onDelete}
      />
    );

    expect(screen.getByRole('heading', { name: 'Read Only Login' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByTitle('Add to Favorites')).not.toBeInTheDocument();
    expect(screen.getByText('Process address not specified')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Move to Trash' }));

    expect(onDelete).toHaveBeenCalledWith('readonly-1');
    expect(onClose).toHaveBeenCalled();
  });

  it('reveals and copies a login password from the detail view', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue(undefined);

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'password-copy-1',
          title: 'Password Copy Login',
          username: 'copy@example.com',
          password: 'CopyPassword123!',
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    let passwordRow = screen.getByText('PASSWORD').parentElement as HTMLElement | null;
    while (passwordRow && within(passwordRow).queryAllByRole('button').length < 2) {
      passwordRow = passwordRow.parentElement;
    }

    const [toggleVisibility] = within(passwordRow!).getAllByRole('button');
    await user.click(toggleVisibility);
    expect(screen.getByText('CopyPassword123!')).toBeInTheDocument();

    passwordRow = screen.getByText('PASSWORD').parentElement?.parentElement as HTMLElement;
    const copyPassword = within(passwordRow).getAllByRole('button').at(-1)!;
    await user.click(copyPassword);
    expect(writeText).toHaveBeenCalledWith('CopyPassword123!');
  });

  it('alerts when an attached encrypted file cannot be decrypted', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    fileStoreMock.getEncryptedFile.mockRejectedValueOnce(new Error('decrypt failed'));

    render(
      <DetailPanel
        entry={baseEntry({
          id: 'decrypt-failure-1',
          title: 'Decrypt Failure',
          attachment: {
            id: 'broken-file',
            name: 'broken.txt',
            size: 512,
            type: 'text/plain',
          },
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: /Download/i }));

    await waitFor(() => {
      expect(fileStoreMock.getEncryptedFile).toHaveBeenCalledWith('broken-file');
    });
    expect(alert).toHaveBeenCalledWith('Decryption failed or the file could not be read.');
  });

  it('shows a save failure when an edited attachment cannot be stored', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    fileStoreMock.saveEncryptedFile.mockRejectedValueOnce(new Error('save failed'));

    const { container } = render(
      <DetailPanel
        entry={baseEntry({
          id: 'attachment-save-failure-1',
          title: 'Attachment Save Failure',
          type: 'login',
          username: 'ada',
          password: 'VeryStrongPassword123!',
        })}
        onClose={vi.fn()}
        onDelete={vi.fn()}
        onUpdate={vi.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Edit' }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['bad attachment'], 'broken.pdf', { type: 'application/pdf' }));

    await waitFor(() => {
      expect(screen.getByText('Error: File could not be saved to the library.')).toBeInTheDocument();
    });
    expect(screen.queryByText('broken.pdf')).not.toBeInTheDocument();
  });
});

describe('SecurityLogsModal', () => {
  it('renders logs newest first and clears the timeline', async () => {
    const user = userEvent.setup();
    const onClearLogs = vi.fn();

    render(
      <SecurityLogsModal
        isOpen
        onClose={vi.fn()}
        onClearLogs={onClearLogs}
        logs={[
          { id: '1', timestamp: '2026-05-23T08:00:00.000Z', action: 'Vault unlocked', severity: 'info' },
          { id: '2', timestamp: '2026-05-23T09:00:00.000Z', action: 'Air-gap changed', severity: 'warning' },
          { id: '3', timestamp: '2026-05-23T10:00:00.000Z', action: 'Wipe requested', severity: 'critical' },
        ]}
      />
    );

    expect(screen.getByRole('heading', { name: 'Yerel Güvenlik Günlüğü (Audit)' })).toBeInTheDocument();
    expect(screen.getByText('İşlem Kronolojisi (3)')).toBeInTheDocument();

    const actions = screen.getAllByText(/Vault unlocked|Air-gap changed|Wipe requested/).map(node => node.textContent);
    expect(actions).toEqual(['Wipe requested', 'Air-gap changed', 'Vault unlocked']);

    await user.click(screen.getByRole('button', { name: /Günlüğü Temizle/i }));
    expect(onClearLogs).toHaveBeenCalled();
  });

  it('shows an empty log state and closes from the footer action', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();

    render(<SecurityLogsModal isOpen onClose={onClose} logs={[]} onClearLogs={vi.fn()} />);

    expect(screen.getByText('Henüz kaydedilmiş güvenlik işlemi bulunmuyor.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Kapat' }).at(-1)!);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Sidebar', () => {
  it('navigates between major app areas and triggers add and lock actions', async () => {
    const user = userEvent.setup();
    const setActiveTab = vi.fn();
    const onAddNewEntry = vi.fn();
    const onLock = vi.fn();

    render(
      <Sidebar
        activeTab="vault"
        setActiveTab={setActiveTab}
        onAddNewEntry={onAddNewEntry}
        onLock={onLock}
      />
    );

    expect(screen.getByText('AegisVault')).toBeInTheDocument();
    expect(screen.getByText('Sadece Yerel Depolama')).toBeInTheDocument();

    await user.click(screen.getByText('Güvenlik Denetimi'));
    await user.click(screen.getByText('Parola Üretici'));
    await user.click(screen.getByText('Ayarlar'));
    await user.click(screen.getByText('Çöp Kutusu'));
    await user.click(screen.getByRole('button', { name: /Yeni Kayıt Ekle/i }));
    await user.click(screen.getByText('Kasayı Kilitle'));

    expect(setActiveTab).toHaveBeenNthCalledWith(1, 'audit');
    expect(setActiveTab).toHaveBeenNthCalledWith(2, 'generator');
    expect(setActiveTab).toHaveBeenNthCalledWith(3, 'settings');
    expect(setActiveTab).toHaveBeenNthCalledWith(4, 'trash');
    expect(onAddNewEntry).toHaveBeenCalled();
    expect(onLock).toHaveBeenCalled();
  });
});

describe('TrashBin', () => {
  it('filters deleted entries and calls restore and permanent delete actions', async () => {
    const user = userEvent.setup();
    const onRestore = vi.fn();
    const onPermanentDelete = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <TrashBin
        entries={[
          baseEntry({ id: 'trash-1', title: 'Deleted GitHub', subtitle: 'octo', isDeleted: true, deletedAt: '2026-05-20T00:00:00.000Z' }),
          baseEntry({ id: 'trash-2', title: 'Deleted Mail', subtitle: 'mail', isDeleted: true, deletedAt: '2026-05-15T00:00:00.000Z' }),
          baseEntry({ id: 'active-1', title: 'Active Bank', isDeleted: false }),
        ]}
        onRestore={onRestore}
        onPermanentDelete={onPermanentDelete}
        onClearTrash={vi.fn()}
      />
    );

    expect(screen.getByText('Deleted GitHub')).toBeInTheDocument();
    expect(screen.queryByText('Active Bank')).not.toBeInTheDocument();

    await user.type(screen.getByPlaceholderText('Silinen ögeler arasında arama yapın...'), 'mail');
    await waitFor(() => {
      expect(screen.queryByText('Deleted GitHub')).not.toBeInTheDocument();
    });
    expect(screen.getByText('Deleted Mail')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Geri Yükle/i }));
    expect(onRestore).toHaveBeenCalledWith('trash-2');

    await user.click(screen.getByRole('button', { name: /Kalıcı Sil/i }));
    expect(onPermanentDelete).toHaveBeenCalledWith('trash-2');
  });

  it('clears all trash entries after confirmation', async () => {
    const user = userEvent.setup();
    const onClearTrash = vi.fn();
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(
      <TrashBin
        entries={[baseEntry({ id: 'trash-1', title: 'Deleted GitHub', isDeleted: true })]}
        onRestore={vi.fn()}
        onPermanentDelete={vi.fn()}
        onClearTrash={onClearTrash}
      />
    );

    await user.click(screen.getByRole('button', { name: /Çöpü Tamamen Boşalt/i }));
    expect(onClearTrash).toHaveBeenCalled();
  });
});

describe('ProfileModal', () => {
  it('updates the visible session uptime every second', async () => {
    await i18n.changeLanguage('en');
    vi.useFakeTimers();

    render(
      <ProfileModal
        isOpen
        onClose={vi.fn()}
        userName="Aegis Owner"
        onUpdateUserName={vi.fn()}
        avatarUrl="https://example.com/avatar.jpg"
        onUpdateAvatarUrl={vi.fn()}
      />
    );

    expect(screen.getByText('00:00 min')).toBeInTheDocument();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(61000);
    });
    expect(screen.getByText('01:01 min')).toBeInTheDocument();

    vi.useRealTimers();
  });

  it('compresses an uploaded avatar image before saving it', async () => {
    await i18n.changeLanguage('en');
    const user = userEvent.setup();
    const onUpdateAvatarUrl = vi.fn();
    const originalImage = globalThis.Image;
    class MockImage {
      onload: (() => void) | null = null;
      width = 300;
      height = 200;

      set src(_value: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    }
    vi.stubGlobal('Image', MockImage);
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName.toLowerCase() === 'canvas') {
        Object.defineProperty(element, 'getContext', {
          configurable: true,
          value: vi.fn(() => ({ drawImage: vi.fn() })),
        });
        Object.defineProperty(element, 'toDataURL', {
          configurable: true,
          value: vi.fn(() => 'data:image/jpeg;base64,compressed-avatar'),
        });
      }
      return element;
    });

    const { container } = render(
      <ProfileModal
        isOpen
        onClose={vi.fn()}
        userName="Aegis Owner"
        onUpdateUserName={vi.fn()}
        avatarUrl="https://example.com/avatar.jpg"
        onUpdateAvatarUrl={onUpdateAvatarUrl}
      />
    );

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    await user.upload(input, new File(['avatar'], 'avatar.png', { type: 'image/png' }));

    await waitFor(() => {
      expect(onUpdateAvatarUrl).toHaveBeenCalledWith('data:image/jpeg;base64,compressed-avatar');
    });
    vi.stubGlobal('Image', originalImage);
  });

  it('updates the display name and accepts a custom avatar URL', async () => {
    const user = userEvent.setup();
    const onUpdateUserName = vi.fn();
    const onUpdateAvatarUrl = vi.fn();

    render(
      <ProfileModal
        isOpen
        onClose={vi.fn()}
        userName="Aegis Owner"
        onUpdateUserName={onUpdateUserName}
        avatarUrl="https://example.com/avatar.jpg"
        onUpdateAvatarUrl={onUpdateAvatarUrl}
      />
    );

    expect(screen.getByRole('heading', { name: 'Profil & Oturum Bilgileri' })).toBeInTheDocument();

    await user.click(screen.getByTitle('İsmini Düzenle'));
    const nameInput = screen.getByDisplayValue('Aegis Owner');
    await user.clear(nameInput);
    await user.type(nameInput, 'New Owner');
    await user.keyboard('{Enter}');
    expect(onUpdateUserName).toHaveBeenCalledWith('New Owner');

    await user.type(screen.getByPlaceholderText('https://gorsel-adresi.com/profil.jpg'), 'https://example.com/new-avatar.png');
    await user.click(screen.getByRole('button', { name: 'Ekle' }));
    expect(onUpdateAvatarUrl).toHaveBeenCalledWith('https://example.com/new-avatar.png');

    const presetButtons = screen.getAllByTitle(/Örnek Avatar/);
    await user.click(presetButtons[1]);
    expect(onUpdateAvatarUrl).toHaveBeenCalledWith(expect.stringContaining('data:image/svg+xml;utf8,'));

    expect(screen.getByText('Oturum Şifreleme')).toBeInTheDocument();
    expect(screen.getByText('AES-256-GCM')).toBeInTheDocument();
  });
});
