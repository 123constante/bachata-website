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

const BASE_ART: Record<string, string> = {
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

// ---- Added 2026-11-05: every other code the nationality picker (world-countries) can offer. ----
const poly = (pts: string, fill: string) => `<polygon points="${pts}" fill="${fill}"/>`;
const line = (d: string, stroke: string, w: number) => `<path d="${d}" stroke="${stroke}" stroke-width="${w}" fill="none"/>`;
const hn = (colors: string[]) => colors.map((c, i) => rect(c, 0, (i * 20) / colors.length, 30, 20 / colors.length + 0.05)).join('');
const smallCross = (cx: number, cy: number, fill: string) => rect(fill, cx - 0.6, cy - 2, 1.2, 4) + rect(fill, cx - 2, cy - 0.6, 4, 1.2);
const canton = (field: string) => rect(field) + `<g transform="scale(.5)">${GB}</g>`;
const ensign = (field: string, emblem: string) => canton(field) + circle(22.5, 10, 3.4, '#fff') + circle(22.5, 10, 2.4, emblem);
const frCanton = (field: string) => rect(field) + `<g transform="scale(.5)">${v3('#002654', '#fff', '#CE1126')}</g>`;
const crescent = (cx: number, cy: number, r: number, fill: string, bg: string) => circle(cx, cy, r, fill) + circle(cx + r * 0.3, cy, r * 0.8, bg);
const stars = (pts: Array<[number, number]>, r: number, fill: string) => pts.map(([x, y]) => star(x, y, r, fill)).join('');
const zig = (x: number) => {
  const p: string[] = [`${x},0`];
  for (let i = 0; i < 9; i++) p.push(`${x + 3},${i * 2.22 + 1.11}`, `${x},${(i + 1) * 2.22}`);
  return poly(p.join(' ') + ` ${x},20 0,20 0,0`, '#fff');
};

const NEW_ART: Record<string, string> = {
  GE: rect('#fff') + rect('#FF0000', 12.5, 0, 5, 20) + rect('#FF0000', 0, 7.5, 30, 5) + smallCross(6.25, 3.75, '#FF0000') + smallCross(23.75, 3.75, '#FF0000') + smallCross(6.25, 16.25, '#FF0000') + smallCross(23.75, 16.25, '#FF0000'),
  // Europe
  AL: rect('#E41E20') + circle(15, 10, 4.2, '#000'),
  AD: v3('#10069F', '#FEDD00', '#D50032'),
  BA: rect('#002F6C') + poly('7.5,0 22.5,0 22.5,20', '#FECB00') + stars([[5, 2], [8, 6], [11, 10], [14, 14], [17, 18]], 1.1, '#fff'),
  BY: rect('#C8313E') + rect('#4AA657', 0, 13.33, 30, 6.67) + rect('#fff', 0, 0, 3, 20),
  FO: rect('#fff') + rect('#0065BD', 8, 0, 6, 20) + rect('#0065BD', 0, 7, 30, 6) + rect('#ED2939', 9.3, 0, 3.4, 20) + rect('#ED2939', 0, 8.3, 30, 3.4),
  AX: cross('#0053A5', '#FFD800', 8, 5, 7.5, 5) + rect('#D72828', 9.5, 0, 2, 20) + rect('#D72828', 0, 8.75, 30, 2.5),
  GG: cross('#fff', '#E8112D', 12.5, 5, 7.5, 5) + rect('#F9DD16', 13.5, 0, 3, 20) + rect('#F9DD16', 0, 8.5, 30, 3) + rect('#E8112D', 14, 0, 2, 20) + rect('#E8112D', 0, 9, 30, 2),
  JE: rect('#fff') + line('M0 0L30 20M30 0L0 20', '#DF112D', 3),
  IM: rect('#CF142B') + circle(15, 10, 2.4, '#fff') + circle(15, 10, 1.2, '#CF142B'),
  GI: rect('#fff') + rect('#DA000C', 0, 13.3, 30, 6.7) + rect('#DA000C', 12, 5.5, 6, 7.8),
  IS: cross('#02529C', '#fff', 8, 5, 7.5, 5) + rect('#DC1E35', 9.5, 0, 2, 20) + rect('#DC1E35', 0, 8.75, 30, 2.5),
  LI: h2('#002B7F', '#CE1126') + circle(7, 5, 2.2, '#FFD83D'),
  LU: h3('#EA141D', '#fff', '#00A1DE'),
  MC: h2('#CE1126', '#fff'),
  MD: v3('#0046AE', '#FFD200', '#CC092F') + rect('#B6842A', 13.5, 8, 3, 4),
  ME: rect('#C8A04B') + rect('#C40308', 1, 1, 28, 18) + circle(15, 10, 3.2, '#C8A04B'),
  MK: rect('#D20000') + line('M15 10L0 0M15 10L30 0M15 10L0 20M15 10L30 20M15 10L15 0M15 10L15 20M15 10L0 10M15 10L30 10', '#F8E92E', 1.8) + circle(15, 10, 3.4, '#F8E92E'),
  MT: rect('#fff') + rect('#CF142B', 15, 0, 15, 20) + rect('#A3A3A3', 2.4, 2, 1.2, 4) + rect('#A3A3A3', 1, 3.4, 4, 1.2),
  SI: h3('#fff', '#005DA4', '#ED1C24') + '<polygon points="5,3 11,3 11,9 8,11.5 5,9" fill="#005DA4" stroke="#fff" stroke-width="0.5"/>',
  SM: h2('#fff', '#5EB6E4') + circle(15, 10, 2, '#C9A227'),
  VA: rect('#FFE000', 0, 0, 15, 20) + rect('#fff', 15, 0, 15, 20) + rect('#C8A24A', 21, 6.5, 1.3, 7) + rect('#B0B0B0', 23.2, 6.5, 1.3, 7),
  // Caucasus and Central Asia
  AM: h3('#D90012', '#0033A0', '#F2A800'),
  AZ: h3('#00B5E2', '#EF3340', '#509E2F') + crescent(13.8, 10, 2.6, '#fff', '#EF3340') + star(17.8, 10, 1.2, '#fff'),
  KZ: rect('#00AFCA') + circle(15, 8.5, 3.6, '#FEC50C') + rect('#FEC50C', 5, 14.5, 20, 1.2),
  KG: rect('#D01C1F') + circle(15, 10, 5.6, '#F8C300') + circle(15, 10, 3.2, '#D01C1F'),
  TJ: rect('#CC0000', 0, 0, 30, 5.7) + rect('#fff', 0, 5.7, 30, 8.6) + rect('#006600', 0, 14.3, 30, 5.7) + rect('#F8C300', 12.5, 8.4, 5, 2.4),
  TM: rect('#00843D') + rect('#D22630', 3, 0, 5, 20) + crescent(15, 5, 2.6, '#fff', '#00843D'),
  UZ: rect('#0099B5', 0, 0, 30, 6.5) + rect('#CE1126', 0, 6.5, 30, 0.6) + rect('#fff', 0, 7.1, 30, 5.8) + rect('#CE1126', 0, 12.9, 30, 0.6) + rect('#1EB53A', 0, 13.5, 30, 6.5) + crescent(5, 3.3, 2, '#fff', '#0099B5'),
  // Middle East and South Asia
  AF: v3('#000', '#D32011', '#007A36') + circle(15, 10, 3.4, '#fff'),
  AE: rect('#00732F', 0, 0, 30, 6.67) + rect('#fff', 0, 6.66, 30, 6.68) + rect('#000', 0, 13.33, 30, 6.67) + rect('#FF0000', 0, 0, 7.5, 20),
  BH: rect('#CE1126') + rect('#fff', 0, 0, 8, 20),
  IR: h3('#239F40', '#fff', '#DA0000') + circle(15, 10, 2, '#DA0000'),
  IQ: h3('#CE1126', '#fff', '#000') + rect('#007A3D', 10, 8.7, 10, 2.6),
  IL: rect('#fff') + rect('#0038B8', 0, 2.5, 30, 2.5) + rect('#0038B8', 0, 15, 30, 2.5) + '<polygon points="15,6.4 18,11.6 12,11.6" stroke="#0038B8" stroke-width="0.6" fill="none"/><polygon points="15,13.6 18,8.4 12,8.4" stroke="#0038B8" stroke-width="0.6" fill="none"/>',
  JO: h3('#000', '#fff', '#007A3D') + poly('0,0 15,10 0,20', '#CE1126'),
  KW: h3('#007A3D', '#fff', '#CE1126') + poly('0,0 7.5,6.67 7.5,13.33 0,20', '#000'),
  LB: rect('#ED1C24') + rect('#fff', 0, 5, 30, 10) + poly('15,5.6 18.6,12.4 11.4,12.4', '#00A651') + rect('#7A5C2E', 14.5, 12.4, 1, 2),
  OM: h3('#fff', '#DB161B', '#008000') + rect('#DB161B', 0, 0, 8, 20),
  PS: h3('#000', '#fff', '#007A3D') + poly('0,0 12,10 0,20', '#CE1126'),
  QA: rect('#8A1538') + zig(9),
  SA: rect('#006C35') + rect('#fff', 7, 6, 16, 2) + rect('#fff', 8, 12.5, 14, 1),
  SY: h3('#CE1126', '#fff', '#000') + star(10.5, 10, 1.8, '#007A3D') + star(19.5, 10, 1.8, '#007A3D'),
  YE: h3('#CE1126', '#fff', '#000'),
  PK: rect('#01411C') + rect('#fff', 0, 0, 7.5, 20) + crescent(18, 10, 5.4, '#fff', '#01411C') + star(22.5, 7.5, 1.9, '#fff'),
  BD: rect('#006A4E') + circle(13.5, 10, 6, '#F42A41'),
  LK: rect('#FFBE29') + rect('#00534E', 1.5, 1.5, 3.5, 17) + rect('#EB7400', 5, 1.5, 3.5, 17) + rect('#8D153A', 9, 1.5, 19.5, 17) + '<ellipse cx="18.5" cy="10" rx="4.5" ry="5" fill="#FFBE29"/>',
  NP: rect('#fff') + poly('6,0.5 6,19.5 24,19.5 13.5,10.2 24,10.2', '#003893') + poly('7.4,3 7.4,18 20,18 11,9.2 19.6,9.2', '#DC143C') + circle(10.5, 5.5, 1.1, '#fff') + circle(10.5, 14, 1.6, '#fff'),
  BT: poly('0,0 30,0 0,20', '#FFD520') + poly('30,0 30,20 0,20', '#FF4E12') + '<ellipse cx="15" cy="10" rx="4" ry="2" fill="#fff" transform="rotate(-34 15 10)"/>',
  MV: rect('#D21034') + rect('#007E3A', 4, 4, 22, 12) + crescent(15, 10, 4, '#fff', '#007E3A'),
  // South-east and east Asia
  ID: h2('#CE1126', '#fff'),
  TH: rect('#A51931') + rect('#fff', 0, 3.33, 30, 13.34) + rect('#2D2A4A', 0, 6.67, 30, 6.66),
  VN: rect('#DA251D') + star(15, 10.5, 6, '#FFFF00'),
  KH: rect('#032EA1') + rect('#E00025', 0, 5, 30, 10) + rect('#fff', 11, 7.5, 8, 5),
  LA: rect('#CE1126') + rect('#002868', 0, 5, 30, 10) + circle(15, 10, 4.2, '#fff'),
  MM: h3('#FECB00', '#34B233', '#EA2839') + star(15, 10.5, 6, '#fff'),
  MY: stripes(14, '#CC0001', '#fff') + rect('#010066', 0, 0, 15, 10.72) + crescent(6, 5.3, 3.5, '#FC0', '#010066') + star(10.5, 5.3, 1.9, '#FC0'),
  SG: h2('#EF3340', '#fff') + crescent(6.5, 5, 3.4, '#fff', '#EF3340') + stars([[10.5, 3], [8, 5.2], [13, 5.2], [9, 8], [12, 8]], 0.7, '#fff'),
  BN: rect('#F7E017') + line('M0 3L30 13', '#fff', 3.6) + line('M0 6.5L30 16.5', '#000', 2.4) + circle(15, 10, 3.4, '#CF1126'),
  MN: v3('#C4272F', '#015197', '#C4272F') + circle(5, 6.5, 1.3, '#F9CF02') + rect('#F9CF02', 4.2, 8.5, 1.6, 6),
  KP: rect('#024FA2') + rect('#fff', 0, 3.5, 30, 13) + rect('#ED1C27', 0, 4.5, 30, 11) + circle(10, 10, 4.2, '#fff') + star(10, 10, 3.2, '#ED1C27'),
  TW: rect('#FE0000') + rect('#000095', 0, 0, 15, 10) + circle(7.5, 5, 3.4, '#fff') + circle(7.5, 5, 2.4, '#000095') + circle(7.5, 5, 1.8, '#fff'),
  HK: rect('#DE2910') + star(15, 10, 5.2, '#fff'),
  MO: rect('#00785E') + '<ellipse cx="15" cy="12.5" rx="5" ry="1.6" fill="#fff"/>' + circle(15, 9.6, 1.8, '#fff') + star(15, 4.2, 1.2, '#FBD116'),
  TL: rect('#DC241F') + poly('0,0 17,10 0,20', '#FFC726') + poly('0,0 9,10 0,20', '#000') + star(3.2, 10, 1.8, '#fff'),
  // Africa
  AO: h2('#CC092F', '#000') + circle(15, 10, 3.2, '#F9D800'),
  BJ: rect('#008751', 0, 0, 12, 20) + rect('#FCD116', 12, 0, 18, 10) + rect('#E8112D', 12, 10, 18, 10),
  BF: h2('#EF2B2D', '#009E49') + star(15, 10, 3.4, '#FCD116'),
  BI: rect('#fff') + poly('0,0 30,0 15,10', '#CE1126') + poly('0,20 30,20 15,10', '#CE1126') + poly('0,0 15,10 0,20', '#1EB53A') + poly('30,0 15,10 30,20', '#1EB53A') + line('M0 0L30 20M30 0L0 20', '#fff', 1.8) + circle(15, 10, 4.6, '#fff'),
  BW: rect('#75AADB') + rect('#fff', 0, 7.2, 30, 5.6) + rect('#000', 0, 8.4, 30, 3.2),
  CF: hn(['#003082', '#fff', '#289728', '#FFCE00']) + rect('#D21034', 12.5, 0, 5, 20) + star(5, 3, 2.2, '#FFCE00'),
  CI: v3('#F77F00', '#fff', '#009E60'),
  CM: v3('#007A5E', '#CE1126', '#FCD116') + star(15, 10, 3, '#FCD116'),
  CD: rect('#007FFF') + line('M-2 22L32 -2', '#F7D618', 5.4) + line('M-2 22L32 -2', '#CE1021', 3.4) + star(5, 4.5, 2.6, '#F7D618'),
  CG: rect('#FBDE4A') + poly('0,0 20,0 0,13.33', '#009543') + poly('30,6.67 30,20 10,20', '#DC241F'),
  CV: rect('#003893') + rect('#fff', 0, 11, 30, 3.4) + rect('#CF2027', 0, 12, 30, 1.4) + '<circle cx="11" cy="12.7" r="5.4" stroke="#F7D116" stroke-width="0.9" stroke-dasharray="1 1" fill="none"/>',
  KM: hn(['#FFC61E', '#fff', '#CE1126', '#3A75C4']) + poly('0,0 14,10 0,20', '#3D8E33') + crescent(4.6, 10, 3, '#fff', '#3D8E33'),
  DJ: rect('#6AB2E7', 0, 0, 30, 10) + rect('#12AD2B', 0, 10, 30, 10) + poly('0,0 17,10 0,20', '#fff') + star(4.6, 10, 2.4, '#D7141A'),
  DZ: rect('#fff') + rect('#006233', 0, 0, 15, 20) + crescent(14.5, 10, 5, '#D21034', '#006233') + star(17.4, 10, 2.2, '#D21034'),
  EG: h3('#CE1126', '#fff', '#000') + rect('#C09300', 13.5, 8, 3, 4),
  ER: poly('0,0 30,0 30,10', '#12AD2B') + poly('0,20 30,10 30,20', '#4189DD') + poly('0,0 30,10 0,20', '#EA0437'),
  EH: h3('#000', '#fff', '#007A3D') + poly('0,0 10,10 0,20', '#CE1126') + crescent(18, 10, 2.8, '#CE1126', '#fff') + star(19.6, 10, 1.1, '#CE1126'),
  ET: h3('#078930', '#FCDD09', '#DA121A') + circle(15, 10, 4, '#0F47AF') + star(15, 10, 2.8, '#FCDD09'),
  GA: h3('#009E60', '#FCD116', '#3A75C4'),
  GM: rect('#CE1126', 0, 0, 30, 6) + rect('#fff', 0, 6, 30, 1) + rect('#0C1C8C', 0, 7, 30, 6) + rect('#fff', 0, 13, 30, 1) + rect('#3A7728', 0, 14, 30, 6),
  GH: h3('#CE1126', '#FCD116', '#006B3F') + star(15, 10, 3.2, '#000'),
  GN: v3('#CE1126', '#FCD116', '#009460'),
  GW: rect('#CE1126', 0, 0, 10, 20) + rect('#FCD116', 10, 0, 20, 10) + rect('#009E49', 10, 10, 20, 10) + star(5, 10, 3, '#000'),
  GQ: h3('#3E9A00', '#fff', '#E32118') + poly('0,0 8,10 0,20', '#0073CE'),
  KE: rect('#000', 0, 0, 30, 5.5) + rect('#fff', 0, 5.5, 30, 1) + rect('#BB0000', 0, 6.5, 30, 7) + rect('#fff', 0, 13.5, 30, 1) + rect('#006600', 0, 14.5, 30, 5.5) + '<ellipse cx="15" cy="10" rx="2.6" ry="4.6" fill="#BB0000" stroke="#fff" stroke-width="0.5"/>',
  LR: stripes(11, '#BF0A30', '#fff') + rect('#002868', 0, 0, 10.9, 10.9) + star(5.45, 5.45, 2.7, '#fff'),
  LS: h3('#00209F', '#fff', '#009543') + poly('15,7 17.5,13 12.5,13', '#000'),
  LY: rect('#E70013', 0, 0, 30, 5) + rect('#000', 0, 5, 30, 10) + rect('#239E46', 0, 15, 30, 5) + crescent(14.5, 10, 2.8, '#fff', '#000') + star(18, 10, 1.1, '#fff'),
  MG: rect('#fff', 0, 0, 10, 20) + rect('#FC3D32', 10, 0, 20, 10) + rect('#007E3A', 10, 10, 20, 10),
  ML: v3('#14B53A', '#FCD116', '#CE1126'),
  MR: rect('#006233') + rect('#D01C1F', 0, 0, 30, 2.5) + rect('#D01C1F', 0, 17.5, 30, 2.5) + circle(15, 9.6, 5, '#FFC400') + circle(15, 7.8, 4.8, '#006233') + star(15, 6.2, 1.5, '#FFC400'),
  MU: hn(['#EA2839', '#1A206D', '#FFD500', '#00A551']),
  MW: h3('#000', '#CE1126', '#339E35') + circle(15, 6.6, 3.2, '#CE1126'),
  MZ: h3('#007168', '#000', '#FCE100') + rect('#fff', 0, 6.2, 30, 0.9) + rect('#fff', 0, 12.9, 30, 0.9) + poly('0,0 12,10 0,20', '#D21034') + star(4.6, 10, 2.5, '#FCE100'),
  NA: poly('0,0 30,0 0,20', '#003580') + poly('30,0 30,20 0,20', '#009543') + line('M0 20L30 0', '#fff', 6.4) + line('M0 20L30 0', '#C8102E', 4.2) + circle(5, 5, 2.6, '#FFCE00'),
  NE: h3('#E05206', '#fff', '#0DB02B') + circle(15, 10, 2.4, '#E05206'),
  RW: rect('#00A1DE', 0, 0, 30, 10) + rect('#FAD201', 0, 10, 30, 5) + rect('#20603D', 0, 15, 30, 5) + circle(24, 5, 2.5, '#FAD201'),
  SD: h3('#D21034', '#fff', '#000') + poly('0,0 10,10 0,20', '#007229'),
  SN: v3('#00853F', '#FDEF42', '#E31B23') + star(15, 10, 2.8, '#00853F'),
  SO: rect('#4189DD') + star(15, 10.5, 5.2, '#fff'),
  SS: rect('#000', 0, 0, 30, 6.1) + rect('#fff', 0, 6.1, 30, 0.9) + rect('#DA121A', 0, 7, 30, 6) + rect('#fff', 0, 13, 30, 0.9) + rect('#078930', 0, 13.9, 30, 6.1) + poly('0,0 12,10 0,20', '#0F47AF') + star(4.4, 10, 2.4, '#FCDD09'),
  SC: poly('0,20 0,0 10,0', '#003F87') + poly('0,20 10,0 22,0', '#FCD856') + poly('0,20 22,0 30,0 30,6.7', '#D62828') + poly('0,20 30,6.7 30,13.3', '#fff') + poly('0,20 30,13.3 30,20', '#007A3D'),
  SL: h3('#1EB53A', '#fff', '#0072C6'),
  SZ: rect('#3E5EB9') + rect('#FFD900', 0, 4.5, 30, 11) + rect('#B10C0C', 0, 6, 30, 8) + '<ellipse cx="15" cy="10" rx="6" ry="2.6" fill="#000"/><ellipse cx="15" cy="10" rx="3.2" ry="2.6" fill="#fff"/>',
  ST: rect('#12AD2B') + rect('#FFCE00', 0, 5, 30, 10) + poly('0,0 11,10 0,20', '#D21034') + star(18, 10, 2.2, '#000') + star(25, 10, 2.2, '#000'),
  TD: v3('#002664', '#FECB00', '#C60C30'),
  TG: stripes(5, '#006A4E', '#FFCE00') + rect('#D21034', 0, 0, 12, 10.8) + star(6, 5.4, 3.4, '#fff'),
  TN: rect('#E70013') + circle(15, 10, 6, '#fff') + circle(15, 10, 4.6, '#E70013') + circle(16.2, 10, 3.7, '#fff') + star(16.6, 10, 2.2, '#E70013'),
  TZ: poly('0,0 30,0 0,20', '#1EB53A') + poly('30,0 30,20 0,20', '#00A3DD') + line('M0 20L30 0', '#FCD116', 6.4) + line('M0 20L30 0', '#000', 4.4),
  UG: hn(['#000', '#FCDC04', '#D90000', '#000', '#FCDC04', '#D90000']) + circle(15, 10, 3.8, '#fff'),
  ZM: rect('#198A00') + rect('#DE2010', 18, 10, 3.3, 10) + rect('#000', 21.3, 10, 3.3, 10) + rect('#EF7D00', 24.6, 10, 5.4, 10) + circle(24, 5, 1.9, '#EF7D00'),
  ZW: hn(['#006400', '#FFD200', '#D40000', '#000', '#D40000', '#FFD200', '#006400']) + poly('0,0 11,10 0,20', '#fff') + star(4.8, 10, 2.8, '#D40000'),
  // Caribbean and Americas
  AG: rect('#CE1126') + poly('0,0 30,0 15,20', '#fff') + poly('3,0 27,0 15,16', '#0072C6') + poly('6,0 24,0 15,12', '#000') + '<path d="M9.4 6.5A5.6 5.6 0 0 1 20.6 6.5z" fill="#FCD116"/>',
  BS: h3('#00778B', '#FFC72C', '#00778B') + poly('0,0 12,10 0,20', '#000'),
  BZ: rect('#003F87') + rect('#CE1126', 0, 0, 30, 3) + rect('#CE1126', 0, 17, 30, 3) + circle(15, 10, 6, '#fff'),
  BB: v3('#00267F', '#FFC72C', '#00267F') + rect('#000', 14.4, 5, 1.2, 8) + rect('#000', 12.8, 5, 4.4, 1.2),
  DM: rect('#006B3F') + rect('#FCD116', 12.5, 0, 5, 20) + rect('#FCD116', 0, 7.5, 30, 5) + circle(15, 10, 4.6, '#D41C30'),
  GD: rect('#CE1126') + poly('3,3 27,3 15,10', '#FCD116') + poly('3,17 27,17 15,10', '#FCD116') + poly('3,3 15,10 3,17', '#007A5E') + poly('27,3 15,10 27,17', '#007A5E') + circle(15, 10, 2.6, '#CE1126') + star(15, 10, 1.7, '#FCD116'),
  GY: rect('#009E49') + poly('0,0 30,10 0,20', '#fff') + poly('0,1.6 27,10 0,18.4', '#FCD116') + poly('0,0 15,10 0,20', '#000') + poly('0,1.7 12.8,10 0,18.3', '#CE1126'),
  HT: h2('#00209F', '#D21034') + rect('#fff', 10, 7, 10, 6),
  JM: poly('0,0 30,0 15,10', '#009B3A') + poly('0,20 30,20 15,10', '#009B3A') + poly('0,0 15,10 0,20', '#000') + poly('30,0 15,10 30,20', '#000') + line('M0 0L30 20M30 0L0 20', '#FED100', 2.6),
  KN: poly('0,0 30,0 0,20', '#009E49') + poly('30,0 30,20 0,20', '#CE1126') + line('M0 20L30 0', '#FCD116', 6.4) + line('M0 20L30 0', '#000', 4.4),
  LC: rect('#66CCFF') + poly('15,3 22.5,16.5 7.5,16.5', '#fff') + poly('15,5 20.5,15.5 9.5,15.5', '#000') + poly('15,10 22.5,16.5 7.5,16.5', '#FCD116'),
  TT: rect('#CE1126') + line('M0 -1L30 21', '#fff', 7) + line('M0 -1L30 21', '#000', 4.6),
  VC: v3('#0072C6', '#FCD116', '#009E60') + poly('15,4 17,6.5 15,9 13,6.5', '#009E60') + poly('12.4,9.5 14.4,12 12.4,14.5 10.4,12', '#009E60') + poly('17.6,9.5 19.6,12 17.6,14.5 15.6,12', '#009E60'),
  CW: rect('#002B7F') + rect('#F9E814', 0, 13, 30, 2.6) + star(5, 4, 1.8, '#fff') + star(9.5, 7.5, 2.4, '#fff'),
  AW: rect('#418FDE') + rect('#FBE122', 0, 12.5, 30, 1.6) + rect('#FBE122', 0, 15.5, 30, 1.6) + star(5, 5, 3, '#fff') + star(5, 5, 2.1, '#EF3340'),
  SX: h2('#C8102E', '#002868') + poly('0,0 15,10 0,20', '#fff'),
  BM: ensign('#C8102E', '#00843D'),
  // Oceania and island territories
  FJ: canton('#68BFE5') + rect('#fff', 20, 5, 6, 8) + rect('#CE1126', 20, 5, 6, 2.5),
  FK: ensign('#012169', '#4A8A3C'),
  KY: ensign('#012169', '#CE1126'),
  MS: ensign('#012169', '#00843D'),
  PN: ensign('#012169', '#4A8A3C'),
  SH: ensign('#012169', '#0072C6'),
  TC: ensign('#012169', '#FCD116'),
  VG: ensign('#012169', '#00843D'),
  AI: ensign('#012169', '#00A3DD'),
  GS: ensign('#012169', '#6A9BD0'),
  IO: ensign('#012169', '#fff'),
  NZ: canton('#00247D') + stars([[22, 16], [17.5, 10], [26.5, 10], [22, 5]], 1.5, '#CC142B'),
  TV: canton('#00A1DE') + stars([[20, 6], [25, 9], [22, 14], [26, 16], [18, 12]], 1.2, '#FFD100'),
  CK: canton('#00247D') + stars([[22, 10], [18, 6.5], [26, 6.5], [18, 13.5], [26, 13.5]], 1.3, '#fff'),
  NU: canton('#FEDD00') + circle(22.5, 10, 3.2, '#012169') + star(22.5, 10, 2, '#FEDD00'),
  TK: rect('#00247D') + poly('4,14 26,14 22,17 8,17', '#FFD100') + stars([[10, 6], [15, 4], [20, 6], [24, 9]], 1.2, '#fff'),
  NF: v3('#00A650', '#fff', '#00A650') + poly('15,4 18.5,13 11.5,13', '#00A650') + rect('#00A650', 14.4, 13, 1.2, 2.5),
  NR: rect('#002B7F') + rect('#FFC61E', 0, 9, 30, 2) + star(7.5, 14.5, 2.6, '#fff'),
  KI: rect('#CE1126') + rect('#003F87', 0, 10, 30, 10) + rect('#fff', 0, 12.4, 30, 1.2) + rect('#fff', 0, 15.2, 30, 1.2) + rect('#fff', 0, 18, 30, 1.2) + '<path d="M9.5 10a5.5 5.5 0 0 1 11 0z" fill="#FCD116"/>',
  MH: rect('#003893') + line('M0 20L30 3', '#FF8200', 2.6) + line('M0 20L30 0', '#fff', 2.6) + star(6, 6, 3.4, '#fff'),
  FM: rect('#75B2DD') + stars([[15, 4], [15, 16], [9, 10], [21, 10]], 2.2, '#fff'),
  PW: rect('#4AADD2') + circle(13, 10, 6, '#FFDE00'),
  PG: poly('0,0 30,0 30,20', '#CE1126') + poly('0,0 30,20 0,20', '#000') + circle(22, 5, 2.6, '#FCD116') + stars([[6, 9], [4, 14], [8, 14], [6, 17.5]], 1, '#fff'),
  SB: poly('0,0 30,0 0,20', '#0051BA') + poly('30,0 30,20 0,20', '#215B33') + line('M0 20L30 0', '#FCD116', 2.4) + stars([[4, 3.5], [8, 3.5], [6, 6.5], [4, 9], [8, 9]], 1.1, '#fff'),
  TO: rect('#C10000') + rect('#fff', 0, 0, 12.5, 10.5) + rect('#C10000', 5.2, 2, 2.1, 6.5) + rect('#C10000', 3, 4.2, 6.5, 2.1),
  VU: rect('#D21034', 0, 0, 30, 10) + rect('#009543', 0, 10, 30, 10) + line('M0 1.5L12 10L30 10M0 18.5L12 10', '#FDCE12', 4.6) + poly('0,0 9,10 0,20', '#000'),
  WS: rect('#CE1126') + rect('#002B7F', 0, 0, 15, 10.8) + stars([[7.5, 5.4], [4, 2.6], [11, 2.6], [4, 8.2], [11, 8.2]], 1.1, '#fff'),
  AS: rect('#002868') + poly('30,0 30,20 0,10', '#CE1126') + poly('30,2 30,18 4,10', '#fff') + '<ellipse cx="22" cy="10" rx="4" ry="2.4" fill="#A97C50"/>',
  GU: rect('#00297B') + '<rect x="0.6" y="0.6" width="28.8" height="18.8" fill="none" stroke="#C62A2A" stroke-width="1.2"/><ellipse cx="15" cy="10" rx="3.6" ry="5" fill="#B8D8EE" stroke="#C62A2A" stroke-width="0.6"/>',
  MP: rect('#0071BC') + circle(15, 10, 5.6, '#7FB8E0') + star(15, 10, 4.2, '#fff'),
  VI: rect('#fff') + '<ellipse cx="15" cy="10" rx="3.2" ry="6" fill="#F2C94C"/>' + rect('#0F4DA2', 5, 8, 3, 4) + rect('#0F4DA2', 22, 8, 3, 4),
  PF: rect('#CE1126') + rect('#fff', 0, 5, 30, 10) + circle(15, 10, 3.6, '#F4A300') + rect('#0072BC', 11.5, 10, 7, 2.2),
  NC: h3('#0035AD', '#ED4135', '#00912D') + circle(11.5, 10, 4.6, '#FAE600'),
  WF: frCanton('#CE1126'),
  TF: frCanton('#002654') + stars([[18, 6], [22, 10], [18, 14], [24, 14], [26, 5]], 1, '#fff'),
  GL: rect('#fff') + rect('#D00C33', 0, 10, 30, 10) + '<path d="M6 10a5 5 0 0 1 10 0z" fill="#D00C33"/><path d="M6 10a5 5 0 0 0 10 0z" fill="#fff"/>',
  SR: rect('#B40A2D') + rect('#377E3F', 0, 0, 30, 4) + rect('#fff', 0, 4, 30, 2) + rect('#fff', 0, 14, 30, 2) + rect('#377E3F', 0, 16, 30, 4) + star(15, 10, 4, '#ECC81D'),
  AQ: rect('#1F5FA8') + poly('5,12 10,7 13,9 17,4 24,7 26,12 20,16 13,15', '#fff'),
};

/** Dependencies and territories with no distinct flag in common use show their sovereign's artwork. */
const ALIAS_OF: Readonly<Record<string, string>> = {
  BL: 'FR', MF: 'FR', GP: 'FR', MQ: 'FR', GF: 'FR', RE: 'FR', YT: 'FR', PM: 'FR',
  BQ: 'NL', BV: 'NO', SJ: 'NO', HM: 'AU', CX: 'AU', CC: 'AU', UM: 'US',
};

const MERGED_ART: Record<string, string> = { ...BASE_ART, ...NEW_ART };
for (const [code, parent] of Object.entries(ALIAS_OF)) MERGED_ART[code] = MERGED_ART[parent];

/** Inner SVG markup per code, on a 30x20 viewBox. */
export const FLAG_ART: Readonly<Record<string, string>> = MERGED_ART;

/** The generic flag for a valid code with no artwork above: neutral, with its letters. */
export const genericFlagArt = (code: string) =>
  rect('#4B5565') + rect('#5E6A7D', 0, 0, 30, 10) +
  `<text x="15" y="13.6" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="10" font-weight="700" fill="#fff">${code.replace(/[^A-Z]/g, '')}</text>`;

/** True when the code has its own artwork (not the generic flag). */
export const hasFlagArt = (code: string) => Object.prototype.hasOwnProperty.call(FLAG_ART, code);

/** The inner SVG markup for the code (its artwork, or the generic flag), on the 30x20 viewBox. */
export const flagArtMarkup = (code: string): string =>
  hasFlagArt(code) ? FLAG_ART[code] : code.startsWith('GB-') ? FLAG_ART.GB : genericFlagArt(code);
