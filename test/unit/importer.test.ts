import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  convertImportedToVaultEntry,
  ImporterLabels,
  parseCSV,
  parse1PasswordJSON,
  parseBitwardenJSON,
  parseImportedCSV,
  parseKeePassCSV,
} from '../../src/lib/importer';

const readImportFixture = (name: string) => readFileSync(join(process.cwd(), 'test', 'fixtures', 'import', name), 'utf8');

const labels: ImporterLabels = {
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
  onePasswordRecord: '1Password Record',
};

describe('importer', () => {
  it('parses quoted CSV values with commas, escaped quotes, and CRLF rows', () => {
    const rows = parseCSV('title,notes\r\n"Bank, Primary","Uses ""offline"" recovery"\r\n');

    expect(rows).toEqual([
      ['title', 'notes'],
      ['Bank, Primary', 'Uses "offline" recovery'],
    ]);
  });

  it('keeps empty CSV fields and ignores blank lines between records', () => {
    const rows = parseCSV('title,username,password\n\nGitHub,,secret\nEmpty trailing,,');

    expect(rows).toEqual([
      ['title', 'username', 'password'],
      ['GitHub', '', 'secret'],
      ['Empty trailing', '', ''],
    ]);
  });

  it('parses CSV login rows and applies localized fallback titles', () => {
    const rows = parseImportedCSV('username,password\njane@example.com,secret', labels);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      type: 'login',
      title: 'Login (jane@example.com)',
      username: 'jane@example.com',
      password: 'secret',
    });
  });

  it('returns no imported CSV rows when headers or data rows are missing', () => {
    expect(parseImportedCSV('', labels)).toEqual([]);
    expect(parseImportedCSV('title,password', labels)).toEqual([]);
  });

  it('detects card rows from CSV data', () => {
    const rows = parseImportedCSV('title,cardnumber,cardholder,expiry,cvv\nVisa,4111111111111111,Jane Doe,12/30,123', labels);

    expect(rows[0]).toMatchObject({
      type: 'card',
      title: 'Visa',
      cardNumber: '4111111111111111',
      cardholder: 'Jane Doe',
    });
  });

  it('does not classify short or non-numeric CSV card numbers as cards', () => {
    const rows = parseImportedCSV([
      'title,cardnumber,cardholder,password',
      'Too short,4111,Jane Doe,secret',
      'Not numeric,abcd111111111111,Jane Doe,secret',
    ].join('\n'), labels);

    expect(rows).toEqual([
      expect.objectContaining({ type: 'login', title: 'Too short', password: 'secret' }),
      expect.objectContaining({ type: 'login', title: 'Not numeric', password: 'secret' }),
    ]);
    expect(rows[0].cardNumber).toBeUndefined();
    expect(rows[1].cardNumber).toBeUndefined();
  });

  it('derives CSV fallback titles from URLs and generic record numbers', () => {
    const rows = parseImportedCSV([
      'url,password',
      'https://example.com/login,secret',
      ',orphan-secret',
    ].join('\n'), labels);

    expect(rows[0]).toMatchObject({ title: 'example.com', password: 'secret' });
    expect(rows[1]).toMatchObject({ title: 'Record #2', password: 'orphan-secret' });
  });

  it('maps alternate CSV header aliases for login, notes, and card details', () => {
    const rows = parseImportedCSV([
      'name,address,mail,sifre,description,card_number,card_holder,expiration,code',
      'Primary Card,https://bank.example,ada@example.com,secret,private,4444 3333 2222 1111,Ada Lovelace,11/29,987',
    ].join('\n'), labels);

    expect(rows[0]).toMatchObject({
      type: 'card',
      title: 'Primary Card',
      url: 'https://bank.example',
      username: 'ada@example.com',
      password: 'secret',
      notes: 'private',
      cardNumber: '4444333322221111',
      cardholder: 'Ada Lovelace',
      expiryDate: '11/29',
      cvv: '987',
    });
  });

  it('parses KeePass CSV exports with group context and quoted notes', () => {
    const rows = parseKeePassCSV([
      'Group,Title,Username,Password,URL,Notes',
      '"Banking/Primary","Bank, Main",ada,secret,https://bank.example,"Uses ""offline"" recovery"',
    ].join('\n'), labels);

    expect(rows).toEqual([
      expect.objectContaining({
        type: 'login',
        title: 'Bank, Main',
        username: 'ada',
        password: 'secret',
        url: 'https://bank.example',
        notes: 'Uses "offline" recovery\n\nKeePass group: Banking/Primary',
      }),
    ]);
  });

  it('handles KeePass note-only rows, fallback titles, and blank rows', () => {
    const rows = parseKeePassCSV([
      'Group,Title,Username,Password,URL,Notes',
      ',,,,,',
      'Archive/Recovery,,,,,offline codes',
      ',,jane@example.com,,https://example.com/login,',
    ].join('\n'), labels);

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      type: 'note',
      title: 'Recovery',
      notes: 'offline codes\n\nKeePass group: Archive/Recovery',
    });
    expect(rows[1]).toMatchObject({
      type: 'login',
      title: 'example.com',
      username: 'jane@example.com',
      url: 'https://example.com/login',
    });
  });

  it('converts imported partial entries to complete vault entries', () => {
    const entry = convertImportedToVaultEntry({ type: 'note', notes: 'private' }, labels);

    expect(entry.id).toMatch(/^imported-/);
    expect(entry.title).toBe('Untitled Import');
    expect(entry.subtitle).toBe('Secure Note');
    expect(entry.strength).toBe('IMMUTABLE');
  });

  it('converts login and crypto imports with secure defaults and preserved fields', () => {
    const login = convertImportedToVaultEntry({
      type: 'login',
      title: 'GitHub',
      username: 'octo',
      password: 'secret',
      url: 'https://github.com',
      notes: 'recovery',
    }, labels);
    const crypto = convertImportedToVaultEntry({ type: 'crypto', title: 'Seed', notes: 'seed phrase' }, labels);

    expect(login).toMatchObject({
      title: 'GitHub',
      subtitle: 'octo',
      username: 'octo',
      password: 'secret',
      url: 'https://github.com',
      notes: 'recovery',
      strength: 'EXCELLENT',
      themeColor: 'tertiary',
    });
    expect(login.createdAt).toEqual(expect.any(String));
    expect(crypto).toMatchObject({
      type: 'crypto',
      subtitle: 'Crypto Wallet Key',
      strength: 'IMMUTABLE',
    });
  });

  it('converts cards, passkeys, and identities with specific subtitles', () => {
    expect(convertImportedToVaultEntry({ type: 'card', title: 'Visa', cardNumber: '4111111111111111' }, labels))
      .toMatchObject({ subtitle: expect.stringContaining('1111'), strength: 'IMMUTABLE' });
    expect(convertImportedToVaultEntry({ type: 'card', title: 'Unknown card' }, labels))
      .toMatchObject({ subtitle: 'Credit Card' });
    expect(convertImportedToVaultEntry({ type: 'passkey', passkeyDomain: 'example.com' }, labels))
      .toMatchObject({ subtitle: 'Passkey (example.com)' });
    expect(convertImportedToVaultEntry({ type: 'passkey' }, labels))
      .toMatchObject({ subtitle: 'Passkey (WebAuthn)' });
    expect(convertImportedToVaultEntry({ type: 'identity', idFullName: 'Ada Lovelace' }, labels))
      .toMatchObject({ subtitle: 'Identity: Ada Lovelace' });
    expect(convertImportedToVaultEntry({ type: 'identity', idNumber: 'TR-123' }, labels))
      .toMatchObject({ subtitle: 'Identity: TR-123' });
  });

  it('parses Bitwarden login, card, identity, secure note, and fallback exports', () => {
    const rows = parseBitwardenJSON(JSON.stringify({
      items: [
        { type: 1, name: 'GitHub', login: { username: 'octo', password: 'secret', uris: [{ uri: 'https://github.com' }] } },
        { type: 2, name: 'Recovery', secureNote: {}, notes: 'codes' },
        { type: 3, name: 'Visa', card: { cardholderName: 'Jane Doe', number: '4111', expMonth: '12', expYear: '2030', code: '123' } },
        { type: 4, name: 'Passport', identity: { firstName: 'Ada', lastName: 'Lovelace', passportNumber: 'P1' } },
        { type: 99, name: 'Unknown', notes: 'fallback' },
      ],
    }), labels);

    expect(rows[0]).toMatchObject({ type: 'login', title: 'GitHub', username: 'octo', password: 'secret', url: 'https://github.com' });
    expect(rows[1]).toMatchObject({ type: 'note', title: 'Recovery' });
    expect(rows[2]).toMatchObject({ type: 'card', title: 'Visa', cardholder: 'Jane Doe', expiryDate: '12/2030', cvv: '123' });
    expect(rows[3]).toMatchObject({ type: 'identity', idFullName: 'Ada Lovelace', idNationality: 'International' });
    expect(rows[4]).toMatchObject({ type: 'note', title: 'Unknown' });
  });

  it('parses Bitwarden optional login and identity fallbacks safely', () => {
    const rows = parseBitwardenJSON(JSON.stringify({
      items: [
        { type: 1, name: 'No URI', login: { username: '', password: '', uris: [] } },
        { type: 1, name: 'Blank URI', login: { uris: [{ uri: '' }] } },
        { type: 4, name: 'Local ID', identity: { firstName: '', lastName: '', ssn: '111', passportNumber: '' } },
      ],
    }), labels);

    expect(rows[0]).toMatchObject({ type: 'login', title: 'No URI', username: '', password: '' });
    expect(rows[0].url).toBeUndefined();
    expect(rows[1]).toMatchObject({ type: 'login', title: 'Blank URI', url: '' });
    expect(rows[2]).toMatchObject({
      type: 'identity',
      title: 'Local ID',
      idFullName: '',
      idNumber: '111',
      idNationality: 'Not specified',
    });
  });

  it('parses empty Bitwarden exports and optional card fallbacks', () => {
    expect(parseBitwardenJSON(JSON.stringify({}), labels)).toEqual([]);

    const rows = parseBitwardenJSON(JSON.stringify({
      items: [
        { type: 3, name: 'Minimal Card', card: { expMonth: '', expYear: '' } },
      ],
    }), labels);

    expect(rows[0]).toMatchObject({
      type: 'card',
      title: 'Minimal Card',
      cardholder: '',
      cardNumber: '',
      expiryDate: '/',
      cvv: '',
    });
  });

  it('parses 1Password login, card, note, and nested item exports', () => {
    const rows = parse1PasswordJSON(JSON.stringify({
      items: [
      {
        title: 'GitHub',
        category: 'login',
        url: 'https://github.com',
        fields: [
          { label: 'username', value: 'octo' },
          { label: 'password', value: 'secret' },
        ],
      },
      {
        title: 'Backup Visa',
        category: 'credit card',
        fields: [
          { label: 'cardholder', value: 'Ada Lovelace' },
          { label: 'number', value: '4111 1111 1111 1111' },
          { label: 'expiry', value: '12/30' },
          { label: 'cvv', value: '123' },
        ],
      },
      {
        name: 'Secure backup note',
        typeName: 'secureNote',
        notesPlain: 'offline codes',
      },
      ],
    }), labels);

    expect(rows[0]).toMatchObject({
      type: 'login',
      title: 'GitHub',
      username: 'octo',
      password: 'secret',
      url: 'https://github.com',
    });
    expect(rows[1]).toMatchObject({
      type: 'card',
      title: 'Backup Visa',
      cardholder: 'Ada Lovelace',
      cardNumber: '4111111111111111',
    });
    expect(rows[2]).toMatchObject({
      type: 'note',
      title: 'Secure backup note',
      notes: 'offline codes',
    });
  });

  it('parses direct 1Password arrays and fallback field names', () => {
    const rows = parse1PasswordJSON(JSON.stringify([
      {
        category: 'login',
        fields: [
          { name: 'email', value: 'ada@example.com' },
          { name: 'parola', value: 'secret' },
          { name: 'website', value: 'https://example.com' },
        ],
      },
      {
        title: 'Corporate card',
        typeName: 'card',
        fields: [
          { name: 'holder', value: 'Grace Hopper' },
          { name: 'cardumber', value: '5555 4444 3333 2222' },
          { name: 'expiration', value: '10/31' },
          { name: 'verification', value: '987' },
        ],
      },
    ]), labels);

    expect(rows[0]).toMatchObject({
      type: 'login',
      title: '1Password Record',
      username: 'ada@example.com',
      password: 'secret',
      url: 'https://example.com',
    });
    expect(rows[1]).toMatchObject({
      type: 'card',
      title: 'Corporate card',
      cardholder: 'Grace Hopper',
      cardNumber: '5555444433332222',
      expiryDate: '10/31',
      cvv: '987',
    });
  });

  it('handles empty 1Password exports and missing matching fields without throwing', () => {
    expect(parse1PasswordJSON(JSON.stringify({}), labels)).toEqual([]);

    const rows = parse1PasswordJSON(JSON.stringify([
      {
        title: 'Sparse login',
        category: 'login',
        fields: [{ label: 'unrelated', value: 'ignored' }],
      },
      {
        title: 'Sparse card',
        category: 'credit card',
        fields: [{ label: 'unrelated', value: 'ignored' }],
      },
      {
        title: 'Plain note',
        category: 'note',
        notes: 'plain text',
      },
    ]), labels);

    expect(rows[0]).toMatchObject({ type: 'login', username: '', password: '', url: '' });
    expect(rows[1]).toMatchObject({ type: 'card', cardholder: '', cardNumber: '', expiryDate: '', cvv: '' });
    expect(rows[2]).toMatchObject({ type: 'note', title: 'Plain note', notes: 'plain text' });
  });

  it('keeps the competitor import fixture matrix compatible', () => {
    const bitwarden = parseBitwardenJSON(readImportFixture('bitwarden-export.json'), labels);
    const onePassword = parse1PasswordJSON(readImportFixture('onepassword-export.json'), labels);
    const keepass = parseKeePassCSV(readImportFixture('keepass-export.csv'), labels);
    const lastpass = parseImportedCSV(readImportFixture('lastpass-export.csv'), labels);
    const chrome = parseImportedCSV(readImportFixture('chrome-passwords.csv'), labels);

    expect(bitwarden).toEqual([
      expect.objectContaining({ type: 'login', title: 'GitHub', username: 'octo@example.com', password: 'correct-horse', url: 'https://github.com' }),
      expect.objectContaining({ type: 'note', title: 'Recovery Note', notes: 'Emergency codes' }),
      expect.objectContaining({ type: 'card', title: 'Travel Card', cardholder: 'Ada Lovelace', cardNumber: '4111111111111111', expiryDate: '12/2030' }),
    ]);

    expect(onePassword).toEqual([
      expect.objectContaining({ type: 'login', title: 'Work Login', username: 'ada', password: 'engine-room', url: 'https://work.example.com' }),
      expect.objectContaining({ type: 'card', title: 'Personal Visa', cardholder: 'Grace Hopper', cardNumber: '5555444433332222' }),
      expect.objectContaining({ type: 'note', title: 'Server Note', notes: 'Rack access note' }),
    ]);

    expect(keepass).toEqual([
      expect.objectContaining({ type: 'login', title: 'GitLab, Primary', username: 'ada@example.com', password: 'runner-secret', notes: expect.stringContaining('KeePass group: Internet/Code') }),
      expect.objectContaining({ type: 'note', title: 'Recovery', notes: expect.stringContaining('Offline recovery note') }),
      expect.objectContaining({ type: 'login', title: 'bank.example', username: 'bank-user', password: 'bank-secret' }),
    ]);

    expect(lastpass).toEqual([
      expect.objectContaining({ type: 'login', title: 'LastPass Login', username: 'jane@example.com', password: 'lastpass-secret', notes: 'private note' }),
      expect.objectContaining({ type: 'login', title: 'Secure LastPass Note', username: 'notes' }),
    ]);

    expect(chrome).toEqual([
      expect.objectContaining({ type: 'login', title: 'Chrome Login', username: 'chrome-user', password: 'chrome-secret' }),
      expect.objectContaining({ type: 'login', title: 'Fallback URL', url: 'https://fallback.example.com', password: 'fallback-secret' }),
    ]);
  });
});
