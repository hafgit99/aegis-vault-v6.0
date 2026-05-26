import { describe, expect, it } from 'vitest';
import { AVATAR_PRESETS, DEFAULT_AVATAR_URL, normalizeAvatarUrl } from '../../src/lib/avatarPresets';

describe('avatar presets', () => {
  it('ships bundled data-url presets for offline desktop builds', () => {
    expect(AVATAR_PRESETS).toHaveLength(4);
    expect(DEFAULT_AVATAR_URL).toBe(AVATAR_PRESETS[0]);
    expect(AVATAR_PRESETS.every(url => url.startsWith('data:image/svg+xml;utf8,'))).toBe(true);
  });

  it('normalizes missing and legacy remote preset avatars to the bundled default', () => {
    expect(normalizeAvatarUrl(null)).toBe(DEFAULT_AVATAR_URL);
    expect(normalizeAvatarUrl('')).toBe(DEFAULT_AVATAR_URL);
    expect(normalizeAvatarUrl('https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d')).toBe(DEFAULT_AVATAR_URL);
    expect(normalizeAvatarUrl('https://source.unsplash.com/random/150x150')).toBe(DEFAULT_AVATAR_URL);
  });

  it('keeps user-provided custom avatar sources unchanged', () => {
    expect(normalizeAvatarUrl('https://example.com/avatar.png')).toBe('https://example.com/avatar.png');
    expect(normalizeAvatarUrl('data:image/jpeg;base64,uploaded-avatar')).toBe('data:image/jpeg;base64,uploaded-avatar');
  });
});
