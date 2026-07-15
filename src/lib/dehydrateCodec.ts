/**
 * Lossless columnar codec for dehydrated React Query payloads (WS14).
 *
 * The homepage loader dehydrates a 90-day map-events array (~383 rows) into the
 * HTML. turbo-stream emits one integer key-ref map per row per field, so an
 * array-of-objects pays ~11 bytes/row of scaffolding for EVERY field, even null
 * ones. Re-encoding a uniform array-of-objects as columns
 * (`{ cols: [...names], rows: [[...values]] }`) drops that scaffolding; the leaf
 * values still dedupe exactly as before. Measured: ~3 KB / ~5% off the brotli
 * document at Vercel's edge (q3), the single biggest self-contained lever on the
 * dehydrated payload.
 *
 * These are wired as GLOBAL React Query transformers (dehydrate.serializeData /
 * hydrate.deserializeData) in `createQueryClient`, so they run on EVERY
 * dehydrated query across every route AND on both the server render and the
 * client hydration. The design is therefore built to be a strict, total,
 * value-preserving inverse pair:
 *   - `pack` only engages on a uniform array of plain objects (>= 2 rows); every
 *     other payload (single objects, nulls, short/heterogeneous/non-plain
 *     arrays) passes through untouched.
 *   - `unpack` only engages on the sentinel-tagged shape `pack` produces; every
 *     other value passes through untouched.
 *   - Neither ever throws: a throw in `pack` would 500 the loader's dehydrate();
 *     a throw in `unpack` would break HydrationBoundary's synchronous useMemo
 *     during SSR. Any unexpected shape falls back to identity.
 * The result is `unpack(pack(x))` deep-equals `x` for all inputs, so the server
 * tree and the hydrated client tree are identical (no React #418/#425), and no
 * consumer that reads the cache ever sees the packed shape.
 *
 * Deliberately NOT dropping "dead" columns (e.g. the always-unread `category`):
 * dropping present-but-unread data is a lossy bet that rots the day someone reads
 * it, and it buys only a few hundred brotli bytes. Purity is worth more here.
 */

const MARKER = '__mapEventsColumnarV1';

interface ColumnarPacked {
  [MARKER]: true;
  cols: string[];
  rows: unknown[][];
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

/**
 * True only for an array of >= 2 plain objects that all share the EXACT same key
 * set. Requiring identical keys keeps the round-trip strictly value-preserving:
 * no row gains or loses a key. Anything else returns false and is left untouched.
 */
function isColumnarCandidate(v: unknown): v is Record<string, unknown>[] {
  if (!Array.isArray(v) || v.length < 2) return false;
  if (!isPlainObject(v[0])) return false;
  const keys = Object.keys(v[0]);
  const keySet = new Set(keys);
  for (let i = 1; i < v.length; i++) {
    const row = v[i];
    if (!isPlainObject(row)) return false;
    const rowKeys = Object.keys(row);
    if (rowKeys.length !== keys.length) return false;
    for (const k of rowKeys) if (!keySet.has(k)) return false;
  }
  return true;
}

function isColumnarPacked(v: unknown): v is ColumnarPacked {
  return (
    isPlainObject(v) &&
    (v as Record<string, unknown>)[MARKER] === true &&
    Array.isArray((v as ColumnarPacked).cols) &&
    Array.isArray((v as ColumnarPacked).rows)
  );
}

/** dehydrate.serializeData: array-of-objects -> columnar. Identity otherwise. Never throws. */
export function pack(data: unknown): unknown {
  try {
    if (!isColumnarCandidate(data)) return data;
    const cols = Object.keys(data[0]);
    const rows = data.map((row) => cols.map((c) => row[c]));
    return { [MARKER]: true, cols, rows } as ColumnarPacked;
  } catch {
    return data;
  }
}

/** hydrate.deserializeData: columnar -> array-of-objects. Identity otherwise. Never throws. */
export function unpack(data: unknown): unknown {
  try {
    if (!isColumnarPacked(data)) return data;
    const { cols, rows } = data;
    return rows.map((values) => {
      const obj: Record<string, unknown> = {};
      for (let i = 0; i < cols.length; i++) obj[cols[i]] = values[i];
      return obj;
    });
  } catch {
    return data;
  }
}
