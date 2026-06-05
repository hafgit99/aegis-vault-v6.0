import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encryptData } from '../../src/lib/backupCrypto';
import { parseVaultImportFile } from '../../src/lib/importWorkflow';
import { createSecureShareBundle } from '../../src/lib/secureShareBundle';
import { persistMasterPasswordAudit } from '../../src/lib/passwordStrength';
import { recordPlaintextExportAudit } from '../../src/lib/vaultHealth';
import { vaultService } from '../../src/lib/vaultService';
import { useMasterPasswordChange } from '../../src/hooks/useMasterPasswordChange';
import { useSettingsBackup } from '../../src/hooks/useSettingsBackup';
import { useSettingsImport } from '../../src/hooks/useSettingsImport';
import { useWipeReset } from '../../src/hooks/useWipeReset';
import type { ImporterLabels } from '../../src/lib/importer';
import type { VaultEntry } from '../../src/types';

vi.mock('../../src/lib/importWorkflow', () => ({
  parseVaultImportFile: vi.fn(),
}));

vi.mock('../../src/lib/backupCrypto', () => ({
  encryptData: vi.fn(),
}));

vi.mock('../../src/lib/secureShareBundle', () => ({
  createSecureShareBundle: vi.fn(),
}));

vi.mock('../../src/lib/passwordStrength', () => ({
  persistMasterPasswordAudit: vi.fn(),
}));

vi.mock('../../src/lib/vaultHealth', () => ({
  recordPlaintextExportAudit: vi.fn(),
}));

vi.mock('../../src/lib/vaultService', () => ({
  vaultService: {
    changeMasterPassword: vi.fn(),
  },
}));

const importerLabels: ImporterLabels = {
  accessLogin: 'Access Login',
  login: 'Login',
  creditCard: 'Credit Card',
  secureNote: 'Secure Note',
  cryptoWalletKey: 'Crypto Wallet Key',
  passkey: 'Passkey',
  identity: 'Identity',
  idCard: 'ID Card',
  untitledImport: 'Untitled Import',
  loginTitle: 'Login',
  recordTitle: 'Record',
  international: 'International',
  notSpecified: 'Not specified',
  onePasswordRecord: '1Password Record',
};

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: 'entry-1',
  title: 'GitHub',
  subtitle: 'octo',
  username: 'octo',
  password: 'correct horse battery staple',
  url: 'https://github.com',
  notes: '',
  strength: 'EXCELLENT',
  themeColor: 'primary',
  type: 'login',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

const makeFile = (name = 'backup.json') => new File(['{}'], name, { type: 'application/json' });

