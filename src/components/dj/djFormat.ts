// DJ page formatting shared by DjTiles (today's page) and DjRolePage (W2-C). Plain module, so the
// component files keep exporting components only.

// --- date helpers -------------------------------------------
// Times are stored naive ("local-as-UTC"); display exactly as stored,
// never Intl-convert. So parse the Y-M-D directly from the string.
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function parseDateParts(iso: string | null): { day: string; mon: string; monYear: string } | null {
  if (!iso) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return null;
  const year = m[1];
  const monIdx = Math.max(0, Math.min(11, parseInt(m[2], 10) - 1));
  const day = m[3];
  return {
    day,
    mon: MONTHS[monIdx],
    monYear: `${MONTHS[monIdx].toUpperCase()} \u2019${year.slice(2)}`,
  };
}

const IG_BARE = /^@?([A-Za-z0-9._]{1,30})$/;

/** An Instagram field as a link: a bare handle ("@djnadia") is a profile on instagram.com, else as normalizeUrl. */
export const instagramUrl = (raw: string | null | undefined): string | null => {
  const h = IG_BARE.exec(raw?.trim() ?? '');
  return h ? `https://instagram.com/${h[1]}` : normalizeUrl(raw);
};

/** A bare domain gets https:// (as the contact panel has always done); blank = null. */
export const normalizeUrl = (raw: string | null | undefined) => {
  if (!raw?.trim()) return null;
  return raw.trim().startsWith('http') ? raw.trim() : `https://${raw.trim()}`;
};
