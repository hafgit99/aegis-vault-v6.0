import { VaultEntry, EntryType } from '../types';
import { generateRandomString } from './crypto-types';

export interface ImporterLabels {
  accessLogin: string;
  login: string;
  creditCard: string;
  secureNote: string;
  cryptoWalletKey: string;
  passkey: string;
  identity: string;
  idCard: string;
  untitledImport: string;
  loginTitle: string;
  recordTitle: string;
  international: string;
  notSpecified: string;
  onePasswordRecord: string;
}

const defaultLabels: ImporterLabels = {
  accessLogin: 'Access Login',
  login: 'Login',
  creditCard: 'Credit Card',
  secureNote: 'Secure Note',
  cryptoWalletKey: 'Crypto Wallet Key',
  passkey: 'Passkey',
  identity: 'Identity',
  idCard: 'ID Card',
  untitledImport: 'Untitled Import',
  loginTitle: 'Login',
  recordTitle: 'Record',
  international: 'International',
  notSpecified: 'Not specified',
  onePasswordRecord: '1Password Record'
};

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  !!value
  && typeof value === 'object'
  && !Array.isArray(value)
  && (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
);

const safeString = (value: unknown): string => (
  typeof value === 'string' ? value : ''
);

const safeObjectArray = (value: unknown): Record<string, unknown>[] => (
  Array.isArray(value) ? value.filter(isPlainObject) : []
);

// Robust CSV parser handling headers, quotation marks, commas, and escaped characters.
export function parseCSV(csvText: string): string[][] {
  const result: string[][] = [];
  let row: string[] = [];
  let currentVal = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    const nextChar = csvText[i + 1];

    if (inQuotes) {
      if (char === '"') {
        if (nextChar === '"') {
          // Double quote escaping within quoted field
          currentVal += '"';
          i++; // skip next quote
        } else {
          // End of quote
          inQuotes = false;
        }
      } else {
        currentVal += char;
      }
    } else {
      if (char === '"') {
        inQuotes = true;
      } else if (char === ',') {
        row.push(currentVal.trim());
        currentVal = '';
      } else if (char === '\n' || char === '\r') {
        row.push(currentVal.trim());
        if (row.length > 0 && !(row.length === 1 && row[0] === '')) {
          result.push(row);
        }
        row = [];
        currentVal = '';
        if (char === '\r' && nextChar === '\n') {
          i++; // skip LF
        }
      } else {
        currentVal += char;
      }
    }
  }
  if (currentVal !== '' || row.length > 0) {
    row.push(currentVal.trim());
    result.push(row);
  }
  return result;
}

export function convertImportedToVaultEntry(imported: Partial<VaultEntry>, labels: ImporterLabels = defaultLabels): VaultEntry {
  const finalType: EntryType = imported.type || 'login';
  
  // Create a consistent subtitle
  let subtitle = labels.accessLogin;
  if (finalType === 'login') {
    subtitle = imported.username || labels.login;
  } else if (finalType === 'card') {
    const cardNum = imported.cardNumber || '';
    subtitle = cardNum ? '•••• •••• •••• ' + cardNum.slice(-4) : labels.creditCard;
  } else if (finalType === 'note') {
    subtitle = labels.secureNote;
  } else if (finalType === 'crypto') {
    subtitle = labels.cryptoWalletKey;
  } else if (finalType === 'passkey') {
    subtitle = `${labels.passkey} (${imported.passkeyDomain || 'WebAuthn'})`;
  } else if (finalType === 'identity') {
    subtitle = `${labels.identity}: ${imported.idFullName || imported.idNumber || labels.idCard}`;
  }

  return {
    id: `imported-${generateRandomString(18, 'abcdefghijklmnopqrstuvwxyz0123456789')}-${Date.now()}`,
    title: imported.title || labels.untitledImport,
    type: finalType,
    subtitle: subtitle,
    username: imported.username || '',
    password: imported.password || '',
    url: imported.url || '',
    notes: imported.notes || '',
    strength: imported.password ? 'EXCELLENT' : 'IMMUTABLE', // secure default
    themeColor: 'tertiary',
    
    // Card details
    cardholder: imported.cardholder,
    cardNumber: imported.cardNumber,
    expiryDate: imported.expiryDate,
    cvv: imported.cvv,

    // Passkey details
    passkeyDomain: imported.passkeyDomain,
    passkeyUser: imported.passkeyUser,
    passkeyCredentialId: imported.passkeyCredentialId,
    passkeyPublicKey: imported.passkeyPublicKey,
    passkeyAAGUID: imported.passkeyAAGUID,

    // Identity Card details
    idFullName: imported.idFullName,
    idNumber: imported.idNumber,
    idSerial: imported.idSerial,
    idExpiry: imported.idExpiry,
    idNationality: imported.idNationality,
    idGender: imported.idGender,
    idBirthDate: imported.idBirthDate,
    createdAt: new Date().toISOString()
  };
}

