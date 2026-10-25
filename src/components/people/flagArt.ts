/**
 * Flag artwork for the nationality badge, bundled inline: no network call, no CDN.
 *
 * Simplified artwork on a 30x20 grid, drawn at 14-61px wide as a sticker, so coats of
 * arms are reduced to a plain emblem. Covers every code in use on
 * production (survey 2026-10-12: ES CO AR EC BO ZA IT VE GB DE CY) plus the nationalities
 * most likely next; any other valid code gets the generic flag with its two letters.
 */

const rect = (fill: string, x = 0, y = 0, w = 30, h = 20) =>
  `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
const h3 = (a: string, b: string, c: string) => rect(a, 0, 0, 30, 6.67) + rect(b, 0, 6.66, 30, 6.68) + rect(c, 0, 13.33, 30, 6.67);
const v3 = (a: string, b: string, c: string) => rect(a, 0, 0, 10, 20) + rect(b, 10, 0, 10, 20) + rect(c, 20, 0, 10, 20);
const h2 = (a: string, b: string) => rect(a, 0, 0, 30, 10) + rect(b, 0, 10, 30, 10);
const stripes = (n: number, a: string, b: string) =>
  Array.from({ length: n }, (_, i) => rect(i % 2 ? b : a, 0, (i * 20) / n, 30, 20 / n + 0.05)).join('');
const circle = (cx: number, cy: number, r: number, fill: string) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;
const star = (cx: number, cy: number, r: number, fill: string) => {
  const pts: string[] = [];
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 ? r * 0.4 : r;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    pts.push(`${(cx + rad * Math.cos(a)).toFixed(2)},${(cy + rad * Math.sin(a)).toFixed(2)}`);
  }
  return `<polygon points="${pts.join(' ')}" fill="${fill}"/>`;
};
const cross = (field: string, bar: string, x: number, w: number, y: number, h: number) =>
  rect(field) + rect(bar, x, 0, w, 20) + rect(bar, 0, y, 30, h);

const GB =
  rect('#012169') +
  '<path d="M0 0L30 20M30 0L0 20" stroke="#fff" stroke-width="4"/><path d="M0 0L30 20M30 0L0 20" stroke="#C8102E" stroke-width="1.4"/>' +
  rect('#fff', 12, 0, 6, 20) + rect('#fff', 0, 7, 30, 6) + rect('#C8102E', 13.2, 0, 3.6, 20) + rect('#C8102E', 0, 8.2, 30, 3.6);

const veStars = Array.from({ length: 8 }, (_, i) => {
  const a = ((200 + (i * 140) / 7) * Math.PI) / 180;
  return circle(+(15 + 4.6 * Math.cos(a)).toFixed(2), +(13.4 + 4.6 * Math.sin(a)).toFixed(2), 0.55, '#fff');
}).join('');

/** Inner SVG markup per code, on a 30x20 viewBox. */
export const FLAG_ART: Readonly<Record<string, string>> = {
  // In use on production (2026-10-12).
  ES: rect('#AA151B') + rect('#F1BF00', 0, 5, 30, 10) + rect('#AA151B', 7, 8, 3, 4),
  CO: rect('#FCD116', 0, 0, 30, 10) + rect('#003893', 0, 10, 30, 5) + rect('#CE1126', 0, 15, 30, 5),
  AR: h3('#74ACDF', '#fff', '#74ACDF') + circle(15, 10, 2.1, '#F6B40E'),
  EC: rect('#FFDD00', 0, 0, 30, 10) + rect('#034EA2', 0, 10, 30, 5) + rect('#ED1C24', 0, 15, 30, 5) + '<ellipse cx="15" cy="10" rx="2.4" ry="3" fill="#7A5C2E"/>',
  BO: h3('#D52B1E', '#F9E300', '#007934'),
  ZA:
    rect('#E03C31', 0, 0, 30, 10) + rect('#001489', 0, 10, 30, 10) +
    '<path d="M0 0L12 10L30 10M0 20L12 10" stroke="#fff" stroke-width="6.6" fill="none"/>' +
    '<path d="M0 0L12 10L30 10M0 20L12 10" stroke="#007749" stroke-width="4" fill="none"/>' +
    '<polygon points="0,2.6 10,10 0,17.4" fill="#FFB81C"/><polygon points="0,4.4 7.6,10 0,15.6" fill="#000"/>',
  IT: v3('#009246', '#fff', '#CE2B37'),
  VE: h3('#FFCC00', '#00247D', '#CF142B') + veStars,
  GB,
  DE: h3('#000', '#DD0000', '#FFCE00'),
  CY:
    rect('#fff') +
    '<path d="M8 8.5C10.5 6.5 16 6.6 22.5 5C21.5 7.2 19.4 8.4 16.4 9.6C13.4 10.6 10.2 10.4 8 8.5Z" fill="#D57800"/>' +
    '<path d="M10 13.2Q15 16.4 20 13.2" stroke="#4E5B31" stroke-width="1" fill="none"/>',
  // Likely next.
  FR: v3('#002654', '#fff', '#CE1126'),
  PT: rect('#DA291C') + rect('#046A38', 0, 0, 12, 20) + circle(12, 10, 3.4, '#FFE900') + rect('#fff', 10.6, 8.2, 2.8, 3.6),
  BR: rect('#009C3B') + '<polygon points="15,2.6 27.4,10 15,17.4 2.6,10" fill="#FEDF00"/>' + circle(15, 10, 4.3, '#002776') +
    '<path d="M10.9 9.2Q15 8.2 19.1 10.6" stroke="#fff" stroke-width="0.8" fill="none"/>',
  MX: v3('#006847', '#fff', '#CE1126') + circle(15, 10, 2.2, '#8C5A2B'),
  DO: rect('#002D62', 0, 0, 13.5, 8.5) + rect('#CE1126', 16.5, 0, 13.5, 8.5) + rect('#CE1126', 0, 11.5, 13.5, 8.5) + rect('#002D62', 16.5, 11.5, 13.5, 8.5) +
    rect('#fff', 13.5, 0, 3, 20) + rect('#fff', 0, 8.5, 30, 3),
  CU: stripes(5, '#002A8F', '#fff') + '<polygon points="0,0 13,10 0,20" fill="#CF142B"/>' + star(4.6, 10, 2.4, '#fff'),
  PR: stripes(5, '#ED0000', '#fff') + '<polygon points="0,0 13,10 0,20" fill="#0050F0"/>' + star(4.6, 10, 2.4, '#fff'),
  PE: v3('#D91023', '#fff', '#D91023'),
  CL: rect('#D52B1E') + rect('#fff', 0, 0, 30, 10) + rect('#0039A6', 0, 0, 10, 10) + star(5, 5, 2.4, '#fff'),
  US: stripes(13, '#B22234', '#fff') + rect('#3C3B6E', 0, 0, 12, 10.77),
  IE: v3('#169B62', '#fff', '#FF883E'),
  NL: h3('#AE1C28', '#fff', '#21468B'),
  BE: v3('#000', '#FDDA24', '#EF3340'),
  PL: h2('#fff', '#DC143C'),
  RO: v3('#002B7F', '#FCD116', '#CE1126'),
  UA: h2('#0057B7', '#FFD700'),
  GR: stripes(9, '#0D5EAF', '#fff') + rect('#0D5EAF', 0, 0, 11.1, 11.1) + rect('#fff', 4.44, 0, 2.22, 11.1) + rect('#fff', 0, 4.44, 11.1, 2.22),
  NG: v3('#008751', '#fff', '#008751'),
  JP: rect('#fff') + circle(15, 10, 6, '#BC002D'),
  CA: rect('#fff') + rect('#D80621', 0, 0, 7.5, 20) + rect('#D80621', 22.5, 0, 7.5, 20) +
    '<path d="M15 4.5L16.2 7.4L18.4 6.6L17.6 10.4L19.6 9.6L18.8 12L15.4 12.6V15.5H14.6V12.6L11.2 12L10.4 9.6L12.4 10.4L11.6 6.6L13.8 7.4Z" fill="#D80621"/>',
  AU: rect('#012169') + `<g transform="scale(.5)">${GB}</g>` + star(7.5, 15.5, 2, '#fff') + star(22.5, 4.5, 1.1, '#fff') + star(19.5, 10, 1.1, '#fff') + star(25.5, 9, 1.1, '#fff') + star(22.5, 16, 1.1, '#fff'),
  SE: cross('#006AA7', '#FECC00', 9, 3.4, 8.3, 3.4),
  NO: cross('#BA0C2F', '#fff', 8, 5, 7.5, 5) + rect('#00205B', 9.25, 0, 2.5, 20) + rect('#00205B', 0, 8.75, 30, 2.5),
  DK: cross('#C8102E', '#fff', 9, 3, 8.5, 3),
  FI: cross('#fff', '#003580', 8.5, 5, 7.5, 5),
  CH: rect('#DA291C') + rect('#fff', 13.4, 4.5, 3.2, 11) + rect('#fff', 9.5, 8.4, 11, 3.2),
  AT: h3('#ED2939', '#fff', '#ED2939'),
  HU: h3('#CE2939', '#fff', '#477050'),
  CZ: h2('#fff', '#D7141A') + '<polygon points="0,0 15,10 0,20" fill="#11457E"/>',
  SK: h3('#fff', '#0B4EA2', '#EE1C25') + rect('#EE1C25', 7, 4.5, 5.4, 8),
  HR: h3('#FF0000', '#fff', '#171796') + rect('#FF0000', 12.5, 5, 5, 6) + rect('#fff', 12.5, 5, 2.5, 3) + rect('#fff', 15, 8, 2.5, 3),
  RS: h3('#C6363C', '#0C4076', '#fff') + rect('#C6363C', 7, 5, 4.4, 7),
  BG: h3('#fff', '#00966E', '#D62612'),
  LT: h3('#FDB913', '#006A44', '#C1272D'),
  LV: rect('#9E3039') + rect('#fff', 0, 8, 30, 4),
  EE: h3('#0072CE', '#000', '#fff'),
  RU: h3('#fff', '#0039A6', '#D52B1E'),
  TR: rect('#E30A17') + circle(11.5, 10, 5, '#fff') + circle(12.8, 10, 4, '#E30A17') + star(17.6, 10, 2.2, '#fff'),
  MA: rect('#C1272D') + '<polygon points="15,5.4 17.7,13.7 10.6,8.6 19.4,8.6 12.3,13.7" stroke="#006233" stroke-width="0.9" fill="none"/>',
  IN: h3('#FF9933', '#fff', '#138808') + '<circle cx="15" cy="10" r="2.4" stroke="#000080" stroke-width="0.6" fill="none"/>',
  CN: rect('#DE2910') + star(5, 5, 3, '#FFDE00'),
  KR: rect('#fff') + '<path d="M11 10a4 4 0 0 1 8 0z" fill="#CD2E3A"/><path d="M11 10a4 4 0 0 0 8 0z" fill="#0047A0"/>' +
    rect('#000', 4, 3.5, 4, 0.8) + rect('#000', 22, 3.5, 4, 0.8) + rect('#000', 4, 15.7, 4, 0.8) + rect('#000', 22, 15.7, 4, 0.8),
  PH: h2('#0038A8', '#CE1126') + '<polygon points="0,0 17,10 0,20" fill="#fff"/>' + circle(5.5, 10, 2.2, '#FCD116'),
  CR: rect('#002B7F') + rect('#fff', 0, 3.33, 30, 13.34) + rect('#CE1126', 0, 6.67, 30, 6.66),
  HN: h3('#0073CF', '#fff', '#0073CF') + star(15, 10, 1.4, '#0073CF'),
  GT: v3('#4997D0', '#fff', '#4997D0') + circle(15, 10, 2.3, '#6C9B3A'),
  SV: h3('#0047AB', '#fff', '#0047AB') + circle(15, 10, 2.1, '#D4A52A'),
  NI: h3('#0067C6', '#fff', '#0067C6') + '<polygon points="15,7.8 17.4,12 12.6,12" fill="#3E8E41"/>',
  PY: h3('#D52B1E', '#fff', '#0038A8') + '<circle cx="15" cy="10" r="2.2" stroke="#2E7D32" stroke-width="0.6" fill="none"/>',
  PA: rect('#fff') + rect('#DA121A', 15, 0, 15, 10) + rect('#072357', 0, 10, 15, 10) + star(7.5, 5, 2.4, '#072357') + star(22.5, 15, 2.4, '#DA121A'),
  UY: stripes(9, '#fff', '#0038A8') + rect('#fff', 0, 0, 11.1, 11.1) + circle(5.55, 5.55, 2.6, '#FCD116'),
};

/** The generic flag for a valid code with no artwork above: neutral, with its letters. */
export const genericFlagArt = (code: string) =>
  rect('#4B5565') + rect('#5E6A7D', 0, 0, 30, 10) +
  `<text x="15" y="13.6" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="10" font-weight="700" fill="#fff">${code.replace(/[^A-Z]/g, '')}</text>`;

/** True when the code has its own artwork (not the generic flag). */
export const hasFlagArt = (code: string) => Object.prototype.hasOwnProperty.call(FLAG_ART, code);

/** The inner SVG markup for the code (its artwork, or the generic flag), on the 30x20 viewBox. */
export const flagArtMarkup = (code: string): string => (hasFlagArt(code) ? FLAG_ART[code] : genericFlagArt(code));
