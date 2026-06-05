export type SecurityErrorCategory =
  | 'auth'
  | 'crypto'
  | 'validation'
  | 'storage'
  | 'network'
  | 'release'
  | 'unknown';

export type SecurityErrorSeverity = 'info' | 'warning' | 'critical';

export type SecurityErrorCode =
  | 'AUTH_CONFIG_MISSING'
  | 'AUTH_INVALID_CREDENTIALS'
  | 'AUTH_OLD_PASSWORD_INVALID'
  | 'VAULT_LOCKED'
  | 'BACKUP_ENCRYPTION_FAILED'
  | 'BACKUP_DECRYPTION_FAILED'
  | 'SECURE_SHARE_EMPTY'
  | 'SECURE_SHARE_UNSUPPORTED'
  | 'SECURE_SHARE_METADATA_INVALID'
  | 'SECURE_SHARE_EXPIRY_INVALID'
  | 'SECURE_SHARE_EXPIRED'
  | 'SECURE_SHARE_PAYLOAD_INVALID'
  | 'SECURE_SHARE_MANIFEST_MISMATCH'
  | 'SECURE_SHARE_ITEM_COUNT_MISMATCH'
  | 'IMPORT_PARSE_FAILED'
  | 'IMPORT_EMPTY'
  | 'STORAGE_UNAVAILABLE'
  | 'NETWORK_BLOCKED'
  | 'VALIDATION_FAILED'
  | 'UNKNOWN_SECURITY_ERROR';

export interface SecurityErrorDefinition {
  code: SecurityErrorCode;
  category: SecurityErrorCategory;
  severity: SecurityErrorSeverity;
  safeForUser: boolean;
  defaultMessage: string;
}

export const SECURITY_ERROR_DEFINITIONS: Record<SecurityErrorCode, SecurityErrorDefinition> = {
  AUTH_CONFIG_MISSING: {
    code: 'AUTH_CONFIG_MISSING',
    category: 'auth',
    severity: 'critical',
    safeForUser: true,
    defaultMessage: 'Vault authentication metadata is missing.',
  },
  AUTH_INVALID_CREDENTIALS: {
    code: 'AUTH_INVALID_CREDENTIALS',
    category: 'auth',
    severity: 'critical',
    safeForUser: true,
    defaultMessage: 'Invalid vault credentials.',
  },
  AUTH_OLD_PASSWORD_INVALID: {
    code: 'AUTH_OLD_PASSWORD_INVALID',
    category: 'auth',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Current master password is invalid.',
  },
  VAULT_LOCKED: {
    code: 'VAULT_LOCKED',
    category: 'auth',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Vault is locked.',
  },
  BACKUP_ENCRYPTION_FAILED: {
    code: 'BACKUP_ENCRYPTION_FAILED',
    category: 'crypto',
    severity: 'critical',
    safeForUser: true,
    defaultMessage: 'Backup encryption failed.',
  },
  BACKUP_DECRYPTION_FAILED: {
    code: 'BACKUP_DECRYPTION_FAILED',
    category: 'crypto',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Backup password is incorrect or the file is corrupted.',
  },
  SECURE_SHARE_EMPTY: {
    code: 'SECURE_SHARE_EMPTY',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Secure share bundle requires at least one active entry.',
  },
  SECURE_SHARE_UNSUPPORTED: {
    code: 'SECURE_SHARE_UNSUPPORTED',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Unsupported secure share bundle.',
  },
  SECURE_SHARE_METADATA_INVALID: {
    code: 'SECURE_SHARE_METADATA_INVALID',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Secure share bundle metadata is invalid.',
  },
  SECURE_SHARE_EXPIRY_INVALID: {
    code: 'SECURE_SHARE_EXPIRY_INVALID',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Secure share bundle expiry is invalid.',
  },
  SECURE_SHARE_EXPIRED: {
    code: 'SECURE_SHARE_EXPIRED',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Secure share bundle has expired.',
  },
  SECURE_SHARE_PAYLOAD_INVALID: {
    code: 'SECURE_SHARE_PAYLOAD_INVALID',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Secure share bundle payload is invalid.',
  },
  SECURE_SHARE_MANIFEST_MISMATCH: {
    code: 'SECURE_SHARE_MANIFEST_MISMATCH',
    category: 'validation',
    severity: 'critical',
    safeForUser: true,
    defaultMessage: 'Secure share bundle integrity manifest does not match payload.',
  },
  SECURE_SHARE_ITEM_COUNT_MISMATCH: {
    code: 'SECURE_SHARE_ITEM_COUNT_MISMATCH',
    category: 'validation',
    severity: 'critical',
    safeForUser: true,
    defaultMessage: 'Secure share bundle item count does not match payload.',
  },
  IMPORT_PARSE_FAILED: {
    code: 'IMPORT_PARSE_FAILED',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Import parsing failed.',
  },
  IMPORT_EMPTY: {
    code: 'IMPORT_EMPTY',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'No compatible records were found.',
  },
  STORAGE_UNAVAILABLE: {
    code: 'STORAGE_UNAVAILABLE',
    category: 'storage',
    severity: 'critical',
    safeForUser: true,
    defaultMessage: 'Local secure storage is unavailable.',
  },
  NETWORK_BLOCKED: {
    code: 'NETWORK_BLOCKED',
    category: 'network',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Network request was blocked by local-first policy.',
  },
  VALIDATION_FAILED: {
    code: 'VALIDATION_FAILED',
    category: 'validation',
    severity: 'warning',
    safeForUser: true,
    defaultMessage: 'Input validation failed.',
  },
  UNKNOWN_SECURITY_ERROR: {
    code: 'UNKNOWN_SECURITY_ERROR',
    category: 'unknown',
    severity: 'critical',
    safeForUser: false,
    defaultMessage: 'A security-sensitive operation failed.',
  },
};

export class AegisSecurityError extends Error {
  readonly code: SecurityErrorCode;
  readonly category: SecurityErrorCategory;
  readonly severity: SecurityErrorSeverity;
  readonly safeForUser: boolean;

  constructor(code: SecurityErrorCode, message?: string, options?: ErrorOptions) {
    const definition = SECURITY_ERROR_DEFINITIONS[code];
    super(message || definition.defaultMessage, options);
    this.name = 'AegisSecurityError';
    this.code = definition.code;
    this.category = definition.category;
    this.severity = definition.severity;
    this.safeForUser = definition.safeForUser;
  }
}

export const createSecurityError = (
  code: SecurityErrorCode,
  message?: string,
  cause?: unknown,
): AegisSecurityError => (
  new AegisSecurityError(code, message, cause instanceof Error ? { cause } : undefined)
);

export const isSecurityError = (error: unknown): error is AegisSecurityError => (
  error instanceof AegisSecurityError
);

export const classifySecurityError = (error: unknown): SecurityErrorDefinition => {
  if (isSecurityError(error)) {
    return SECURITY_ERROR_DEFINITIONS[error.code];
  }

  return SECURITY_ERROR_DEFINITIONS.UNKNOWN_SECURITY_ERROR;
};

export const publicSecurityErrorMessage = (error: unknown): string => {
  if (isSecurityError(error) && error.safeForUser) {
    return error.message;
  }

  if (error instanceof Error && error.message && !/password|secret|token|key|credential/i.test(error.message)) {
    return error.message;
  }

  return SECURITY_ERROR_DEFINITIONS.UNKNOWN_SECURITY_ERROR.defaultMessage;
};