export function parseImportedCSV(csvText: string, labels: ImporterLabels = defaultLabels): Partial<VaultEntry>[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  
  // Find column index based on keywords
  const findIndex = (keywords: string[]): number => {
    return headers.findIndex(h => keywords.some(k => h.includes(k)));
  };

  const titleIdx = headers.findIndex(h => (
    ['title', 'başlık', 'baslik', 'site', 'label'].some(k => h.includes(k)) ||
    ['name', 'ad'].includes(h)
  ));
  const urlIdx = findIndex(['url', 'link', 'address', 'adres', 'website']);
  const userIdx = findIndex(['username', 'user', 'kullanici', 'kullanıcı', 'email', 'mail', 'login', 'eposta', 'e-posta']);
  const passIdx = findIndex(['password', 'pass', 'sifre', 'şifre', 'pw']);
  const notesIdx = findIndex(['note', 'notes', 'extra', 'aciklama', 'açıklama', 'desc', 'description']);

  // Card fields for standard managers
  const cardNumIdx = findIndex(['cardnumber', 'card_number', 'kartnumarasi', 'kart_numarası', 'kartno', 'number']);
  const cardHolderIdx = findIndex(['cardholder', 'card_holder', 'sahibi', 'adsoyad', 'kart_üzerindeki_ad']);
  const cardExpIdx = findIndex(['expiry', 'expiration', 'süre', 'valid', 'exp_month', 'exp_year']);
  const cardCvvIdx = findIndex(['cvv', 'cvc', 'pin', 'code', 'güvenlik']);

  const results: Partial<VaultEntry>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const entry: Partial<VaultEntry> = { type: 'login' };

    // Fill fields if index was found and row has sufficient length
    if (titleIdx !== -1 && titleIdx < row.length && row[titleIdx]) entry.title = row[titleIdx];
    if (urlIdx !== -1 && urlIdx < row.length && row[urlIdx]) entry.url = row[urlIdx];
    if (userIdx !== -1 && userIdx < row.length && row[userIdx]) entry.username = row[userIdx];
    if (passIdx !== -1 && passIdx < row.length && row[passIdx]) entry.password = row[passIdx];
    if (notesIdx !== -1 && notesIdx < row.length && row[notesIdx]) entry.notes = row[notesIdx];

    // Card mappings
    if (cardNumIdx !== -1 && cardNumIdx < row.length && row[cardNumIdx]) {
      const parsedNum = row[cardNumIdx].replace(/\s/g, '');
      if (parsedNum && parsedNum.length >= 10 && !isNaN(Number(parsedNum.substring(0, 4)))) {
        entry.type = 'card';
        entry.cardNumber = parsedNum;
        if (cardHolderIdx !== -1 && cardHolderIdx < row.length && row[cardHolderIdx]) entry.cardholder = row[cardHolderIdx];
        if (cardExpIdx !== -1 && cardExpIdx < row.length && row[cardExpIdx]) entry.expiryDate = row[cardExpIdx];
        if (cardCvvIdx !== -1 && cardCvvIdx < row.length && row[cardCvvIdx]) entry.cvv = row[cardCvvIdx];
      }
    }

    // Fallbacks if Title is missing
    if (!entry.title) {
      if (entry.url) {
        entry.title = entry.url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      } else if (entry.username) {
        entry.title = `${labels.loginTitle} (${entry.username})`;
      } else {
        entry.title = `${labels.recordTitle} #${r}`;
      }
    }

    results.push(entry);
  }

  return results;
}

export function parseKeePassCSV(csvText: string, labels: ImporterLabels = defaultLabels): Partial<VaultEntry>[] {
  const rows = parseCSV(csvText);
  if (rows.length < 2) return [];

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const findHeader = (aliases: string[]): number => headers.findIndex(header => aliases.some(alias => header === alias || header.includes(alias)));
  const read = (row: string[], index: number): string => (index !== -1 && index < row.length ? row[index].trim() : '');

  const groupIdx = findHeader(['group', 'path', 'folder']);
  const titleIdx = findHeader(['title', 'name']);
  const userIdx = findHeader(['username', 'user name', 'user', 'login', 'account']);
  const passIdx = findHeader(['password', 'pass']);
  const urlIdx = findHeader(['url', 'website', 'web site', 'address']);
  const notesIdx = findHeader(['notes', 'note', 'comments', 'comment']);

  const results: Partial<VaultEntry>[] = [];

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const group = read(row, groupIdx);
    const title = read(row, titleIdx);
    const username = read(row, userIdx);
    const password = read(row, passIdx);
    const url = read(row, urlIdx);
    const notes = read(row, notesIdx);

    if (![group, title, username, password, url, notes].some(Boolean)) {
      continue;
    }

    const entry: Partial<VaultEntry> = {
      type: username || password || url ? 'login' : 'note',
      title,
      username,
      password,
      url,
      notes
    };

    if (group) {
      entry.notes = [notes, `KeePass group: ${group}`].filter(Boolean).join('\n\n');
    }

    if (!entry.title) {
      if (url) {
        entry.title = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
      } else if (username) {
        entry.title = `${labels.loginTitle} (${username})`;
      } else if (group) {
        entry.title = group.split(/[\\/]/).filter(Boolean).pop() || `${labels.recordTitle} #${results.length + 1}`;
      } else {
        entry.title = `${labels.recordTitle} #${results.length + 1}`;
      }
    }

    results.push(entry);
  }

  return results;
}