describe('settings hooks', () => {
  beforeEach(() => {
    vi.mocked(parseVaultImportFile).mockReset();
    vi.mocked(encryptData).mockReset();
    vi.mocked(createSecureShareBundle).mockReset();
    vi.mocked(persistMasterPasswordAudit).mockReset();
    vi.mocked(recordPlaintextExportAudit).mockReset();
    vi.mocked(vaultService.changeMasterPassword).mockReset();
    vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn(() => 'blob:backup'),
    });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  });

  describe('useSettingsImport', () => {
    it('resets the import workspace from file picker, drag and clear actions', async () => {
      const onImport = vi.fn();
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useSettingsImport({ importerLabels, onImport, onAddLog }));
      const firstFile = makeFile('first.json');
      const droppedFile = makeFile('dropped.csv');
      const preventDefault = vi.fn();

      await act(async () => {
        await result.current.handleFileChange({ target: { files: [firstFile] } } as any);
      });

      expect(result.current.importFile).toBe(firstFile);

      act(() => {
        result.current.setParsedEntries([entry()]);
        result.current.setImportPassword('secret');
        result.current.handleDragOver({ preventDefault } as any);
        result.current.handleDrop({
          preventDefault,
          dataTransfer: { files: [droppedFile] },
        } as any);
      });

      expect(preventDefault).toHaveBeenCalled();
      expect(result.current.importFile).toBe(droppedFile);
      expect(result.current.parsedEntries).toEqual([]);

      act(() => {
        result.current.clearImportWorkspace();
      });

      expect(result.current.importFile).toBeNull();
      expect(result.current.importPassword).toBe('');
      expect(result.current.importReview).toBeNull();
    });

    it('parses selected files, selects all parsed records, and logs the parse result', async () => {
      const parsed = [entry({ id: 'parsed-1' }), entry({ id: 'parsed-2', title: 'Mail' })];
      vi.mocked(parseVaultImportFile).mockImplementation(async ({ onReport }: any) => {
        onReport({
          source: 'aegis_encrypted',
          fileName: 'backup.json',
          fileSizeKb: '1.4',
          encrypted: true,
          kdfAlgorithm: 'argon2id',
          legacyKdf: false,
          secureShare: false,
        });
        return parsed;
      });
      const onImport = vi.fn();
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useSettingsImport({ importerLabels, onImport, onAddLog }));

      act(() => {
        result.current.setImportFile(makeFile());
        result.current.setImportPassword('transfer-password');
      });

      await act(async () => {
        await result.current.handleParseFile();
      });

      expect(parseVaultImportFile).toHaveBeenCalledWith(expect.objectContaining({
        source: 'aegis_encrypted',
        password: 'transfer-password',
        importerLabels,
      }));
      expect(result.current.parsedEntries).toHaveLength(2);
      expect(result.current.selectedIndices).toEqual(new Set([0, 1]));
      expect(result.current.importReview).toMatchObject({
        fileName: 'backup.json',
        totalRecords: 2,
        selectedRecords: 2,
        loginCount: 2,
        encrypted: true,
        legacyKdf: false,
      });
      expect(onAddLog).toHaveBeenCalledWith(expect.stringContaining('AEGIS_ENCRYPTED'), 'info');
    });

    it('executes replace imports, clears transient state, and reports success', async () => {
      vi.mocked(parseVaultImportFile).mockResolvedValue([entry({ id: 'partial-1' })]);
      const onImport = vi.fn();
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useSettingsImport({ importerLabels, onImport, onAddLog }));

      act(() => {
        result.current.setImportFile(makeFile());
        result.current.setImportPassword('transfer-password');
        result.current.setImportConflictMode('replace');
      });

      await act(async () => {
        await result.current.handleParseFile();
      });

      await waitFor(() => expect(result.current.selectedIndices).toEqual(new Set([0])));

      act(() => {
        result.current.handleExecuteImport();
      });

      expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ title: 'GitHub' })], true);
      expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'warning');
      expect(result.current.importFile).toBeNull();
      expect(result.current.importPassword).toBe('');
      expect(result.current.importFeedback).toMatchObject({ success: true });
      expect(result.current.importReview).toMatchObject({ selectedRecords: 1 });
      expect(result.current.importResult).toMatchObject({
        importedRecords: 1,
        conflictMode: 'replace',
        fileName: expect.any(String),
      });
    });

    it('toggles individual and bulk import selection before merge execution', async () => {
      vi.mocked(parseVaultImportFile).mockResolvedValue([
        entry({ id: 'selected-1', title: 'Selected' }),
        entry({ id: 'skipped-1', title: 'Skipped' }),
      ]);
      const onImport = vi.fn();
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useSettingsImport({ importerLabels, onImport, onAddLog }));

      act(() => {
        result.current.setImportFile(makeFile());
      });

      await act(async () => {
        await result.current.handleParseFile();
      });

      act(() => {
        result.current.toggleSelectIndex(1);
      });

      expect(result.current.selectedIndices).toEqual(new Set([0]));
      expect(result.current.importReview).toMatchObject({ selectedRecords: 1 });

      act(() => {
        result.current.handleExecuteImport();
      });

      expect(onImport).toHaveBeenCalledWith([expect.objectContaining({ title: 'Selected' })], false);
      expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'info');
      expect(result.current.importResult).toMatchObject({
        importedRecords: 1,
        skippedRecords: 1,
        conflictMode: 'merge',
      });
    });

    it('guards import execution when no parsed records are selected', async () => {
      vi.mocked(parseVaultImportFile).mockResolvedValue([entry()]);
      const onImport = vi.fn();
      const { result } = renderHook(() => useSettingsImport({
        importerLabels,
        onImport,
        onAddLog: vi.fn(),
      }));

      act(() => {
        result.current.setImportFile(makeFile());
      });

      await act(async () => {
        await result.current.handleParseFile();
      });

      act(() => {
        result.current.toggleSelectAll();
      });

      await waitFor(() => expect(result.current.selectedIndices).toEqual(new Set()));

      act(() => {
        result.current.handleExecuteImport();
      });

      expect(window.alert).toHaveBeenCalledWith(expect.any(String));
      expect(onImport).not.toHaveBeenCalled();
      expect(result.current.importReview).toMatchObject({ selectedRecords: 0 });
    });

    it('surfaces parse errors without importing unsafe records', async () => {
      vi.mocked(parseVaultImportFile).mockRejectedValue(new Error('bad password'));
      const onImport = vi.fn();
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useSettingsImport({ importerLabels, onImport, onAddLog }));

      act(() => {
        result.current.setImportFile(makeFile());
      });

      await act(async () => {
        await result.current.handleParseFile();
      });

      expect(onImport).not.toHaveBeenCalled();
      expect(result.current.importFeedback).toMatchObject({ success: false });
      expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'warning');
    });
  });

  describe('useSettingsBackup', () => {
    it('exports encrypted backups with sealed preview evidence', async () => {
      vi.mocked(encryptData).mockResolvedValue({
        kdf: { algorithm: 'argon2id' },
        salt: 'salt-value-123456',
        iv: 'iv-value',
        data: 'encrypted-payload-that-is-long-enough-for-preview',
      } as any);
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useSettingsBackup({ entries: [entry()], onAddLog }));

      act(() => {
        result.current.setExportPassword('backup-password');
        result.current.setExportConfirmPassword('backup-password');
      });

      await act(async () => {
        await result.current.handleExportActualBackup();
      });

      expect(encryptData).toHaveBeenCalledWith(expect.stringContaining('GitHub'), 'backup-password');
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      expect(result.current.exportSuccessPreview?.sampleData).toContain('"encrypted": true');
      expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'info');
    });

    it('exports secure share bundles with expiry metadata in the preview', async () => {
      vi.mocked(createSecureShareBundle).mockResolvedValue({
        app: 'AegisVault',
        kind: 'secure-share-bundle',
        encrypted: true,
        itemCount: 1,
        expiresAt: '2026-06-05T00:00:00.000Z',
        kdf: { algorithm: 'argon2id' },
        data: 'secure-share-payload-that-is-long-enough-for-preview',
      } as any);
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useSettingsBackup({ entries: [entry()], onAddLog }));

      act(() => {
        result.current.setExportMethod('share');
        result.current.setSecureShareExpiryDays('7');
        result.current.setExportPassword('share-password');
        result.current.setExportConfirmPassword('share-password');
      });

      await act(async () => {
        await result.current.handleExportActualBackup();
      });

      expect(createSecureShareBundle).toHaveBeenCalledWith([expect.objectContaining({ title: 'GitHub' })], 'share-password', expect.any(String));
      expect(result.current.exportSuccessPreview?.fileName).toContain('AegisVault_Secure_Share');
      expect(result.current.exportSuccessPreview?.sampleData).toContain('secure-share-bundle');
    });

    it('exports plaintext backups only after explicit acknowledgement and skips deleted entries', async () => {
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useSettingsBackup({
        entries: [entry(), entry({ id: 'deleted', title: 'Deleted', isDeleted: true })],
        onAddLog,
      }));

      act(() => {
        result.current.setExportMethod('plain');
      });

      await act(async () => {
        await result.current.handleExportActualBackup();
      });

      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Hata'));
      expect(recordPlaintextExportAudit).not.toHaveBeenCalled();

      act(() => {
        result.current.setPlainWarningAccepted(true);
      });

      await act(async () => {
        await result.current.handleExportActualBackup();
      });

      expect(recordPlaintextExportAudit).toHaveBeenCalledTimes(1);
      expect(HTMLAnchorElement.prototype.click).toHaveBeenCalled();
      expect(result.current.exportSuccessPreview?.sampleData).toContain('vault');
      expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'info');
    });

    it('opens the export modal with cleared confirmation and preview state', () => {
      const { result } = renderHook(() => useSettingsBackup({ entries: [entry()], onAddLog: vi.fn() }));

      act(() => {
        result.current.setExportConfirmPassword('old-confirmation');
        result.current.setPlainWarningAccepted(true);
        result.current.handleExportBackup();
      });

      expect(result.current.showExportModal).toBe(true);
      expect(result.current.exportConfirmPassword).toBe('');
      expect(result.current.plainWarningAccepted).toBe(false);
      expect(result.current.exportSuccessPreview).toBeNull();
    });

    it('passes no expiry for never-expiring secure share bundles', async () => {
      vi.mocked(createSecureShareBundle).mockResolvedValue({
        app: 'AegisVault',
        kind: 'secure-share-bundle',
        encrypted: true,
        itemCount: 1,
        kdf: { algorithm: 'argon2id' },
        data: 'secure-share-payload-that-is-long-enough-for-preview',
      } as any);
      const { result } = renderHook(() => useSettingsBackup({ entries: [entry()], onAddLog: vi.fn() }));

      act(() => {
        result.current.setExportMethod('share');
        result.current.setSecureShareExpiryDays('never');
        result.current.setExportPassword('share-password');
        result.current.setExportConfirmPassword('share-password');
      });

      await act(async () => {
        await result.current.handleExportActualBackup();
      });

      expect(createSecureShareBundle).toHaveBeenCalledWith(expect.any(Array), 'share-password', undefined);
      expect(result.current.exportSuccessPreview?.sampleData).toContain('"expiresAt": null');
    });

    it('guards export when passwords are invalid', async () => {
      const { result } = renderHook(() => useSettingsBackup({ entries: [entry()], onAddLog: vi.fn() }));

      await act(async () => {
        await result.current.handleExportActualBackup();
      });

      expect(encryptData).not.toHaveBeenCalled();
      expect(window.alert).toHaveBeenCalledWith(expect.stringContaining('Hata'));
    });
  });

  describe('useMasterPasswordChange', () => {
    it('changes master password, audits it, clears fields, and writes a warning log', async () => {
      vi.mocked(vaultService.changeMasterPassword).mockResolvedValue(undefined);
      vi.mocked(persistMasterPasswordAudit).mockResolvedValue(undefined);
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useMasterPasswordChange({ onAddLog }));

      act(() => {
        result.current.setOldPassword('old-password');
        result.current.setNewPassword('VeryStrongPassword123!');
        result.current.setConfirmNewPassword('VeryStrongPassword123!');
      });

      await act(async () => {
        await result.current.handleChangePassword({ preventDefault: vi.fn() } as any);
      });

      expect(vaultService.changeMasterPassword).toHaveBeenCalledWith('old-password', 'VeryStrongPassword123!');
      expect(persistMasterPasswordAudit).toHaveBeenCalledWith('VeryStrongPassword123!');
      expect(onAddLog).toHaveBeenCalledWith(expect.any(String), 'warning');
      expect(result.current.oldPassword).toBe('');
      expect(result.current.passwordChangeFeedback).toMatchObject({ success: true });
    });

    it('rejects weak or mismatched master password changes before touching the service', async () => {
      const { result } = renderHook(() => useMasterPasswordChange({ onAddLog: vi.fn() }));

      act(() => {
        result.current.setOldPassword('old-password');
        result.current.setNewPassword('short');
        result.current.setConfirmNewPassword('different');
      });

      await act(async () => {
        await result.current.handleChangePassword({ preventDefault: vi.fn() } as any);
      });

      expect(vaultService.changeMasterPassword).not.toHaveBeenCalled();
      expect(result.current.passwordChangeFeedback).toMatchObject({ success: false });
    });

    it('does nothing when password change fields are incomplete and surfaces service failures', async () => {
      const onAddLog = vi.fn();
      const { result } = renderHook(() => useMasterPasswordChange({ onAddLog }));

      await act(async () => {
        await result.current.handleChangePassword({ preventDefault: vi.fn() } as any);
      });

      expect(vaultService.changeMasterPassword).not.toHaveBeenCalled();
      expect(result.current.passwordChangeFeedback).toBeNull();

      vi.mocked(vaultService.changeMasterPassword).mockRejectedValue(new Error('Current password is invalid'));
      act(() => {
        result.current.setOldPassword('wrong-password');
        result.current.setNewPassword('VeryStrongPassword123!');
        result.current.setConfirmNewPassword('VeryStrongPassword123!');
      });

      await act(async () => {
        await result.current.handleChangePassword({ preventDefault: vi.fn() } as any);
      });

      expect(result.current.passwordChangeFeedback).toMatchObject({
        success: false,
        msg: 'Current password is invalid',
      });
      expect(onAddLog).not.toHaveBeenCalled();
    });
  });

  describe('useWipeReset', () => {
    it('manages wipe confirmation, execution, cancellation, and acknowledgement state', () => {
      const onReset = vi.fn();
      const { result } = renderHook(() => useWipeReset({ onReset }));

      act(() => {
        result.current.startWipeConfirmation();
        result.current.setWipeConfirmText('SIFIRLA');
      });

      expect(result.current.showWipeConfirm).toBe(true);
      expect(result.current.wipeConfirmText).toBe('SIFIRLA');

      act(() => {
        result.current.executeWipe();
      });

      expect(onReset).toHaveBeenCalled();
      expect(result.current.showWipeConfirm).toBe(false);
      expect(result.current.wipeConfirmText).toBe('');
      expect(result.current.wipeSuccessMsg).toBe(true);

      act(() => {
        result.current.acknowledgeWipeSuccess();
        result.current.startWipeConfirmation();
        result.current.cancelWipeConfirmation();
      });

      expect(result.current.wipeSuccessMsg).toBe(false);
      expect(result.current.showWipeConfirm).toBe(false);
    });
  });
});
