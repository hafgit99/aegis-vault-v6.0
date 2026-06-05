export type ImportSource =
  | 'aegis_encrypted'
  | 'secure_share'
  | 'aegis_plain'
  | 'bitwarden'
  | 'onepassword'
  | 'keepass'
  | 'lastpass'
  | 'chrome'
  | 'generic_csv';

export type ImportConflictMode = 'merge' | 'replace';

export interface ImportFeedback {
  success: boolean;
  msg: string;
}

export interface ImportParseReport {
  source: ImportSource;
  fileName: string;
  fileSizeKb: string;
  encrypted: boolean;
  kdfAlgorithm?: string;
  legacyKdf: boolean;
  secureShare: boolean;
  secureShareItemCount?: number;
  secureShareExpiresAt?: string;
  secureShareCreatedAt?: string;
  secureShareVersion?: string;
  secureShareManifestChecksum?: string;
  secureShareManifestVerified?: boolean;
}

export interface ImportReview extends ImportParseReport {
  totalRecords: number;
  selectedRecords: number;
  loginCount: number;
  cardCount: number;
  noteCount: number;
  identityCount: number;
  passkeyCount: number;
  otherCount: number;
}

export interface ImportResultReport extends ImportReview {
  importedRecords: number;
  skippedRecords: number;
  conflictMode: ImportConflictMode;
  completedAt: string;
}
