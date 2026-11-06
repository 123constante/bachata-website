/**
 * Every refusal the LIVE P3 doors can raise (scripts/p3-refusal-codes.json, read
 * from prod pg_get_functiondef) reaches the organiser as its own reason AND
 * says what they can do next. Same copy rule as
 * scripts/check-p3-refusal-reasons.mjs (not the generic fallback, not the
 * /^permission_denied/ catch-all, never "That did not work"), plus the
 * next-step rule the guard does not carry.
 *
 * Two shrink-only ratchets keep main green while the fixes land in their own
 * slices: the JSON's known_gaps (no own copy) and NEXT_STEP_GAPS below (own
 * copy, but no next step). A stale entry in either list is red: delete it.
 * Brief: docs/briefs/p3-real-rules-check.md (branch brief/p3-real-rules-check).
 */
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { COMMAND_COPY, commandErrorMessage, teamErrorMessage } from '../selfServeErrors';

interface Entry { code: string; reason: string | null; mapper: 'command' | 'team'; errcode: string; doors: string[]; sample?: string }
interface Snapshot { codes: Entry[]; known_gaps: Array<{ key: string }> }

const SNAPSHOT: Snapshot = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../../../scripts/p3-refusal-codes.json'), 'utf8'));

// Mirrors keyOf / sampleOf in scripts/check-p3-refusal-reasons.mjs.
const keyOf = (e: Entry) => `${e.mapper}:${e.code}${e.reason ? `: ${e.reason}` : ''}`;
const sampleOf = (e: Entry) => e.sample || (e.mapper === 'team' ? e.code : `${e.code}${e.reason ? `: ${e.reason}` : ''}: X`);
const copyOf = (e: Entry) => {
  const err = { message: sampleOf(e), code: e.errcode.split(',')[0] };
  return e.mapper === 'team' ? teamErrorMessage(err) : commandErrorMessage(err);
};

const GENERIC = commandErrorMessage({ message: '\u0000no-such-code', code: 'P0001' });
const CATCH_ALL = COMMAND_COPY.find((c) => String(c.match) === '/^permission_denied/')?.message;
const BAD_COPY = /That did not work/i;

/**
 * A next step: the sentence tells the organiser something to do, not only what
 * went wrong. An action verb counts where it can only be an imperative: at the
 * start of a sentence, or after ", " / "or " / "then " ("status change is" is a
 * noun and does not count), or a "you can ..." / "they can ...".
 */
const VERBS = 'ask|reload|choose|pick|enter|open|remove|cancel|add|keep|check|sign in|finish|take|tick|say|give|use|put|change|leave|look|make|hand|contact|start|show|try|tap|confirm|set';
export const NEXT_STEP = new RegExp(`(^|[.!?]\\s+|,\\s+|\\bor\\s+|\\bthen\\s+|\\bplease\\s+)(${VERBS})\\b|\\b(you|they) can\\b`, 'i');

/** Shrink-only: live codes with their own copy that still names no next step. */
const NEXT_STEP_GAPS: string[] = [
  'command:past_date', // "This date has already happened, so it can no longer be changed."
  'team:organiser_not_found', // "That page no longer exists."
];

const GAPS = new Set(SNAPSHOT.known_gaps.map((g) => g.key));

describe('live P3 refusal codes reach their own copy', () => {
  it('the snapshot is not empty (a floor, so nothing is silently measured)', () => {
    expect(SNAPSHOT.codes.length).toBeGreaterThan(0);
    expect(typeof CATCH_ALL).toBe('string');
  });

  it.each(SNAPSHOT.codes.filter((e) => !GAPS.has(keyOf(e))).map((e) => [keyOf(e), e] as const))('%s has its own copy', (_k, e) => {
    const copy = copyOf(e);
    expect(copy.trim()).not.toBe('');
    expect(copy).not.toBe(GENERIC);
    expect(copy).not.toBe(CATCH_ALL);
    expect(copy).not.toMatch(BAD_COPY);
  });

  it.each(SNAPSHOT.codes.filter((e) => !GAPS.has(keyOf(e)) && !NEXT_STEP_GAPS.includes(keyOf(e))).map((e) => [keyOf(e), e] as const))('%s says what to do next', (_k, e) => {
    expect(copyOf(e)).toMatch(NEXT_STEP);
  });

  it('known_gaps is shrink-only: every gap still falls to generic copy', () => {
    const stale = SNAPSHOT.codes.filter((e) => GAPS.has(keyOf(e))).filter((e) => {
      const c = copyOf(e);
      return c !== GENERIC && c !== CATCH_ALL && !BAD_COPY.test(c);
    }).map(keyOf);
    expect(stale).toEqual([]);
    const keys = new Set(SNAPSHOT.codes.map(keyOf));
    expect([...GAPS].filter((k) => !keys.has(k))).toEqual([]);
  });

  it('NEXT_STEP_GAPS is shrink-only: every entry is a live code that still names no next step', () => {
    const byKey = new Map(SNAPSHOT.codes.map((e) => [keyOf(e), e]));
    const stale = NEXT_STEP_GAPS.filter((k) => !byKey.has(k) || NEXT_STEP.test(copyOf(byKey.get(k)!)));
    expect(stale).toEqual([]);
  });

  it('the next-step rule tells a dead end from an action', () => {
    expect('That page no longer exists.').not.toMatch(NEXT_STEP);
    expect('That status change is not available for this event right now.').not.toMatch(NEXT_STEP);
    expect('That request no longer exists. Reload the page.').toMatch(NEXT_STEP);
  });
});
