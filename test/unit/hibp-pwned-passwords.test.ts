import { describe, expect, it, vi } from 'vitest';
import {
  checkPwnedPassword,
  parsePwnedPasswordRangeResponse,
  scanVaultPasswordsForBreaches,
  sha1Hex,
} from '../../src/lib/hibpPwnedPasswords';
import type { VaultEntry } from '../../src/types';

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: overrides.id || 'entry-1',
  title: overrides.title || 'GitHub',
  subtitle: overrides.subtitle || 'octo',
  username: overrides.username || 'octo',
  password: overrides.password || 'password',
  strength: overrides.strength || 'GOOD',
  themeColor: overrides.themeColor || 'secondary',
  type: overrides.type || 'login',
  createdAt: overrides.createdAt || '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('HIBP pwned passwords k-anonymity', () => {
  it('hashes passwords locally with uppercase SHA-1 hex', async () => {
    await expect(sha1Hex('password')).resolves.toBe('5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8');
  });

  it('parses range responses by matching only the local SHA-1 suffix', () => {
    expect(parsePwnedPasswordRangeResponse([
      '00000000000000000000000000000000000:0',
      '1E4C9B93F3F0682250B6CF8331B7EE68FD8:3303003',
    ].join('\r\n'), '1E4C9B93F3F0682250B6CF8331B7EE68FD8')).toBe(3303003);
  });

  it('sends only the first five SHA-1 characters to the range endpoint', async () => {
    const fetcher = vi.fn(async () => new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:12'));

    await expect(checkPwnedPassword('password', fetcher as typeof fetch)).resolves.toMatchObject({
      prefix: '5BAA6',
      suffix: '1E4C9B93F3F0682250B6CF8331B7EE68FD8',
      count: 12,
    });
    expect(fetcher).toHaveBeenCalledWith('https://api.pwnedpasswords.com/range/5BAA6', {
      headers: { 'Add-Padding': 'true' },
    });
  });

  it('scans active login entries, ignores deleted/non-login records, and reuses duplicate password checks', async () => {
    const fetcher = vi.fn(async () => new Response('1E4C9B93F3F0682250B6CF8331B7EE68FD8:2'));

    const scan = await scanVaultPasswordsForBreaches([
      entry({ id: 'one', password: 'password' }),
      entry({ id: 'two', password: 'password' }),
      entry({ id: 'card', type: 'card', password: 'password' }),
      entry({ id: 'deleted', isDeleted: true, password: 'password' }),
    ], fetcher as typeof fetch);

    expect(scan).toEqual({
      checkedCount: 2,
      breachedCount: 2,
      results: [
        { entryId: 'one', count: 2 },
        { entryId: 'two', count: 2 },
      ],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
});
