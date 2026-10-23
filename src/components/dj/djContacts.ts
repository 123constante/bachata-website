// DJ contact helpers (W1 S2).

const IG_HOST = /^(https?:\/\/)?((www|m)\.)?instagram\.com(\/|$|\?|#)/i;
// First path segments that are Instagram's own pages, never a person.
const IG_NOT_A_HANDLE = new Set(['explore', 'p', 'reel', 'reels', 'stories', 'tv', 'accounts', 'direct']);

/** The handle a URL on instagram.com points at, or null when it points at no person. */
const igHandle = (url: string): string | null => {
  const rest = url.replace(IG_HOST, '');
  const seg = rest.split(/[/?#]/)[0] ?? '';
  if (!/^[A-Za-z0-9._]{1,30}$/.test(seg)) return null;
  return IG_NOT_A_HANDLE.has(seg.toLowerCase()) ? null : seg;
};

/**
 * A website field that actually holds an Instagram link is the Instagram contact
 * (it printed a bare "www.instagram.com"). An Instagram URL that names no person
 * (home page, /explore, a post or reel) is dropped: it would be a button to nowhere.
 */
export const splitInstagramWebsite = (instagram: string | null, website: string | null): { instagram: string | null; website: string | null } => {
  const w = website?.trim();
  if (w && IG_HOST.test(w)) {
    if (instagram?.trim()) return { instagram, website: null };
    return { instagram: igHandle(w) ? w : null, website: null };
  }
  return { instagram, website };
};
