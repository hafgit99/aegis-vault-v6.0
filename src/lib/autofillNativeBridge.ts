import { NativeAutofillContext } from './autofillBridge';
import { VaultEntry } from '../types';

type TauriInvoke = <T = unknown>(command: string, args?: Record<string, unknown>) => Promise<T>;

interface TauriBridgeWindow extends Window {
  __TAURI_INTERNALS__?: { invoke?: TauriInvoke };
}

async function getNativeInvoke(): Promise<TauriInvoke | null> {
  const tauriWindow = window as TauriBridgeWindow;
  if (!tauriWindow.__TAURI_INTERNALS__) return null;
  const api = await import('@tauri-apps/api/core');
  return api.invoke as TauriInvoke;
}

function parsePendingAutofillRequest(value: string): NativeAutofillContext | null {
  try {
    const parsed = JSON.parse(value) as Partial<NativeAutofillContext>;
    if (parsed.platform !== 'android' && parsed.platform !== 'desktop') return null;

    const context: NativeAutofillContext = {
      platform: parsed.platform,
      webDomain: typeof parsed.webDomain === 'string' ? parsed.webDomain : null,
      packageName: typeof parsed.packageName === 'string' ? parsed.packageName : null,
      formHints: Array.isArray(parsed.formHints)
        ? parsed.formHints.filter((hint): hint is string => typeof hint === 'string')
        : [],
      hasUsernameField: parsed.hasUsernameField === true,
      hasPasswordField: parsed.hasPasswordField === true,
    };
    if (typeof parsed.origin === 'string') context.origin = parsed.origin;
    if (typeof parsed.url === 'string') context.url = parsed.url;
    if (!context.hasUsernameField && !context.hasPasswordField) return null;
    if (!context.webDomain?.trim() && !context.origin?.trim() && !context.packageName?.trim()) return null;
    return context;
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
  platform: 'android' | 'desktop';
  webDomain?: string | null;
  origin?: string | null;
  packageName?: string | null;
  title: string;
  username: string;
  password: string;
  expiresAt: number;
}

export interface PendingAndroidAutofillSaveRequest {
  platform: 'android' | 'desktop';
  webDomain: string | null;
  origin?: string | null;
  url?: string | null;
  packageName: string | null;
  username: string;
  password: string;
  formHints: string[];
  expiresAt: number;
}

interface CanceledAndroidAutofillPayload {
  platform: 'android' | 'desktop';
  status: 'canceled';
  webDomain?: string | null;
  origin?: string | null;
  packageName?: string | null;
  expiresAt: number;
}

function parsePendingAutofillSaveRequest(
  value: string,
  now = Date.now(),
): PendingAndroidAutofillSaveRequest | null {
  try {
    const parsed = JSON.parse(value) as Partial<PendingAndroidAutofillSaveRequest>;
    if (parsed.platform !== 'android' && parsed.platform !== 'desktop') return null;
    if (typeof parsed.password !== 'string' || parsed.password.trim().length === 0) return null;
    if (typeof parsed.expiresAt !== 'number' || parsed.expiresAt <= now) return null;

    const webDomain = typeof parsed.webDomain === 'string' ? parsed.webDomain.trim() : '';
    const origin = typeof parsed.origin === 'string' ? parsed.origin.trim() : '';
    const packageName = typeof parsed.packageName === 'string' ? parsed.packageName.trim() : '';
    if (!webDomain && !origin && !packageName) return null;

    const request: PendingAndroidAutofillSaveRequest = {
      platform: parsed.platform,
      webDomain: webDomain || null,
      packageName: packageName || null,
      username: typeof parsed.username === 'string' ? parsed.username : '',
      password: parsed.password,
      formHints: Array.isArray(parsed.formHints)
        ? parsed.formHints.filter((hint): hint is string => typeof hint === 'string')
        : [],
      expiresAt: parsed.expiresAt,
    };
    if (origin) request.origin = origin;
    if (typeof parsed.url === 'string') request.url = parsed.url;
    return request;
  } catch {
    return null;
  }
}

export function createApprovedAndroidAutofillPayload(
  context: NativeAutofillContext,
  entry: VaultEntry,
  now = Date.now(),
): ApprovedAndroidAutofillPayload | null {
  if (!entry.password || entry.isDeleted || entry.deletedAt) return null;
  const webDomain = context.webDomain?.trim() || null;
  const origin = context.origin?.trim() || null;
  const packageName = context.packageName?.trim() || null;
  if (!webDomain && !origin && !packageName) return null;

  const payload: ApprovedAndroidAutofillPayload = {
    platform: context.platform,
    webDomain,
    packageName,
    title: entry.title,
    username: entry.username || entry.subtitle || '',
    password: entry.password,
    expiresAt: now + 15_000,
  };
  if (origin) payload.origin = origin;
  return payload;
}

export async function writeApprovedAndroidAutofillPayload(
  payload: ApprovedAndroidAutofillPayload,
): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;

  await invoke('write_approved_autofill_payload', { payload: JSON.stringify(payload) });
  return true;
}

export async function writeCanceledAndroidAutofillPayload(
  context: NativeAutofillContext,
  now = Date.now(),
): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;

  const payload: CanceledAndroidAutofillPayload = {
    platform: context.platform,
    status: 'canceled',
    webDomain: context.webDomain?.trim() || null,
    packageName: context.packageName?.trim() || null,
    expiresAt: now + 15_000,
  };
  const origin = context.origin?.trim();
  if (origin) payload.origin = origin;

  await invoke('write_approved_autofill_payload', { payload: JSON.stringify(payload) });
  return true;
}

export async function clearApprovedAndroidAutofillPayload(): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;

  await invoke('clear_approved_autofill_payload');
  return true;
}

export async function readPendingAndroidAutofillSaveRequest(): Promise<PendingAndroidAutofillSaveRequest | null> {
  const invoke = await getNativeInvoke();
  if (!invoke) return null;

  const payload = await invoke<string | null>('read_pending_autofill_save_request');
  if (!payload) return null;
  return parsePendingAutofillSaveRequest(payload);
}

export async function clearPendingAndroidAutofillSaveRequest(): Promise<boolean> {
  const invoke = await getNativeInvoke();
  if (!invoke) return false;

  await invoke('clear_pending_autofill_save_request');
  return true;
}

export const autofillNativeBridgeInternals = {
  parsePendingAutofillRequest,
  parsePendingAutofillSaveRequest,
};
