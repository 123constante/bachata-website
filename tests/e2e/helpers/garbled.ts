// The one garbled-text check every walk spec uses on a page's visible text: cp1252 mojibake, a replacement character, or an
// HTML entity that leaked through unrendered. \u escapes ONLY in this file: literal mojibake would fail scripts/check-mojibake.mjs.
// String.match with /g is stateless (no lastIndex), so one shared regex is safe.
export const GARBLED_RE = /\u00c3.|\u00e2\u20ac.|&(mdash|hellip|rsquo|amp|nbsp|lsquo|ldquo|rdquo);|\ufffd/g;

/** Every garbled fragment in `text`; an empty array means clean. */
export const findGarbled = (text: string): string[] => text.match(GARBLED_RE) ?? [];
