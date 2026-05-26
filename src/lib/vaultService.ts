import { SQLiteOPFS } from './SQLiteOPFS';
import { VaultCryptoService } from './vault/VaultCryptoService';
import { VaultAuthService, StoredCredential } from './vault/VaultAuthService';
import { VaultEntry } from '../types';
import { localizedMessage } from '../i18n/localizedMessages';

export class VaultService {
  public aesKey: CryptoKey | null = null;
  public rawKey: Uint8Array | null = null;
  public sqliteDb: SQLiteOPFS | null = null;
  public isConnected = false;
  private dbName = 'aegis_vault';

  public isUnlocked(): boolean {
    return this.aesKey !== null;
  }

  /**
   * Initializes the SQLite OPFS database, derives the AES key, and verifies credentials.
   */
  async initDb(
    password: string,
    secretKey: string,
    isSetupAction: boolean = false
  ): Promise<void> {
    try {
      // 1. Open SQLite database on OPFS
      const db = new SQLiteOPFS(this.dbName);
      await db.open();
      this.sqliteDb = db;

      const params = VaultAuthService.calibrateArgon2Params();

      if (isSetupAction) {
        // 2a. Setup Action: Generate main salt and derive master key
        const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
        const saltB64 = btoa(String.fromCharCode(...newSalt));

        const derived = await VaultAuthService.deriveMasterKey({
          password,
          secretKey,
          saltB64,
          params,
        });

        this.aesKey = derived.aesKey;
        this.rawKey = derived.sensitiveMaterial;

        // 3a. Save credentials to SQLite
        const credential = await VaultAuthService.createAuthCredential(password, params);
        
        db.putMetadata('main_salt', { id: 'main_salt', salt: saltB64 });
        db.putMetadata('auth_credential', { id: 'auth_credential', credential });
        await db.flushToOPFS();
      } else {
        // 2b. Unlock Action: Retrieve salt and verify password
        const saltMeta = db.getMetadata<{ salt: string }>('main_salt');
        const authMeta = db.getMetadata<{ credential: StoredCredential }>('auth_credential');

        if (!saltMeta || !authMeta) {
          throw new Error(localizedMessage('dbConfigMissing'));
        }

        const derived = await VaultAuthService.deriveMasterKey({
          password,
          secretKey,
          saltB64: saltMeta.salt,
          params,
        });

        const isValid = await VaultAuthService.verifyPassword(password, authMeta.credential, params);
        if (!isValid) {
          throw new Error(localizedMessage('invalidMasterPassword'));
        }

        this.aesKey = derived.aesKey;
        this.rawKey = derived.sensitiveMaterial;
      }

      this.isConnected = true;
      console.log('[VaultService] SQLite DB initialized and unlocked successfully.');
    } catch (error) {
      await this.lock();
      throw error;
    }
  }

  /**
   * Retrieves, decrypts, and maps all password entries from SQLite
   */
  async getPasswords(): Promise<VaultEntry[]> {
    if (!this.sqliteDb || !this.aesKey) {
      return [];
    }

    const rows = this.sqliteDb.getAllPasswords();
    const entries: VaultEntry[] = [];

    for (const row of rows) {
      try {
        // Decrypt basic fields
        const decryptedPassword = row.encrypted_password && row.iv
          ? await VaultCryptoService.decryptTextField(this.aesKey, row.encrypted_password, row.iv, this.rawKey)
          : undefined;

        const decryptedNotes = row.encrypted_notes && row.notes_iv
          ? await VaultCryptoService.decryptTextField(this.aesKey, row.encrypted_notes, row.notes_iv, this.rawKey)
          : undefined;

        // Decrypt objects
        const cardDetails = row.encrypted_card_details && row.card_details_iv
          ? await VaultCryptoService.decryptJSON<any>(this.aesKey, row.encrypted_card_details, row.card_details_iv, this.rawKey)
          : null;

        const identityDetails = row.encrypted_identity_details && row.identity_details_iv
          ? await VaultCryptoService.decryptJSON<any>(this.aesKey, row.encrypted_identity_details, row.identity_details_iv, this.rawKey)
          : null;

        const passkeyMeta = row.encrypted_passkey_meta && row.passkey_meta_iv
          ? await VaultCryptoService.decryptJSON<any>(this.aesKey, row.encrypted_passkey_meta, row.passkey_meta_iv, this.rawKey)
          : null;

        entries.push({
          id: String(row.id),
          title: String(row.title),
          subtitle: row.username ? String(row.username) : '',
          username: row.username ? String(row.username) : '',
          password: decryptedPassword || undefined,
          notes: decryptedNotes || undefined,
          url: row.website ? String(row.website) : '',
          strength: row.strength || 'GOOD',
          themeColor: row.strength === 'IMMUTABLE' ? 'tertiary' : row.strength === 'EXCELLENT' ? 'primary' : 'secondary',
          type: row.category ? row.category : 'login',
          createdAt: row.updated_at || new Date().toISOString(),
          deletedAt: row.deletedAt || undefined,
          isDeleted: !!row.deletedAt,

          // Card details mapping
          cardholder: cardDetails?.cardholder || undefined,
          cardNumber: cardDetails?.cardNumber || undefined,
          expiryDate: cardDetails?.expiryDate || undefined,
          cvv: cardDetails?.cvv || undefined,

          // Passkey mapping
          passkeyDomain: passkeyMeta?.passkeyDomain || undefined,
          passkeyUser: passkeyMeta?.passkeyUser || undefined,
          passkeyCredentialId: passkeyMeta?.passkeyCredentialId || undefined,
          passkeyPublicKey: passkeyMeta?.passkeyPublicKey || undefined,
          passkeyAAGUID: passkeyMeta?.passkeyAAGUID || undefined,

          // Identity Card mapping
          idFullName: identityDetails?.idFullName || undefined,
          idNumber: identityDetails?.idNumber || undefined,
          idSerial: identityDetails?.idSerial || undefined,
          idExpiry: identityDetails?.idExpiry || undefined,
          idNationality: identityDetails?.idNationality || undefined,
          idGender: identityDetails?.idGender || undefined,
          idBirthDate: identityDetails?.idBirthDate || undefined,

          attachment: (row.attachments && Array.isArray(row.attachments) && row.attachments.length > 0)
            ? row.attachments[0]
            : undefined,
          favorite: !!row.favorite,
        } as any);
      } catch (err) {
        console.error(`Failed to decrypt row ${row.id}:`, err);
      }
    }

    return entries;
  }

