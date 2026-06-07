type TauriInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;

type TauriBridgeWindow = Window & {
  __TAURI_INTERNALS__?: {
    invoke?: TauriInvoke;
  };
};

export type VaultStorageBackend = 'android-app-private' | 'opfs';

function isAndroidRuntime(): boolean {
  return typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
}

async function getTauriInvoke(): Promise<TauriInvoke | null> {
  try {
    if (typeof window === 'undefined') return null;
    const tauriWindow = window as TauriBridgeWindow;
    if (!tauriWindow.__TAURI_INTERNALS__) return null;
    const api = await import('@tauri-apps/api/core');
    return api.invoke as TauriInvoke;
  } catch {
    return null;
  }
}

async function getNativeInvoke(): Promise<TauriInvoke | null> {
  if (!isAndroidRuntime()) return null;
  return getTauriInvoke();
}

export async function getVaultStorageBackend(): Promise<VaultStorageBackend> {
  return (await getNativeInvoke()) ? 'android-app-private' : 'opfs';
}

export async function readNativeVaultFile(filename: string): Promise<Uint8Array | null> {
  const invoke = await getNativeInvoke();
  if (!invoke) return null;
  const bytes = await invoke<number[] | null>('read_app_private_file', { filename });
  return bytes ? new Uint8Array(bytes) : null;
}

export async function writeNativeVaultFile(filename: string, data: Uint8Array): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;
  await invoke('write_app_private_file', { filename, bytes: Array.from(data) });
  return true;
}

export async function deleteNativeVaultFile(filename: string): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;
  await invoke('delete_app_private_file', { filename });
  return true;
}

export async function clearNativeVaultSqliteFiles(): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;
  await invoke('clear_app_private_sqlite_files');
  return true;
}
