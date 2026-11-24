// Dashboard raffle ticket card: maps raffle_my_wins_v1 rows. Pure, no React, no network.
// Row keys follow the claim RPC (win.state, win.qr_token, win.night{title,start_local,venue_name,poster_url}).
// Flat rows (title/start_local on the row itself) are read too, so a shape drift shows a card, not a crash.

export const RAFFLE_FRESH_KEY = 'raffle_win_fresh';

export type RaffleWinCard = {
  winId: string | null;
  qrToken: string;
  /** null = the night is not known: "Your night is locked." */
  night: { title: string; dateLine: string; venue: string | null; posterUrl: string | null } | null;
};

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DDTHH:MM' London wall clock -> 'Thursday 26 Nov'. No timezone maths. */
export function winDateLine(startLocal: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(startLocal);
  if (!m) return '';
  const dow = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return `${DAYS[dow]} ${+m[3]} ${MONTHS[+m[2] - 1]}`;
}

function parseNight(raw: unknown): RaffleWinCard['night'] {
  if (!isObj(raw)) return null;
  const startLocal = str(raw.start_local);
  const dateLine = startLocal ? winDateLine(startLocal) : '';
  if (!dateLine) return null;
  return { title: str(raw.title) ?? 'Bachata night', dateLine, venue: str(raw.venue_name), posterUrl: str(raw.poster_url) };
}

/** The win to show: a locked win with a QR token. Anything else (no wins, error shape) = no card. */
export function parseMyWins(data: unknown): RaffleWinCard | null {
  const rows = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.wins) ? data.wins : [];
  for (const r of rows) {
    if (!isObj(r)) continue;
    const win = isObj(r.win) ? r.win : r;
    if (str(win.state) !== 'locked') continue;
    const qrToken = str(win.qr_token);
    if (!qrToken) continue;
    return { winId: str(win.id), qrToken, night: parseNight(isObj(win.night) ? win.night : win) };
  }
  return null;
}

/** Read the fresh signal once, then clear it. */
export function takeFreshFlag(): boolean {
  try {
    const v = sessionStorage.getItem(RAFFLE_FRESH_KEY) === '1';
    if (v) sessionStorage.removeItem(RAFFLE_FRESH_KEY);
    return v;
  } catch {
    return false;
  }
}
