import { VaultEntry } from '../types';
import { analyzePasswordStrength, readMasterPasswordAudit } from './passwordStrength';

export interface VaultHealthSnapshot {
  activeEntries: VaultEntry[];
  totalCount: number;
  loginCount: number;
  cardCount: number;
  identityCount: number;
  noteCount: number;
  cryptoCount: number;
  passkeyCount: number;
  sensitiveCategoryCount: number;
  weakEntries: VaultEntry[];
  weakCount: number;
  duplicateGroups: VaultEntry[][];
  duplicateEntryCount: number;
  staleEntries: VaultEntry[];
  totpMissingCount: number;
  passkeyUpgradeCount: number;
  incompletePasskeyCount: number;
  masterPasswordStrong: boolean;
  masterPasswordLength: number;
  plaintextExportLastAt: string | null;
  plaintextExportRisk: boolean;
  pwnedEntryCount: number;
  overallScore: number;
}

export const PLAINTEXT_EXPORT_AUDIT_KEY = 'aegis_plaintext_export_last_at';
const LEGACY_PLAINTEXT_EXPORT_AUDIT_KEY = PLAINTEXT_EXPORT_AUDIT_KEY;

const isWeakLoginEntry = (entry: VaultEntry): boolean => (
  entry.type === 'login'
  && !!entry.password
  && entry.password.trim().length > 0
  && (entry.password.length < 12 || analyzePasswordStrength(entry.password).score < 75)
);

export function getActiveVaultEntries(entries: VaultEntry[]): VaultEntry[] {
  return entries.filter((entry) => !entry.isDeleted);
}

export function getDuplicatePasswordGroups(entries: VaultEntry[]): VaultEntry[][] {
  const groups = entries.reduce<Record<string, VaultEntry[]>>((acc, entry) => {
    const password = entry.password?.trim();
    if (!password) return acc;
    acc[password] = [...(acc[password] || []), entry];
    return acc;
  }, {});

  return Object.values(groups).filter((group) => group.length > 1);
}

export function getStaleLoginEntries(entries: VaultEntry[], now = Date.now()): VaultEntry[] {
  return entries.filter((entry) => {
    if (!entry.createdAt || entry.type !== 'login') return false;
    const createdTime = new Date(entry.createdAt).getTime();
    if (Number.isNaN(createdTime)) return false;
    const ageInDays = (now - createdTime) / (1000 * 60 * 60 * 24);
    return ageInDays >= 180;
  });
}

export function recordPlaintextExportAudit(now = new Date()): void {
  try {
    sessionStorage.setItem(PLAINTEXT_EXPORT_AUDIT_KEY, now.toISOString());
    localStorage.removeItem(LEGACY_PLAINTEXT_EXPORT_AUDIT_KEY);
  } catch (error) {
    // Health audit history is best-effort and must not block export.
  }
}

export function readPlaintextExportAudit(): string | null {
  try {
    const sessionValue = sessionStorage.getItem(PLAINTEXT_EXPORT_AUDIT_KEY);
    if (sessionValue) return sessionValue;
    const legacyValue = localStorage.getItem(LEGACY_PLAINTEXT_EXPORT_AUDIT_KEY);
    if (legacyValue) {
      localStorage.removeItem(LEGACY_PLAINTEXT_EXPORT_AUDIT_KEY);
      sessionStorage.setItem(PLAINTEXT_EXPORT_AUDIT_KEY, legacyValue);
    }
    return legacyValue;
  } catch (error) {
    return null;
  }
}

export function calculateVaultHealth(entries: VaultEntry[]): VaultHealthSnapshot {
  const activeEntries = getActiveVaultEntries(entries);
  const loginEntries = activeEntries.filter((entry) => entry.type === 'login');
  const cardCount = activeEntries.filter((entry) => entry.type === 'card').length;
  const identityCount = activeEntries.filter((entry) => entry.type === 'identity').length;
  const noteCount = activeEntries.filter((entry) => entry.type === 'note').length;
  const cryptoCount = activeEntries.filter((entry) => entry.type === 'crypto').length;
  const passkeyEntries = activeEntries.filter((entry) => entry.type === 'passkey');
  const weakEntries = activeEntries.filter(isWeakLoginEntry);
  const duplicateGroups = getDuplicatePasswordGroups(activeEntries);
  const duplicateEntryCount = duplicateGroups.reduce((total, group) => total + group.length, 0);
  const staleEntries = getStaleLoginEntries(activeEntries);
  const totpMissingCount = loginEntries.filter((entry) => !entry.totpSecret).length;
  const passkeyUpgradeCount = loginEntries.length;
  const incompletePasskeyCount = passkeyEntries.filter((entry) => !entry.passkeyCredentialId || !entry.passkeyPublicKey).length;
  const plaintextExportLastAt = readPlaintextExportAudit();
  const plaintextExportRisk = !!plaintextExportLastAt;
  const pwnedEntryCount = loginEntries.filter((entry) => Number(entry.pwned_count || 0) > 0).length;
  const masterPasswordAudit = readMasterPasswordAudit();
  const masterPasswordStrong = !!masterPasswordAudit
    && masterPasswordAudit.score >= 75
    && masterPasswordAudit.length >= 12;

  let rawScore = 100;
  if (activeEntries.length > 0) {
    rawScore = 100
      - Math.min(40, weakEntries.length * 15)
      - Math.min(35, duplicateEntryCount * 10)
      - (masterPasswordStrong ? 0 : 15);
    rawScore -= Math.min(15, totpMissingCount * 2);
    rawScore -= Math.min(10, incompletePasskeyCount * 5);
    rawScore -= Math.min(25, pwnedEntryCount * 15);
    rawScore -= plaintextExportRisk ? 8 : 0;
    rawScore = Math.max(10, rawScore);
  }

  return {
    activeEntries,
    totalCount: activeEntries.length,
    loginCount: loginEntries.length,
    cardCount,
    identityCount,
    noteCount,
    cryptoCount,
    passkeyCount: passkeyEntries.length,
    sensitiveCategoryCount: cardCount + identityCount + cryptoCount,
    weakEntries,
    weakCount: weakEntries.length,
    duplicateGroups,
    duplicateEntryCount,
    staleEntries,
    totpMissingCount,
    passkeyUpgradeCount,
    incompletePasskeyCount,
    masterPasswordStrong,
    masterPasswordLength: masterPasswordAudit?.length || 0,
    plaintextExportLastAt,
    plaintextExportRisk,
    pwnedEntryCount,
    overallScore: Math.round(rawScore),
  };
}