export function parseBitwardenJSON(jsonText: string, labels: ImporterLabels = defaultLabels): Partial<VaultEntry>[] {
  const data = JSON.parse(jsonText) as unknown;
  if (!isPlainObject(data)) return [];
  // Support both standard exports and encrypted-unlocked json files
  const items = safeObjectArray(data.items);
  const results: Partial<VaultEntry>[] = [];

  for (const item of items) {
    const entry: Partial<VaultEntry> = {
      title: safeString(item.name),
      notes: safeString(item.notes)
    };

    if (item.type === 1 && isPlainObject(item.login)) {
      const login = item.login;
      entry.type = 'login';
      entry.username = safeString(login.username);
      entry.password = safeString(login.password);
      const uris = safeObjectArray(login.uris);
      if (uris.length > 0) {
        entry.url = safeString(uris[0].uri);
      }
    } else if (item.type === 2 && isPlainObject(item.secureNote)) {
      entry.type = 'note';
    } else if (item.type === 3 && isPlainObject(item.card)) {
      const card = item.card;
      entry.type = 'card';
      entry.cardholder = safeString(card.cardholderName);
      entry.cardNumber = safeString(card.number);
      entry.expiryDate = `${safeString(card.expMonth)}/${safeString(card.expYear)}`;
      entry.cvv = safeString(card.code);
    } else if (item.type === 4 && isPlainObject(item.identity)) {
      const identity = item.identity;
      entry.type = 'identity';
      entry.idFullName = `${safeString(identity.firstName)} ${safeString(identity.lastName)}`.trim();
      entry.idNumber = safeString(identity.ssn);
      entry.idNationality = safeString(identity.passportNumber) ? labels.international : labels.notSpecified;
    } else {
      entry.type = 'note';
    }

    results.push(entry);
  }

  return results;
}

export function parse1PasswordJSON(jsonText: string, labels: ImporterLabels = defaultLabels): Partial<VaultEntry>[] {
  const data = JSON.parse(jsonText) as unknown;
  if (!Array.isArray(data) && !isPlainObject(data)) return [];
  // Standard 1Password unencrypted export structure
  const results: Partial<VaultEntry>[] = [];

  // Support array list directly or nested elements
  const list = Array.isArray(data) ? data.filter(isPlainObject) : safeObjectArray(data.items);

  for (const item of list) {
    const entry: Partial<VaultEntry> = {
      title: safeString(item.title) || safeString(item.name) || labels.onePasswordRecord,
      notes: safeString(item.notes) || safeString(item.notesPlain),
      type: 'login'
    };

    // Category mapping
    const category = (safeString(item.category) || safeString(item.typeName)).toLowerCase();
    if (category.includes('credit') || category.includes('card')) {
      entry.type = 'card';
      const fields = safeObjectArray(item.fields);
      const getFieldVal = (lbls: string[]) => safeString(fields.find((field) => {
        const label = (safeString(field.label) || safeString(field.name)).toLowerCase();
        return lbls.some(l => label.includes(l));
      })?.value);
      entry.cardholder = getFieldVal(['cardholder', 'holder', 'name']);
      entry.cardNumber = getFieldVal(['number', 'cardumber']).replace(/\s/g, '');
      entry.expiryDate = getFieldVal(['expiry', 'expiration']);
      entry.cvv = getFieldVal(['cvv', 'cvc', 'verification']);
    } else if (category.includes('note') || category.includes('securenote')) {
      entry.type = 'note';
    } else {
      entry.type = 'login';
      const fields = safeObjectArray(item.fields);
      const getFieldVal = (lbls: string[]) => safeString(fields.find((field) => {
        const label = (safeString(field.label) || safeString(field.name)).toLowerCase();
        return lbls.some(l => label === l);
      })?.value);
      entry.username = getFieldVal(['username', 'email', 'login', 'kullanıcı adı']);
      entry.password = getFieldVal(['password', 'kod', 'parola', 'şifre']);
      entry.url = safeString(item.url) || getFieldVal(['url', 'website', 'adres']);
    }

    results.push(entry);
  }

  return results;
}
