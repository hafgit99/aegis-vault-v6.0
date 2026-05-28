const CLIPBOARD_CLEAR_DELAY_MS = 30_000;

export async function writeClipboardSecret(value: string): Promise<void> {
  await navigator.clipboard.writeText(value);

  window.setTimeout(() => {
    navigator.clipboard.writeText('').catch(() => {});
  }, CLIPBOARD_CLEAR_DELAY_MS);
}
