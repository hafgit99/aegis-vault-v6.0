type TauriInvoke = (command: string, args?: Record<string, unknown>) => Promise<unknown>;

type TauriBridgeWindow = Window & {
  __TAURI__?: {
    core?: {
      invoke?: TauriInvoke;
    };
    invoke?: TauriInvoke;
  };
  __TAURI_INTERNALS__?: {
    invoke?: TauriInvoke;
  };
};

const SESSION_SECRET_KEY = 'aegis_session_secret_key';
const REMEMBERED_SECRET_KEY = 'aegis_remembered_secret_key';
const LEGACY_SECRET_KEY = 'aegis_secret_key';

function getTauriInvoke(): TauriInvoke | null {
  if (typeof window === 'undefined') return null;
  const tauriWindow = window as TauriBridgeWindow;
  return tauriWindow.__TAURI__?.core?.invoke
    || tauriWindow.__TAURI__?.invoke
    || tauriWindow.__TAURI_INTERNALS__?.invoke
    || null;
}

async function invokeKeychain<T>(command: string, args?: Record<string, unknown>): Promise<T | null> {
  const invoke = getTauriInvoke();
  if (!invoke) return null;
  return await invoke(command, args) as T;
}

export function hasLocalSecretConfiguration(): boolean {
  return !!localStorage.getItem(REMEMBERED_SECRET_KEY) || !!localStorage.getItem(LEGACY_SECRET_KEY);
}

export async function getStoredSecretKey(): Promise<string | null> {
  const keychainSecret = await invokeKeychain<string | null>('get_secret_key');
  if (keychainSecret) return keychainSecret;

  return sessionStorage.getItem(SESSION_SECRET_KEY)
    || localStorage.getItem(REMEMBERED_SECRET_KEY)
    || localStorage.getItem(LEGACY_SECRET_KEY);
}

export async function persistSecretKey(secretKey: string, rememberDevice: boolean): Promise<void> {
  sessionStorage.setItem(SESSION_SECRET_KEY, secretKey);
  localStorage.removeItem(LEGACY_SECRET_KEY);

  if (!rememberDevice) {
    localStorage.removeItem(REMEMBERED_SECRET_KEY);
    await invokeKeychain<void>('delete_secret_key');
    return;
  }

  const storedInKeychain = await invokeKeychain<void>('store_secret_key', { secretKey })
    .then(() => getTauriInvoke() !== null)
    .catch(() => false);

  if (storedInKeychain) {
    localStorage.removeItem(REMEMBERED_SECRET_KEY);
  } else {
    localStorage.setItem(REMEMBERED_SECRET_KEY, secretKey);
  }
}

export async function clearStoredSecretKey(): Promise<void> {
  sessionStorage.removeItem(SESSION_SECRET_KEY);
  localStorage.removeItem(REMEMBERED_SECRET_KEY);
  localStorage.removeItem(LEGACY_SECRET_KEY);
  await invokeKeychain<void>('delete_secret_key').catch(() => null);
}
