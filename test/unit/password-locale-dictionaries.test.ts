import { describe, expect, it } from 'vitest';
import {
  analyzePasswordStrengthWithZxcvbn,
} from '../../src/lib/passwordStrength';
import {
  assessTurkishPasswordPatterns,
  getTurkishPasswordUserInputs,
} from '../../src/lib/passwordLocaleDictionaries';

describe('Turkish password dictionary support', () => {
  it('feeds zxcvbn with Turkish words, cities, teams, dates, and local keyboard walks', () => {
    const inputs = getTurkishPasswordUserInputs('Galatasaray1905!');

    expect(inputs).toContain('galatasaray');
    expect(inputs).toContain('galatasaray1905');
    expect(inputs).toContain('istanbul34');
    expect(inputs).toContain('asdfgh');
    expect(inputs).toContain('qwerty');
  });

  it('detects Turkish dictionary words even with diacritics and simple substitutions', () => {
    expect(assessTurkishPasswordPatterns('T\u00fcrkiye1923!').risks).toContain('turkish_dictionary');
    expect(assessTurkishPasswordPatterns('S1fre123!').risks).toContain('turkish_dictionary');
  });

  it('caps zxcvbn scores for common Turkish password combinations', async () => {
    const analysis = await analyzePasswordStrengthWithZxcvbn('Galatasaray1905!');

    expect(analysis.zxcvbnScore).toBeLessThanOrEqual(2);
    expect(analysis.suggestions).toContain('Avoid Turkish names, teams, cities, months, and national dates in passwords.');
  });

  it('caps local keyboard walks more aggressively than dictionary words', async () => {
    const analysis = await analyzePasswordStrengthWithZxcvbn('asdfgh123!');

    expect(analysis.zxcvbnScore).toBeLessThanOrEqual(1);
    expect(analysis.suggestions).toContain('Avoid local keyboard walks such as asdfgh, qwerty, zxcvbn, and simple number runs.');
  });
});
