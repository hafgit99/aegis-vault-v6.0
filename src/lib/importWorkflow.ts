import { VaultEntry } from '../types';
import { decryptData } from './backupCrypto';
import {
  ImporterLabels,
  parse1PasswordJSON,
  parseBitwardenJSON,
  parseImportedCSV,
  parseKeePassCSV,
} from './importer';
import { openSecureShareBundleWithReport } from './secureShareBundle';
import type { ImportParseReport, ImportSource } from '../types/import';

interface ImportWorkflowMessages {
  encryptedExpected: string;
  secureShareExpected: string;
  importPasswordRequired: string;
  legacyKdfConfirm: string;
  legacyKdfRejected: string;
  fileIsEncrypted: string;
}

interface ParseVaultImportFileOptions {
  file: File;
  source: ImportSource;
  password: string;
  importerLabels: ImporterLabels;
  messages: ImportWorkflowMessages;
  confirmLegacyKdf?: (message: string) => boolean;
  onReport?: (report: ImportParseReport) => void;
}

export async function parseVaultImportFile({
  file,
  source,
  password,
  importerLabels,
  messages,
  confirmLegacyKdf = confirm,
  onReport,
}: ParseVaultImportFileOptions): Promise<Partial<VaultEntry>[]> {
  const text = await file.text();
  const fileReport = {
    source,
    fileName: file.name,
    fileSizeKb: (file.size / 1024).toFixed(1),
  };

  if (source === 'aegis_encrypted' || source === 'secure_share') {
    const payload = JSON.parse(text);
    if (!payload.encrypted || !payload.data) {
      throw new Error(messages.encryptedExpected);
    }
    if (source === 'secure_share' && payload.kind !== 'secure-share-bundle') {
      throw new Error(messages.secureShareExpected);
    }

    const actualPassword = password.trim();
    if (!actualPassword) {
      throw new Error(messages.importPasswordRequired);
    }

    if (payload.kind === 'secure-share-bundle') {
      const openedBundle = await openSecureShareBundleWithReport(payload, actualPassword);
      onReport?.({
        ...fileReport,
        encrypted: true,
        kdfAlgorithm: payload.kdf?.algorithm || 'unknown',
        legacyKdf: false,
        secureShare: true,
        secureShareItemCount: payload.itemCount,
        secureShareExpiresAt: payload.expiresAt,
        secureShareCreatedAt: payload.createdAt,
        secureShareVersion: payload.version,
        secureShareManifestChecksum: openedBundle.manifestChecksum,
        secureShareManifestVerified: openedBundle.manifestVerified,
      });
      return openedBundle.entries;
    }

    const usesLegacyKdf = !payload.kdf || payload.kdf?.algorithm === 'pbkdf2-sha256';
    if (usesLegacyKdf && !confirmLegacyKdf(messages.legacyKdfConfirm)) {
      throw new Error(messages.legacyKdfRejected);
    }
    onReport?.({
      ...fileReport,
      encrypted: true,
      kdfAlgorithm: payload.kdf?.algorithm || 'pbkdf2-sha256',
      legacyKdf: usesLegacyKdf,
      secureShare: false,
    });

    const decryptedText = await decryptData(payload.data, payload.salt, payload.iv, actualPassword, payload.kdf, {
      allowLegacyPBKDF2: usesLegacyKdf,
    });
    return JSON.parse(decryptedText);
  }

  if (source === 'aegis_plain') {
    const payload = JSON.parse(text);
    if (payload.encrypted) {
      throw new Error(messages.fileIsEncrypted);
    }
    onReport?.({
      ...fileReport,
      encrypted: false,
      legacyKdf: false,
      secureShare: false,
    });
    return payload.vault || (Array.isArray(payload) ? payload : []);
  }

  onReport?.({
    ...fileReport,
    encrypted: false,
    legacyKdf: false,
    secureShare: false,
  });

  if (source === 'bitwarden') {
    return file.name.endsWith('.json')
      ? parseBitwardenJSON(text, importerLabels)
      : parseImportedCSV(text, importerLabels);
  }

  if (source === 'onepassword') {
    return file.name.endsWith('.json')
      ? parse1PasswordJSON(text, importerLabels)
      : parseImportedCSV(text, importerLabels);
  }

  if (source === 'keepass') {
    return parseKeePassCSV(text, importerLabels);
  }

  return parseImportedCSV(text, importerLabels);
}