  /**
   * Encrypts and saves or updates an entry in the SQLite database
   */
  async savePassword(entry: VaultEntry, flush: boolean = true): Promise<void> {
    if (!this.sqliteDb || !this.aesKey) {
      throw new Error(localizedMessage('dbLocked'));
    }

    // 1. Encrypt sensitive basic fields
    const encryptedPassword = entry.password
      ? await VaultCryptoService.encryptTextField(this.aesKey, entry.password, this.rawKey)
      : null;

    const encryptedNotes = entry.notes
      ? await VaultCryptoService.encryptTextField(this.aesKey, entry.notes, this.rawKey)
      : null;

    // 2. Encrypt complex JSON fields based on type
    let encryptedCard = null;
    if (entry.type === 'card') {
      const cardObj = {
        cardholder: entry.cardholder,
        cardNumber: entry.cardNumber,
        expiryDate: entry.expiryDate,
        cvv: entry.cvv,
      };
      encryptedCard = await VaultCryptoService.encryptJSON(this.aesKey, cardObj, this.rawKey);
    }

    let encryptedIdentity = null;
    if (entry.type === 'identity') {
      const identityObj = {
        idFullName: entry.idFullName,
        idNumber: entry.idNumber,
        idSerial: entry.idSerial,
        idExpiry: entry.idExpiry,
        idNationality: entry.idNationality,
        idGender: entry.idGender,
        idBirthDate: entry.idBirthDate,
      };
      encryptedIdentity = await VaultCryptoService.encryptJSON(this.aesKey, identityObj, this.rawKey);
    }

    let encryptedPasskey = null;
    if (entry.type === 'passkey') {
      const passkeyObj = {
        passkeyDomain: entry.passkeyDomain,
        passkeyUser: entry.passkeyUser,
        passkeyCredentialId: entry.passkeyCredentialId,
        passkeyPublicKey: entry.passkeyPublicKey,
        passkeyAAGUID: entry.passkeyAAGUID,
      };
      encryptedPasskey = await VaultCryptoService.encryptJSON(this.aesKey, passkeyObj, this.rawKey);
    }

    // 3. Prepare row details
    const attachments = entry.attachment ? [entry.attachment] : [];

    // Calculate actual strength dynamically based on password content/length
    let calculatedStrength: 'GOOD' | 'EXCELLENT' | 'IMMUTABLE' = 'GOOD';
    if (entry.type === 'login' && entry.password) {
      const pass = entry.password.trim();
      if (pass.length > 16) calculatedStrength = 'IMMUTABLE';
      else if (pass.length > 12) calculatedStrength = 'EXCELLENT';
      else calculatedStrength = 'GOOD';
    } else if (entry.type === 'passkey' || entry.type === 'identity' || entry.type === 'note' || entry.type === 'card') {
      calculatedStrength = 'IMMUTABLE';
    }

    const row: Record<string, any> = {
      id: entry.id,
      title: entry.title,
      username: entry.username || entry.idFullName || entry.passkeyUser || '',
      category: entry.type,
      website: entry.url || entry.passkeyDomain || '',
      strength: calculatedStrength,
      tags: [],
      pwned_count: 0,
      favorite: entry.favorite ? 1 : 0,
      attachments,
      deleted_at: entry.deletedAt || null,
      deletedAt: entry.deletedAt || null,
      updated_at: new Date().toISOString(),

      // Encrypted fields mapping
      encrypted_password: encryptedPassword?.encrypted || null,
      iv: encryptedPassword?.iv || null,
      encrypted_notes: encryptedNotes?.encrypted || null,
      notes_iv: encryptedNotes?.iv || null,

      encrypted_card_details: encryptedCard?.encrypted || null,
      card_details_iv: encryptedCard?.iv || null,

      encrypted_identity_details: encryptedIdentity?.encrypted || null,
      identity_details_iv: encryptedIdentity?.iv || null,

      encrypted_passkey_meta: encryptedPasskey?.encrypted || null,
      passkey_meta_iv: encryptedPasskey?.iv || null,
    };

    // Save into SQLite
    this.sqliteDb.putPassword(row);
    if (flush) {
      await this.sqliteDb.flushToOPFS();
    }
  }

