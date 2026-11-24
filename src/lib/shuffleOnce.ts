// Per-page-load shuffle. The seed lives at module level: it survives SPA
// navigation (open a night, press back = same order) and resets on a real page
// load/refresh. Seeded, so a refetch that returns the same nights keeps the order.

const PAGE_LOAD_SEED: number = (() => {
  try {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0];
  } catch {
    return Math.floor(Math.random() * 0xffffffff);
  }
})();

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher-Yates over a key-sorted copy, so input order never biases the result. */
export function shuffleForPageLoad<T>(items: readonly T[], key: (t: T) => string, seed: number = PAGE_LOAD_SEED): T[] {
  const out = [...items].sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0));
  const rand = mulberry32(seed);
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}
