// @vitest-environment node
/**
 * Arc W21 -- the document head description is BOUNDED.
 *
 * The defect: /event/:slug shipped the STORED description into the head raw.
 * That copy is written to sell the run, not to summarise it, and one live event
 * measured 5,536 characters. app/routes/event.tsx and app/routes/festival.tsx
 * now clip at the input with truncate(..., HEAD_DESCRIPTION_MAX).
 *
 * WHAT THIS FILE IS ACTUALLY FOR, and it is not the clip. A clip is one call and
 * obviously correct. The risk W21 carries is the OTHER string in that pipe: arc
 * W14 replaces the description outright on an ended run, and that sentence is
 * generated, not stored -- so a clip sized for marketing prose could silently
 * amputate the tombstone copy, in the WhatsApp preview, where nobody would see
 * it. So the assertion below is not "the ended sentence is 142 characters". It
 * is "for EVERY shape endedRunSentence can produce, at its longest possible
 * dates, the clip is a no-op" -- derived from runNoun's own branches and the
 * real month names rather than pinned to a number measured once.
 *
 * Both directions, per CLAUDE.md: the clip must fire on the copy it exists for
 * AND leave everything shorter byte-identical.
 */
import { describe, expect, it } from 'vitest';
import { HEAD_DESCRIPTION_MAX, truncate } from '../app/truncate';
import { endedRunSentence } from '@/modules/event-page/endedShareDescription';
import { formatLongDate } from '@/modules/event-page/bento/utils/endedRun';

// Ellipsis by code point, never pasted -- app/truncate.ts's own header explains
// why (a raw one is exactly the mojibake this repo has already shipped once).
const ELLIPSIS = String.fromCharCode(8230);

/**
 * The longest month name the date formatter can emit, found by asking it rather
 * than by asserting "September". MONTHS is private to endedRun.ts, so a rename
 * or a locale change there flows into this bound instead of dating it.
 */
const longestMonthNumber = (() => {
  let best = 1;
  let bestLen = -1;
  for (let m = 1; m <= 12; m += 1) {
    const iso = `2026-${String(m).padStart(2, '0')}-28`;
    const len = (formatLongDate(iso) ?? '').length;
    if (len > bestLen) {
      bestLen = len;
      best = m;
    }
  }
  return String(best).padStart(2, '0');
})();

// A two-digit day in the longest month, in two DIFFERENT years. Different years
// matter: formatRunRange compresses the opening date when the year (and then the
// month) match, so a same-year range is strictly shorter. This is the widest
// range the formatter has.
const RAN_FROM = `2025-${longestMonthNumber}-28`;
const ENDED_ON = `2026-${longestMonthNumber}-28`;

// The domain runNoun branches over, taken from its signature and docblock:
// `format ?? type` picks the structural shape, `category` picks the genre.
const FORMATS = [null, 'one_off', 'recurring', 'course', 'festival'] as const;
const CATEGORIES = [null, 'party', 'class', 'workshop', 'masterclass'] as const;

const everyEndedSentence = (): Array<{ label: string; text: string }> => {
  const out: Array<{ label: string; text: string }> = [];
  for (const format of FORMATS) {
    for (const category of CATEGORIES) {
      // `type` carries the shape on legacy payloads that have no `format`, so
      // exercise it on the same axis rather than leaving that path unmeasured.
      for (const useTypeInstead of [false, true]) {
        out.push({
          label: `format=${format ?? 'null'} category=${category ?? 'null'}${useTypeInstead ? ' (via type)' : ''}`,
          text: endedRunSentence({
            format: useTypeInstead ? null : format,
            type: useTypeInstead ? format : null,
            category,
            ranFrom: RAN_FROM,
            endedOn: ENDED_ON,
          }),
        });
      }
    }
  }
  return out;
};

