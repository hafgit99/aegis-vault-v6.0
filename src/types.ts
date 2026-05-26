export type EntryType = 'login' | 'card' | 'note' | 'crypto' | 'passkey' | 'identity';

export interface AttachmentFile {
  id: string;
  name: string;
  size: number;
  type: string;
}

export interface VaultEntry {
  id: string;
  title: string;
  subtitle: string;
  username: string;
  password?: string;
  url?: string;
  notes?: string;
  strength: 'EXCELLENT' | 'GOOD' | 'IMMUTABLE';
  themeColor: 'tertiary' | 'secondary' | 'primary';
  type: EntryType;
  createdAt: string;
  
  // Card specific fields
  cardholder?: string;
  cardNumber?: string;
  expiryDate?: string;
  cvv?: string;

  // Passkey fields
  passkeyDomain?: string;
  passkeyUser?: string;
  passkeyCredentialId?: string;
  passkeyPublicKey?: string;
  passkeyAAGUID?: string;

  // Identity card fields
  idFullName?: string;
  idNumber?: string;
  idSerial?: string;
  idExpiry?: string;
  idNationality?: string;
  idGender?: string;
  idBirthDate?: string;

  // Attachment field
  attachment?: AttachmentFile;

  // Trash support
  deletedAt?: string;
  isDeleted?: boolean;

  // Favorites support
  favorite?: boolean;
}
