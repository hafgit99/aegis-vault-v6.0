import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  buildPasswordRotationRecommendation,
  getEntriesRecommendedForRotation,
} from '../../src/lib/passwordRotationRecommendations';
import type { VaultEntry } from '../../src/types';

const entry = (overrides: Partial<VaultEntry> = {}): VaultEntry => ({
  id: 'entry-1',
  title: 'GitHub',
  subtitle: '',
  username: 'octo',
  password: 'VeryStrongPassword123!',
  url: 'https://example.com',
  notes: '',
  strength: 'EXCELLENT',
  themeColor: 'primary',
  type: 'login',
  createdAt: '2026-01-01T00:00:00.000Z',
  ...overrides,
});

describe('password rotation recommendations', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deduplicates weak and reused login entries recommended for rotation', () => {
    const entries = [
      entry({ id: '1', title: 'GitHub', password: 'shared123' }),
      entry({ id: '2', title: 'Mail', password: 'shared123' }),
      entry({ id: '3', title: 'Bank', password: 'AnotherVeryStrongPassword123!' }),
      entry({ id: '4', title: 'Deleted', password: 'shared123', isDeleted: true }),
      entry({ id: '5', title: 'Card', type: 'card', password: 'shared123' }),
    ];

    expect(getEntriesRecommendedForRotation(entries).map((item) => item.id)).toEqual(['1', '2']);
  });

  it('builds local random and Diceware replacement suggestions', () => {
    const getRandomValues = vi.spyOn(crypto, 'getRandomValues');
    let value = 0;
    getRandomValues.mockImplementation((array) => {
      const values = array as Uint32Array;
      values.fill(value++);
      return array;
    });

    const recommendation = buildPasswordRotationRecommendation([
      entry({ id: '1', title: 'GitHub', password: 'short' }),
    ]);

    expect(recommendation.affectedCount).toBe(1);
    expect(recommendation.weakCount).toBe(1);
    expect(recommendation.generatedPassword).toHaveLength(24);
    expect(recommendation.dicewarePassphrase.split('-')).toHaveLength(6);
    expect(recommendation.dicewareEntropyBits).toBeGreaterThan(70);
  });
});
