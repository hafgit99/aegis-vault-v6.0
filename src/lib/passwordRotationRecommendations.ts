import type { VaultEntry } from '../types';
import { generateRandomString } from './crypto-types';
import { generateDicewarePassphrase } from './diceware';
import { calculateVaultHealth } from './vaultHealth';

export interface PasswordRotationRecommendation {
  affectedEntries: VaultEntry[];
  affectedCount: number;
  weakCount: number;
  reusedCount: number;
  generatedPassword: string;
  dicewarePassphrase: string;
  dicewareEntropyBits: number;
}

const STRONG_ROTATION_CHARSET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*_-+=';

export function getEntriesRecommendedForRotation(entries: VaultEntry[]): VaultEntry[] {
  const health = calculateVaultHealth(entries);
  const recommended = new Map<string, VaultEntry>();

  health.weakEntries.forEach((entry) => recommended.set(entry.id, entry));
  health.duplicateGroups.flat().forEach((entry) => recommended.set(entry.id, entry));

  return Array.from(recommended.values())
    .filter((entry) => entry.type === 'login' && !entry.isDeleted)
    .sort((a, b) => a.title.localeCompare(b.title));
}

export function buildPasswordRotationRecommendation(entries: VaultEntry[]): PasswordRotationRecommendation {
  const health = calculateVaultHealth(entries);
  const affectedEntries = getEntriesRecommendedForRotation(entries);
  const diceware = generateDicewarePassphrase({
    language: 'tr',
    wordCount: 6,
    wordlistMode: 'clean',
  });

  return {
    affectedEntries,
    affectedCount: affectedEntries.length,
    weakCount: health.weakCount,
    reusedCount: health.duplicateEntryCount,
    generatedPassword: generateRandomString(24, STRONG_ROTATION_CHARSET),
    dicewarePassphrase: diceware.value,
    dicewareEntropyBits: diceware.entropyBits,
  };
}
