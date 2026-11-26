// Dashboard raffle ticket card: maps raffle_my_wins_v1 rows. Pure, no React, no network.
// Row keys follow the claim RPC (win.state, win.qr_token, win.night{title,start_local,venue_name,poster_url}).
// Flat rows (title/start_local on the row itself) are read too, so a shape drift shows a card, not a crash.

export const RAFFLE_FRESH_KEY = 'raffle_win_fresh';

export type RaffleWinCard = {
  winId: string | null;
  qrToken: string;
  /** The door has already admitted this win: the card says "You're in" and hides the QR. */
  attended: boolean;
  /** null = the night is not known: "Your night is locked." */
  night: { title: string; dateLine: string; venue: string | null; posterUrl: string | null; startLocal: string; timeLine: string; dateKey: string } | null;
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

/** 'YYYY-MM-DDTHH:MM' -> '8:00 pm' ('' when there is no time part). */
export function winTimeLine(startLocal: string): string {
  const m = /T(\d{2}):(\d{2})/.exec(startLocal);
  if (!m) return '';
  const h = +m[1];
  return `${h % 12 === 0 ? 12 : h % 12}:${m[2]} ${h < 12 ? 'am' : 'pm'}`;
}

/** Whole days from today's London key to the night's date key (>= 0 once the night is known). */
export function daysUntilKey(todayKey: string, dateKey: string): number {
  const t = (k: string) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10));
  return Math.round((t(dateKey) - t(todayKey)) / 86400000);
}

function parseNight(raw: unknown): RaffleWinCard['night'] {
  if (!isObj(raw)) return null;
  const startLocal = str(raw.start_local);
  const dateLine = startLocal ? winDateLine(startLocal) : '';
  if (!dateLine) return null;
  const timeLine = winTimeLine(startLocal ?? '');
  return { title: str(raw.title) ?? 'Bachata night', dateLine, venue: str(raw.venue_name), posterUrl: str(raw.poster_url), startLocal: startLocal ?? '', timeLine, dateKey: (startLocal ?? '').slice(0, 10) };
}

/** The win to show: a locked win with a QR token. Anything else (no wins, error shape) = no card. */
export function parseMyWins(data: unknown): RaffleWinCard | null {
  const rows = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.wins) ? data.wins : [];
  for (const r of rows) {
    if (!isObj(r)) continue;
    const win = isObj(r.win) ? r.win : r;
    const attended = win.attended === true || r.attended === true;
    if (str(win.state) !== 'locked' && !attended) continue;
    const qrToken = str(win.qr_token);
    if (!qrToken) continue;
    return { winId: str(win.id), qrToken, attended, night: parseNight(isObj(win.night) ? win.night : win) };
  }
  return null;
}

/** Every QR token in a raffle_my_wins_v1 reply (the door page asks: is this visitor the winner?). */
export function parseMyWinTokens(data: unknown): string[] {
  const rows = Array.isArray(data) ? data : isObj(data) && Array.isArray(data.wins) ? data.wins : [];
  const out: string[] = [];
  for (const r of rows) {
    if (!isObj(r)) continue;
    const t = str((isObj(r.win) ? r.win : r).qr_token);
    if (t) out.push(t);
  }
  return out;
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
