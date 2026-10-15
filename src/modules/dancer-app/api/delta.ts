import { SAVE_KEYS, type DancerDelta, type MyDancerEdit, type SaveKey } from './types';

/**
 * The ONE client rule for "what changed": an Edit screen keeps a draft and sends
 * diffDelta(current, draft). Mirrors save_my_dancer_profile_v2's own diff, so an
 * untouched form produces {} (and saveMyDancerProfile sends nothing for {}).
 *
 * Equality: "" and null are the same (both mean empty), strings are compared
 * trimmed, arrays element by element in order -- except the chip SETS below, where
 * order carries no meaning (review S4: toggling a chip off and on is no change).
 * An explicit `undefined` is "absent", not a change (review N2: JSON drops it).
 */
const SET_KEYS: ReadonlySet<SaveKey> = new Set<SaveKey>(['favorite_styles']);

type Value = MyDancerEdit[SaveKey];

const norm = (v: Value | undefined): Value | null => {
  if (v === undefined || v === null) return null;
  if (typeof v === 'string') {
    const t = v.trim();
    return t === '' ? null : t;
  }
  if (Array.isArray(v)) return v.length === 0 ? null : v;
  return v;
};

export const sameValue = (a: Value | undefined, b: Value | undefined): boolean => {
  const x = norm(a);
  const y = norm(b);
  if (Array.isArray(x) && Array.isArray(y)) return x.length === y.length && x.every((item, i) => item === y[i]);
  return x === y;
};

/** Same members, any order (strings compared trimmed). */
const sameSet = (a: readonly string[], b: readonly string[]): boolean => {
  const x = new Set(a.map((s) => s.trim()));
  const y = new Set(b.map((s) => s.trim()));
  return x.size === y.size && [...x].every((s) => y.has(s));
};

export const diffDelta = (current: MyDancerEdit, draft: DancerDelta): DancerDelta => {
  const out: Record<string, unknown> = {};
  for (const key of SAVE_KEYS) {
    if (!(key in draft) || draft[key] === undefined) continue;
    const next = draft[key];
    if (SET_KEYS.has(key) && Array.isArray(next) && sameSet(current[key] as string[], next)) continue;
    if (!sameValue(current[key], next)) out[key] = next;
  }
  return out as DancerDelta;
};

/** Is the delta empty? A Save control is disabled (with a reason) while this is true. */
export const isEmptyDelta = (delta: DancerDelta): boolean => Object.keys(delta).length === 0;
