import { describe, it, expect } from 'vitest';
import { shareStateOf, SHARE_REASONS } from '../shareState';
import type { P3Row } from '../home';

const CODE = { pending: false, data: { code: 'abc', disabled: false } } as never;
const LIVE_ROW = { id: 'e1' } as unknown as P3Row;

// Draft-only and none both reach shareStateOf as "no live event" (live = null).
const SHAPES: Array<[string, P3Row | null, 'ready' | 'noEvent']> = [
  ['draft-only (events exist, none live)', null, 'noEvent'],
  ['none (no events)', null, 'noEvent'],
  ['live', LIVE_ROW, 'ready'],
];

describe('share empty-state copy', () => {
  it.each(SHAPES)('%s', (_n, live, state) => {
    const s = shareStateOf(CODE, live);
    expect(s).toBe(state);
    if (s === 'ready') return; // Copy enabled, no empty copy
    const text = SHARE_REASONS[s];
    expect(text).not.toMatch(/add an event/i); // the person may already have drafts
    expect(text).toMatch(/put an event live/i); // says what the person can do
  });
});