  /**
   * Delete entry permanently from SQLite
   */
  async deletePassword(id: string): Promise<void> {
    if (!this.sqliteDb) return;
    this.sqliteDb.deletePassword(id);
    await this.sqliteDb.flushToOPFS();
  }

  /**
   * Cryptographically changes the Master Password of the vault.
   * Decrypts all records in-memory, re-derives a new AES Master Key from the new password,
   * re-encrypts all records, and saves the new KDF credentials metadata in SQLite.
   */
  async changeMasterPassword(oldPassword: string, newPassword: string): Promise<void> {
    if (!this.sqliteDb || !this.aesKey) {
      throw new Error(localizedMessage('dbLocked'));
    }

    // 1. Verify old password
    const authMeta = this.sqliteDb.getMetadata<{ credential: StoredCredential }>('auth_credential');
    if (!authMeta) {
      throw new Error(localizedMessage('dbAuthMissing'));
    }
    const params = VaultAuthService.calibrateArgon2Params();
    const isValid = await VaultAuthService.verifyPassword(oldPassword, authMeta.credential, params);
    if (!isValid) {
      throw new Error(localizedMessage('oldMasterInvalid'));
    }

    // 2. Load and decrypt all entries with the CURRENT key
    const loadedEntries = await this.getPasswords();

    // 3. Derive the NEW master key
    const newSalt = window.crypto.getRandomValues(new Uint8Array(16));
    const newSaltB64 = btoa(String.fromCharCode(...newSalt));

    const secretKey = localStorage.getItem('aegis_secret_key') || 'A3-DEMOKEY-2026-AEGIS-SECURE';
    const newDerived = await VaultAuthService.deriveMasterKey({
      password: newPassword,
      secretKey,
      saltB64: newSaltB64,
      params,
    });

    // 4. Temporarily replace our aesKey and rawKey with the NEW key, encrypt and save all entries back
    const oldKey = this.aesKey;
    const oldRawKey = this.rawKey;
    this.aesKey = newDerived.aesKey;
    this.rawKey = newDerived.sensitiveMaterial;

    try {
      for (const entry of loadedEntries) {
        await this.savePassword(entry);
      }

      // 5. Update auth credentials metadata
      const newCredential = await VaultAuthService.createAuthCredential(newPassword, params);
      
      this.sqliteDb.putMetadata('main_salt', { id: 'main_salt', salt: newSaltB64 });
      this.sqliteDb.putMetadata('auth_credential', { id: 'auth_credential', credential: newCredential });
      
      // Flush to disk
      await this.sqliteDb.flushToOPFS();

      // 6. Update local master password persistence if applicable
      localStorage.setItem('aegis_master_password', newPassword);

      console.log('[VaultService] Master Password changed and database re-keyed successfully.');
    } catch (err) {
      // Rollback on failure
      this.aesKey = oldKey;
      this.rawKey = oldRawKey;
      throw err;
    }
  }

  /**
   * Wipes the entire OPFS SQLite database
   */
  async wipeAllData(): Promise<void> {
    if (this.sqliteDb) {
      await this.sqliteDb.wipeAll();
    }
    await this.lock();
  }

  /**
   * Clear memory keys and close SQLite file connections safely
   */
  async lock(): Promise<void> {
    this.aesKey = null;
    this.rawKey = null;
    if (this.sqliteDb) {
      await this.sqliteDb.close();
      this.sqliteDb = null;
    }
    this.isConnected = false;
    console.log('[VaultService] Locked and SQLite closed.');
  }
}

export const vaultService = new VaultService();
