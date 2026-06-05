import { VaultEntry } from '../types';
import { BackupKdfMetadata, decryptData, encryptData } from './backupCrypto';
import { createSecurityError } from './securityErrors';

export interface SecureShareBundle {
  app: 'AegisVault';
  kind: 'secure-share-bundle';
  version: '1.0' | '1.1';
  encrypted: true;
  createdAt: string;
  expiresAt?: string;
  itemCount: number;
  manifest?: SecureShareManifest;
  kdf: BackupKdfMetadata;
  salt: string;
  iv: string;
  data: string;
}

export interface SecureShareManifest {
  version: '1.1';
  checksumAlgorithm: 'sha-256';
  checksum: string;
  itemCount: number;
  createdAt: string;
  expiresAt?: string;
}

export interface OpenSecureShareBundleResult {
  entries: VaultEntry[];
  manifestChecksum?: string;
  manifestVerified: boolean;
}

interface SecureSharePayload {
  entries: VaultEntry[];
}

const SECURE_SHARE_VERSION = '1.1';
const SUPPORTED_SECURE_SHARE_VERSIONS = new Set(['1.0', '1.1']);

async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

function isValidDateString(value: string): boolean {
  return Number.isFinite(new Date(value).getTime());
}

function sanitizeEntryForShare(entry: VaultEntry): VaultEntry {
  return {
    ...entry,
    isDeleted: false,
    deletedAt: undefined,
  };
}

export async function createSecureShareBundle(
  entries: VaultEntry[],
  password: string,
  expiresAt?: string,
): Promise<SecureShareBundle> {
  const shareEntries = entries
    .filter(entry => !entry.isDeleted)
    .map(sanitizeEntryForShare);

  if (shareEntries.length === 0) {
    throw createSecurityError('SECURE_SHARE_EMPTY');
  }

  const payload: SecureSharePayload = { entries: shareEntries };
  const plaintext = JSON.stringify(payload);
  const createdAt = new Date().toISOString();
  const manifestChecksum = await sha256Hex(plaintext);
  const sealed = await encryptData(plaintext, password);

  return {
    app: 'AegisVault',
    kind: 'secure-share-bundle',
    version: SECURE_SHARE_VERSION,
    encrypted: true,
    createdAt,
    expiresAt,
    itemCount: shareEntries.length,
    manifest: {
      version: SECURE_SHARE_VERSION,
      checksumAlgorithm: 'sha-256',
      checksum: manifestChecksum,
      itemCount: shareEntries.length,
      createdAt,
      expiresAt,
    },
    kdf: sealed.kdf,
    salt: sealed.salt,
    iv: sealed.iv,
    data: sealed.data,
  };
}

export async function openSecureShareBundleWithReport(
  bundle: SecureShareBundle,
  password: string,
): Promise<OpenSecureShareBundleResult> {
  if (
    bundle.app !== 'AegisVault' ||
    bundle.kind !== 'secure-share-bundle' ||
    !SUPPORTED_SECURE_SHARE_VERSIONS.has(bundle.version) ||
    !bundle.encrypted
  ) {
    throw createSecurityError('SECURE_SHARE_UNSUPPORTED');
  }

  if (!bundle.createdAt || !isValidDateString(bundle.createdAt)) {
    throw createSecurityError('SECURE_SHARE_METADATA_INVALID');
  }

  if (!Number.isSafeInteger(bundle.itemCount) || bundle.itemCount < 1) {
    throw createSecurityError('SECURE_SHARE_METADATA_INVALID');
  }

  if (bundle.version === '1.1' && !bundle.manifest) {
    throw createSecurityError('SECURE_SHARE_METADATA_INVALID');
  }

  if (bundle.manifest) {
    const manifestMatchesEnvelope = (
      bundle.manifest.version === '1.1' &&
      bundle.manifest.checksumAlgorithm === 'sha-256' &&
      bundle.manifest.itemCount === bundle.itemCount &&
      bundle.manifest.createdAt === bundle.createdAt &&
      bundle.manifest.expiresAt === bundle.expiresAt &&
      /^[a-f0-9]{64}$/i.test(bundle.manifest.checksum)
    );

    if (!manifestMatchesEnvelope) {
      throw createSecurityError('SECURE_SHARE_METADATA_INVALID');
    }
  }

  if (bundle.expiresAt && !isValidDateString(bundle.expiresAt)) {
    throw createSecurityError('SECURE_SHARE_EXPIRY_INVALID');
  }

  if (bundle.expiresAt && Date.now() > new Date(bundle.expiresAt).getTime()) {
    throw createSecurityError('SECURE_SHARE_EXPIRED');
  }

  const plaintext = await decryptData(bundle.data, bundle.salt, bundle.iv, password, bundle.kdf);
  if (bundle.manifest && await sha256Hex(plaintext) !== bundle.manifest.checksum.toLowerCase()) {
    throw createSecurityError('SECURE_SHARE_MANIFEST_MISMATCH');
  }

  const payload = JSON.parse(plaintext) as SecureSharePayload;
  if (!Array.isArray(payload.entries)) {
    throw createSecurityError('SECURE_SHARE_PAYLOAD_INVALID');
  }

  if (payload.entries.length !== bundle.itemCount) {
    throw createSecurityError('SECURE_SHARE_ITEM_COUNT_MISMATCH');
  }

  return {
    entries: payload.entries.map(sanitizeEntryForShare),
    manifestChecksum: bundle.manifest?.checksum,
    manifestVerified: Boolean(bundle.manifest),
  };
}

export async function openSecureShareBundle(bundle: SecureShareBundle, password: string): Promise<VaultEntry[]> {
  return (await openSecureShareBundleWithReport(bundle, password)).entries;
}
