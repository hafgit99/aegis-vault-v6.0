import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  clearNativeVaultSqliteFiles,
  deleteNativeVaultFile,
  getVaultStorageBackend,
  readNativeVaultFile,
  writeNativeVaultFile,
} from '../../src/lib/vaultStorageAdapter';

const invokeMock = vi.hoisted(() => vi.fn());

vi.mock('@tauri-apps/api/core', () => ({
  invoke: invokeMock,
}));

function setUserAgent(value: string) {
  Object.defineProperty(navigator, 'userAgent', {
    configurable: true,
    value,
  });
}

function setTauriRuntime(enabled: boolean) {
  Object.defineProperty(window, '__TAURI_INTERNALS__', {
    configurable: true,
    value: enabled ? { invoke: invokeMock } : undefined,
  });
}

describe('vaultStorageAdapter', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUserAgent('Mozilla/5.0');
    setTauriRuntime(false);
  });

  it('uses OPFS fallback outside Android Tauri runtime', async () => {
    await expect(getVaultStorageBackend()).resolves.toBe('opfs');
    await expect(readNativeVaultFile('aegis_vault.sqlite')).resolves.toBeNull();
    await expect(writeNativeVaultFile('aegis_vault.sqlite', new Uint8Array([1]))).resolves.toBe(false);
    expect(invokeMock).not.toHaveBeenCalled();
  });

  it('uses Android app-private storage when Android Tauri runtime is present', async () => {
    setUserAgent('Mozilla/5.0 (Linux; Android 15)');
    setTauriRuntime(true);
    invokeMock.mockResolvedValueOnce([1, 2, 3]);

    await expect(getVaultStorageBackend()).resolves.toBe('android-app-private');
    await expect(readNativeVaultFile('aegis_vault.sqlite')).resolves.toEqual(new Uint8Array([1, 2, 3]));

    await expect(writeNativeVaultFile('aegis_vault.sqlite', new Uint8Array([4, 5]))).resolves.toBe(true);
    await expect(deleteNativeVaultFile('aegis_vault.sqlite')).resolves.toBe(true);
    await expect(clearNativeVaultSqliteFiles()).resolves.toBe(true);

    expect(invokeMock).toHaveBeenCalledWith('read_app_private_file', { filename: 'aegis_vault.sqlite' });
    expect(invokeMock).toHaveBeenCalledWith('write_app_private_file', {
      filename: 'aegis_vault.sqlite',
      bytes: [4, 5],
    });
    expect(invokeMock).toHaveBeenCalledWith('delete_app_private_file', { filename: 'aegis_vault.sqlite' });
    expect(invokeMock).toHaveBeenCalledWith('clear_app_private_sqlite_files');
  });
});
