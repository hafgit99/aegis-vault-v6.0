const LEGACY_REMOTE_AVATAR_HOSTS = [
  'images.unsplash.com',
  'plus.unsplash.com',
  'source.unsplash.com',
];

const createAvatarDataUrl = (
  backgroundStart: string,
  backgroundEnd: string,
  foreground: string,
  initials: string,
  accent: string
) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 160 160" role="img" aria-label="AegisVault avatar ${initials}"><defs><linearGradient id="bg" x1="20" y1="16" x2="140" y2="144" gradientUnits="userSpaceOnUse"><stop stop-color="${backgroundStart}"/><stop offset="1" stop-color="${backgroundEnd}"/></linearGradient><filter id="shadow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="8" stdDeviation="8" flood-color="#000000" flood-opacity=".22"/></filter></defs><rect width="160" height="160" rx="80" fill="url(#bg)"/><circle cx="80" cy="64" r="30" fill="${foreground}" opacity=".96" filter="url(#shadow)"/><path d="M31 140c7-31 26-48 49-48s42 17 49 48" fill="${foreground}" opacity=".96"/><circle cx="118" cy="116" r="17" fill="${accent}" stroke="${foreground}" stroke-width="5"/><path d="M110 116l5 5 12-13" fill="none" stroke="${foreground}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><text x="80" y="151" text-anchor="middle" font-family="Inter, Arial, sans-serif" font-size="14" font-weight="800" fill="${foreground}" opacity=".9">${initials}</text></svg>`;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const AVATAR_PRESETS = [
  createAvatarDataUrl('#195d70', '#0b1f33', '#f7fbff', 'AV', '#20d6a4'),
  createAvatarDataUrl('#7c3aed', '#172554', '#fbf7ff', 'AE', '#38bdf8'),
  createAvatarDataUrl('#0f766e', '#18230f', '#f8fff7', 'VX', '#facc15'),
  createAvatarDataUrl('#be123c', '#111827', '#fff7ed', 'ID', '#fb923c'),
];

export const DEFAULT_AVATAR_URL = AVATAR_PRESETS[0];

export const isLegacyRemoteAvatarUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    return LEGACY_REMOTE_AVATAR_HOSTS.some(host => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
  } catch {
    return false;
  }
};

export const normalizeAvatarUrl = (url?: string | null) => {
  const trimmedUrl = url?.trim();
  if (!trimmedUrl || isLegacyRemoteAvatarUrl(trimmedUrl)) {
    return DEFAULT_AVATAR_URL;
  }

  return trimmedUrl;
};
