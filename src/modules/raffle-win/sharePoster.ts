// Winner share poster (A2 "Door ticket"): pure layout text + canvas drawing + share/save helpers.
// Canvas export 1080x1350 PNG. Spec: docs/briefs/raffle-share-poster-prototype.md.
import { eventHref } from '@/lib/seo/eventHref';
import type { OpenNight } from './model';

export const POSTER_W = 1080;
export const POSTER_H = 1350;
const ORANGE = '#C2410C';
const INK = '#1C1917';
const MUTED = '#6B625C';
const DISP = '"Bricolage Grotesque","Arial Narrow",system-ui,sans-serif';
const BODY = '"DM Sans",system-ui,-apple-system,"Segoe UI",sans-serif';
const DOT = '·';
const ELLIPSIS = '…';

export type PosterInput = {
  firstName: string | null;
  night: Pick<OpenNight, 'title' | 'startLocal' | 'venueName' | 'posterUrl' | 'publicEventId' | 'occurrenceId'>;
  poolCount: number | null;
  origin: string;
};

export type PosterText = {
  headline: string; won: string; at: string; title: string; dateLine: string;
  venueLine: string | null; pill: string | null; link: string; flyerUrl: string | null;
};

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'YYYY-MM-DDTHH:MM' London wall clock -> 'Thu 27 Nov · 20:30'. No timezone maths. */
export function posterDateLine(startLocal: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})/.exec(startLocal);
  if (!m) return '';
  const dow = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])).getUTCDay();
  return `${DAYS[dow]} ${+m[3]} ${MONTHS[+m[2] - 1]} ${DOT} ${m[4]}:${m[5]}`;
}

