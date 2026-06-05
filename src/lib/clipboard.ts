const CLIPBOARD_CLEAR_DELAY_MS = 30_000;
export const CLIPBOARD_CLEAR_FAILED_EVENT = 'aegis:clipboard-clear-failed';
export const CLIPBOARD_SENSITIVE_FLAG_FAILED_EVENT = 'aegis:clipboard-sensitive-flag-failed';

type TauriInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;

async function getTauriInvoke(): Promise<TauriInvoke | null> {
  try {
    if (!('__TAURI_INTERNALS__' in window)) return null;
    const api = await import('@tauri-apps/api/core');
    return api.invoke as TauriInvoke;
  } catch {
    return null;
  }
}

async function writeClipboardSecretValue(value: string): Promise<boolean> {
  const invoke = await getTauriInvoke();
  if (invoke) {
    try {
      await invoke('write_sensitive_clipboard', { value });
      return true;
    } catch (error) {
      window.dispatchEvent(new CustomEvent(CLIPBOARD_SENSITIVE_FLAG_FAILED_EVENT, {
        detail: { error },
      }));
    }
  }

  await navigator.clipboard.writeText(value);
  return false;
}

export async function writeClipboardSecret(value: string): Promise<void> {
  await writeClipboardSecretValue(value);

  window.setTimeout(() => {
    writeClipboardSecretValue('').catch((error) => {
      window.dispatchEvent(new CustomEvent(CLIPBOARD_CLEAR_FAILED_EVENT, {
        detail: { error },
      }));
    });
  }, CLIPBOARD_CLEAR_DELAY_MS);
}
