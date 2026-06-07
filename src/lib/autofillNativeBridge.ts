import { NativeAutofillContext } from './autofillBridge';
import { VaultEntry } from '../types';

type TauriInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;

interface TauriBridgeWindow extends Window {
  __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
}

function isAndroidRuntime(): boolean {
  return /Android/i.test(navigator.userAgent);
}

async function getNativeInvoke(): Promise<TauriInvoke | null> {
  if (!isAndroidRuntime()) return null;
  const tauriWindow = window as TauriBridgeWindow;
  if (!tauriWindow.__TAURI_INTERNALS__) return null;
  const api = await import('@tauri-apps/api/core');
  return api.invoke as TauriInvoke;
}

function parsePendingAutofillRequest(value: string): NativeAutofillContext | null {
  try {
    const parsed = JSON.parse(value) as Partial<NativeAutofillContext>;
    if (parsed.platform !== 'android') return null;

    return {
      platform: 'android',
      webDomain: typeof parsed.webDomain === 'string' ? parsed.webDomain : null,
      packageName: typeof parsed.packageName === 'string' ? parsed.packageName : null,
      formHints: Array.isArray(parsed.formHints)
        ? parsed.formHints.filter((hint): hint is string => typeof hint === 'string')
        : [],
      hasUsernameField: parsed.hasUsernameField === true,
      hasPasswordField: parsed.hasPasswordField === true,
    };
  } catch {
    return null;
  }
}

export async function readPendingAndroidAutofillContext(): Promise<NativeAutofillContext | null> {
  const invoke = await getNativeInvoke();
  if (!invoke) return null;

  const payload = await invoke<string | null>('read_pending_autofill_request');
  if (!payload) return null;
  return parsePendingAutofillRequest(payload);
}

export async function clearPendingAndroidAutofillContext(): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;

  await invoke('clear_pending_autofill_request');
  return true;
}

export interface ApprovedAndroidAutofillPayload {
  platform: 'android';
  webDomain?: string | null;
  packageName?: string | null;
  title: string;
  username: string;
  password: string;
  expiresAt: number;
}

export function createApprovedAndroidAutofillPayload(
  context: NativeAutofillContext,
  entry: VaultEntry,
  now = Date.now(),
): ApprovedAndroidAutofillPayload | null {
  if (!entry.password || entry.isDeleted || entry.deletedAt) return null;
  const webDomain = context.webDomain?.trim() || null;
  const packageName = context.packageName?.trim() || null;
  if (!webDomain && !packageName) return null;

  return {
    platform: 'android',
    webDomain,
    packageName,
    title: entry.title,
    username: entry.username || entry.subtitle || '',
    password: entry.password,
    expiresAt: now + 60_000,
  };
}

export async function writeApprovedAndroidAutofillPayload(
  payload: ApprovedAndroidAutofillPayload,
): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;

  await invoke('write_approved_autofill_payload', { payload: JSON.stringify(payload) });
  return true;
}

export async function clearApprovedAndroidAutofillPayload(): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;

  await invoke('clear_approved_autofill_payload');
  return true;
}

export const autofillNativeBridgeInternals = {
  parsePendingAutofillRequest,
};