export function posterText(i: PosterInput): PosterText {
  const n = i.night;
  const path = n.publicEventId ? eventHref({ event_id: n.publicEventId }, n.occurrenceId) : '/raffles';
  return {
    headline: i.firstName?.trim() || 'A dancer',
    won: 'won a free night',
    at: 'at',
    title: n.title,
    dateLine: posterDateLine(n.startLocal),
    venueLine: n.venueName,
    pill: i.poolCount != null && i.poolCount > 0 ? `${i.poolCount} dancers in the draw` : null,
    link: `${i.origin}${path}`.replace(/^[a-z]+:\/\//i, ''),
    flyerUrl: n.posterUrl,
  };
}

type Ctx = CanvasRenderingContext2D;

/** Shrink font until the text fits maxW; if still too wide at minPx, truncate with an ellipsis. */
export function fitText(ctx: Ctx, text: string, maxW: number, startPx: number, minPx: number, font: (px: number) => string): { text: string; px: number } {
  let px = startPx;
  ctx.font = font(px);
  while (px > minPx && ctx.measureText(text).width > maxW) { px -= 2; ctx.font = font(px); }
  let t = text;
  while (t.length > 1 && ctx.measureText(t).width > maxW) t = t.slice(0, -1).trimEnd();
  return { text: t === text ? t : `${t}${ELLIPSIS}`, px };
}

/** Wrap into at most maxLines lines, shrinking the font first, ellipsis on the last line. */
export function wrapLines(ctx: Ctx, text: string, maxW: number, startPx: number, minPx: number, maxLines: number, font: (px: number) => string): { lines: string[]; px: number } {
  const words = text.split(/\s+/).filter(Boolean);
  const layout = (px: number): string[] | null => {
    ctx.font = font(px);
    const lines: string[] = [];
    let cur = '';
    for (const w of words) {
      const next = cur ? `${cur} ${w}` : w;
      if (ctx.measureText(next).width <= maxW || !cur) { cur = next; } else { lines.push(cur); cur = w; }
    }
    if (cur) lines.push(cur);
    return lines.length <= maxLines && lines.every((l) => ctx.measureText(l).width <= maxW) ? lines : null;
  };
  for (let px = startPx; px >= minPx; px -= 2) {
    const l = layout(px);
    if (l) return { lines: l, px };
  }
  ctx.font = font(minPx);
  const flat = fitText(ctx, text, maxW, minPx, minPx, font);
  return { lines: [flat.text], px: minPx };
}

function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

export function loadFlyer(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

/** Draws the poster. `flyer` null = orange title block. All sizes are fractions of width (cqw in the prototype). */
export function drawPoster(canvas: HTMLCanvasElement, t: PosterText, flyer: HTMLImageElement | null): boolean {
  const ctx = canvas.getContext('2d');
  if (!ctx) return false;
  canvas.width = POSTER_W; canvas.height = POSTER_H;
  const u = POSTER_W / 100; // 1cqw
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = ORANGE; ctx.fillRect(0, 0, POSTER_W, POSTER_H);
  const tx = 4 * u, ty = 4 * u, tw = POSTER_W - 8 * u, th = POSTER_H - 8 * u;
  ctx.fillStyle = '#fff'; rr(ctx, tx, ty, tw, th, 4 * u); ctx.fill();

  // mark
  const px0 = tx + 5 * u;
  let y = ty + 5 * u;
  ctx.fillStyle = ORANGE; ctx.beginPath(); ctx.arc(px0 + 1.3 * u, y + 1.5 * u, 1.3 * u, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = INK; ctx.font = `700 ${3 * u}px ${BODY}`;
  ctx.fillText('Bachata Calendar', px0 + 3.8 * u, y + 2.5 * u);
  y += 4 * u + 4 * u;

  // flyer 40 x 50 cqw
  const fw = 40 * u, fh = 50 * u;
  let drewFlyer = false;
  if (flyer && flyer.naturalWidth > 0) {
    try {
      ctx.save(); rr(ctx, px0, y, fw, fh, 2 * u); ctx.clip();
      const s = Math.max(fw / flyer.naturalWidth, fh / flyer.naturalHeight);
      const dw = flyer.naturalWidth * s, dh = flyer.naturalHeight * s;
      ctx.drawImage(flyer, px0 + (fw - dw) / 2, y + (fh - dh) / 2, dw, dh);
      ctx.restore();
      ctx.getImageData(0, 0, 1, 1); // throws if the canvas is tainted
      drewFlyer = true;
    } catch { ctx.restore?.(); drewFlyer = false; }
  }
  if (!drewFlyer) {
    // redraw card area under the flyer slot in case a failed draw left marks
    ctx.fillStyle = '#fff'; ctx.fillRect(px0 - 1, y - 1, fw + 2, fh + 2);
    ctx.fillStyle = ORANGE; rr(ctx, px0, y, fw, fh, 2 * u); ctx.fill();
    ctx.save(); rr(ctx, px0, y, fw, fh, 2 * u); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.1)'; ctx.lineWidth = 2 * u;
    for (let k = -fh; k < fw + fh; k += 6 * u * 1.414) { ctx.beginPath(); ctx.moveTo(px0 + k, y); ctx.lineTo(px0 + k - fh, y + fh); ctx.stroke(); }
    ctx.restore();
    ctx.fillStyle = '#fff';
    const w = wrapLines(ctx, t.title, fw - 6 * u, 5.6 * u, 3 * u, 3, (p) => `800 ${p}px ${DISP}`);
    ctx.font = `800 ${w.px}px ${DISP}`;
    const lh = w.px * 0.98;
    w.lines.forEach((l, k) => ctx.fillText(l, px0 + 3 * u, y + fh - 3 * u - (w.lines.length - 1 - k) * lh - w.px * 0.15));
  }

  // name + won, right of flyer, bottom aligned
  const rx = px0 + fw + 4 * u;
  const rw = tx + tw - 5 * u - rx;
  const nm = fitText(ctx, t.headline, rw, 12 * u, 5 * u, (p) => `800 ${p}px ${DISP}`);
  const won = fitText(ctx, t.won, rw, 5.6 * u, 3 * u, (p) => `600 ${p}px ${DISP}`);
  ctx.fillStyle = INK; ctx.font = `600 ${won.px}px ${DISP}`;
  const wonBase = y + fh - 0.5 * u;
  ctx.fillText(won.text, rx, wonBase);
  ctx.fillStyle = ORANGE; ctx.font = `800 ${nm.px}px ${DISP}`;
  ctx.fillText(nm.text, rx, wonBase - won.px - 1.5 * u);
  y += fh + 4.5 * u;

  // tear line with notches
  ctx.strokeStyle = ORANGE; ctx.lineWidth = 0.6 * u; ctx.setLineDash([1.6 * u, 1.2 * u]);
  ctx.beginPath(); ctx.moveTo(tx + 5 * u, y); ctx.lineTo(tx + tw - 5 * u, y); ctx.stroke(); ctx.setLineDash([]);
  ctx.fillStyle = ORANGE;
  ctx.beginPath(); ctx.arc(tx, y, 3 * u, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(tx + tw, y, 3 * u, 0, Math.PI * 2); ctx.fill();
  y += 4.5 * u;

  // bottom part
  const bw = tw - 10 * u;
  ctx.fillStyle = INK;
  const atW = (() => { ctx.font = `600 ${6.6 * u}px ${DISP}`; return ctx.measureText(`${t.at} `).width; })();
  const ti = wrapLines(ctx, t.title, bw - atW, 6.6 * u, 4 * u, 2, (p) => `800 ${p}px ${DISP}`);
  ctx.font = `600 ${ti.px}px ${DISP}`;
  const atX = ctx.measureText(`${t.at} `).width;
  y += ti.px * 0.9;
  ctx.font = `600 ${ti.px}px ${DISP}`; ctx.fillText(t.at, px0, y);
  ctx.font = `800 ${ti.px}px ${DISP}`;
  ti.lines.forEach((l, k) => { ctx.fillText(l, px0 + atX, y); if (k < ti.lines.length - 1) y += ti.px * 1.12; });
  y += 3.7 * u * 1.35 + 1.6 * u;
  ctx.fillStyle = MUTED; ctx.font = `500 ${3.7 * u}px ${BODY}`;
  ctx.fillText(t.dateLine, px0, y);
  if (t.venueLine) {
    y += 3.7 * u * 1.35;
    ctx.fillText(fitText(ctx, t.venueLine, bw, 3.7 * u, 2.6 * u, (p) => `500 ${p}px ${BODY}`).text, px0, y);
  }

  // footer: pill then link, anchored to the bottom of the ticket
  const linkY = ty + th - 5 * u;
  ctx.fillStyle = ORANGE;
  const lk = fitText(ctx, t.link, bw, 3 * u, 1.8 * u, (p) => `700 ${p}px ${BODY}`);
  ctx.font = `700 ${lk.px}px ${BODY}`;
  ctx.fillText(lk.text, px0, linkY);
  if (t.pill) {
    const [num, ...rest] = t.pill.split(' ');
    const ph = 3.3 * u * 1.2 + 2.8 * u;
    ctx.font = `800 ${3.3 * u}px ${BODY}`; const nw = ctx.measureText(`${num} `).width;
    ctx.font = `600 ${3.3 * u}px ${BODY}`; const restW = ctx.measureText(rest.join(' ')).width;
    const pw = nw + restW + 6 * u;
    const py = linkY - 3 * u - 3 * u - ph;
    ctx.strokeStyle = ORANGE; ctx.lineWidth = 0.5 * u; rr(ctx, px0, py, pw, ph, ph / 2); ctx.stroke();
    ctx.fillStyle = ORANGE; ctx.textBaseline = 'middle';
    ctx.font = `800 ${3.3 * u}px ${BODY}`; ctx.fillText(num, px0 + 3 * u, py + ph / 2);
    ctx.font = `600 ${3.3 * u}px ${BODY}`; ctx.fillText(` ${rest.join(' ')}`, px0 + 3 * u + nw - ctx.measureText(' ').width, py + ph / 2);
    ctx.textBaseline = 'alphabetic';
  }
  return true;
}

/** Builds the poster canvas (flyer failures fall back to the no-flyer variant, never throw). */
export async function renderPoster(canvas: HTMLCanvasElement, t: PosterText): Promise<void> {
  const flyer = t.flyerUrl ? await loadFlyer(t.flyerUrl) : null;
  drawPoster(canvas, t, flyer);
  if (flyer) {
    try { canvas.toDataURL(); } catch { drawPoster(canvas, t, null); }
  }
}

export const posterSlug = (title: string): string =>
  title.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'night';

export const posterFileName = (title: string): string => `raffle-win-${posterSlug(title)}.png`;

export const canvasToPng = (canvas: HTMLCanvasElement): Promise<Blob | null> =>
  new Promise((resolve) => { try { canvas.toBlob((b) => resolve(b), 'image/png'); } catch { resolve(null); } });

export function downloadPng(blob: Blob, name: string) {
  const href = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = href; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(href), 1000);
}

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

/** navigator.share with the PNG when the browser can share files; otherwise download. AbortError = cancelled. */
export async function sharePosterFile(blob: Blob, t: PosterText): Promise<ShareResult> {
  const name = posterFileName(t.title);
  const file = new File([blob], name, { type: 'image/png' });
  const nav = typeof navigator !== 'undefined' ? navigator : undefined;
  if (nav && typeof nav.share === 'function' && typeof nav.canShare === 'function' && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], text: `I won a free night at ${t.title}! ${t.link}` });
      return 'shared';
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') return 'cancelled';
      return 'failed';
    }
  }
  downloadPng(blob, name);
  return 'downloaded';
}