describe('HEAD_DESCRIPTION_MAX', () => {
  it('is 160 -- the copy decision, not an implementation detail', () => {
    // Closed by Ricky 2026-09-04: it matches the truncation organiser.tsx
    // already had, keeps one number across meta/og/twitter, and Google renders
    // roughly 155-160 characters of a snippet anyway. Changing the number is a
    // copy decision and should have to come through this line.
    expect(HEAD_DESCRIPTION_MAX).toBe(160);
  });
});

describe('the ended-run sentence survives the head clip', () => {
  it('built the LONG range form -- the probe measured what it claims to', () => {
    // Without this the whole suite could pass while measuring the short
    // date-free sentence, which is comfortably inside any bound.
    const sample = endedRunSentence({
      format: 'recurring',
      type: null,
      category: 'masterclass',
      ranFrom: RAN_FROM,
      endedOn: ENDED_ON,
    });
    const from = formatLongDate(RAN_FROM);
    const to = formatLongDate(ENDED_ON);
    expect(from).toBeTruthy();
    expect(to).toBeTruthy();
    expect(sample).toContain(` It ran ${from} to ${to}.`);
  });

  it('is never clipped, for any shape, at the widest dates the formatter has', () => {
    const sentences = everyEndedSentence();
    // 5 formats x 5 categories x 2 (format vs type) -- assert the generator ran.
    expect(sentences).toHaveLength(50);

    const clipped = sentences.filter(({ text }) => truncate(text, HEAD_DESCRIPTION_MAX) !== text);
    expect(clipped.map((c) => `${c.label}: ${c.text.length} chars`)).toEqual([]);
  });

  it('leaves the widest sentence with real headroom, not a hairline pass', () => {
    // A bound that passes at 159/160 is one word of copy away from amputating
    // the tombstone. Report the actual figure when it tightens.
    const longest = everyEndedSentence().reduce(
      (a, b) => (b.text.length > a.text.length ? b : a),
    );
    expect(longest.text.length).toBeLessThanOrEqual(HEAD_DESCRIPTION_MAX - 10);
  });

  it('never ends in an ellipsis -- the tombstone reads as a finished sentence', () => {
    for (const { label, text } of everyEndedSentence()) {
      expect(`${label}: ${truncate(text, HEAD_DESCRIPTION_MAX).endsWith(ELLIPSIS)}`).toBe(
        `${label}: false`,
      );
    }
  });
});

describe('stored copy IS clipped -- the direction the arc exists for', () => {
  const storedProse = (chars: number) => 'a'.repeat(chars);

  it('clips the long-form sales copy the head used to ship whole', () => {
    // The measured live case: 5,536 characters into a document head.
    const clipped = truncate(storedProse(5536), HEAD_DESCRIPTION_MAX);
    expect(clipped).toHaveLength(HEAD_DESCRIPTION_MAX);
    expect(clipped.endsWith(ELLIPSIS)).toBe(true);
  });

  it('leaves copy exactly at the bound untouched, and clips one character past it', () => {
    const atBound = storedProse(HEAD_DESCRIPTION_MAX);
    expect(truncate(atBound, HEAD_DESCRIPTION_MAX)).toBe(atBound);

    const overBound = storedProse(HEAD_DESCRIPTION_MAX + 1);
    expect(truncate(overBound, HEAD_DESCRIPTION_MAX)).not.toBe(overBound);
    expect(truncate(overBound, HEAD_DESCRIPTION_MAX)).toHaveLength(HEAD_DESCRIPTION_MAX);
  });

  it('returns blank for absent copy, so the route can fall back with ||', () => {
    // app/routes/event.tsx relies on this: `truncate(...) || null`, because
    // meta() falls back with `??`, which does not fire on ''. Drop the `|| null`
    // and a description-less event ships an EMPTY description tag.
    expect(truncate(null, HEAD_DESCRIPTION_MAX)).toBe('');
    expect(truncate(undefined, HEAD_DESCRIPTION_MAX)).toBe('');
    expect(truncate('   ', HEAD_DESCRIPTION_MAX)).toBe('');
    expect(truncate(null, HEAD_DESCRIPTION_MAX) || null).toBeNull();
  });
});
