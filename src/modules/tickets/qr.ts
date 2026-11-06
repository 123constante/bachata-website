import qrcode from 'qrcode-generator';

/**
 * The door QR: the bare 64-hex qr_token (door/model parseCode accepts it as is), error
 * correction M. Imported only by the lazy MyTicketsPage chunk, so the generator never lands
 * on a first load. Returns the module grid; the page draws it as one SVG path.
 */
export function qrModules(token: string): boolean[][] {
  const q = qrcode(0, 'M');
  q.addData(token, 'Byte');
  q.make();
  const n = q.getModuleCount();
  return Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
}

/** One "M x y h1v1h-1z" run per dark module, offset by the 4-module quiet zone. */
export function qrPath(grid: boolean[][], quiet = 4): string {
  let d = '';
  grid.forEach((row, r) => row.forEach((dark, c) => { if (dark) d += `M${c + quiet} ${r + quiet}h1v1h-1z`; }));
  return d;
}
