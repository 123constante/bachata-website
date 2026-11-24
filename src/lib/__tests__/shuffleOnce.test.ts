import { describe, it, expect } from 'vitest';
import { shuffleForPageLoad } from '../shuffleOnce';

const ids = Array.from({ length: 20 }, (_, i) => ({ id: `n${String(i).padStart(2, '0')}` }));
const key = (x: { id: string }) => x.id;

describe('shuffleForPageLoad', () => {
  it('keeps every item exactly once', () => {
    const out = shuffleForPageLoad(ids, key, 7);
    expect(out.map(key).sort()).toEqual(ids.map(key));
  });
  it('same seed gives same order whatever the input order', () => {
    const a = shuffleForPageLoad(ids, key, 42).map(key);
    const b = shuffleForPageLoad([...ids].reverse(), key, 42).map(key);
    expect(a).toEqual(b);
  });
  it('different seeds give different orders', () => {
    const orders = new Set([1, 2, 3, 4, 5].map((s) => shuffleForPageLoad(ids, key, s).map(key).join()));
    expect(orders.size).toBeGreaterThan(1);
  });
  it('first slot is roughly uniform', () => {
    const counts: Record<string, number> = {};
    for (let s = 0; s < 4000; s++) { const f = key(shuffleForPageLoad(ids, key, s)[0]); counts[f] = (counts[f] ?? 0) + 1; }
    expect(Object.keys(counts).length).toBe(20);
    for (const c of Object.values(counts)) expect(c).toBeGreaterThan(110); // expect ~200
  });
  it('does not mutate input', () => {
    const copy = [...ids];
    shuffleForPageLoad(ids, key, 3);
    expect(ids).toEqual(copy);
  });
});
