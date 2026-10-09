/**
 * Schedule level labels + typography (2026-10-07).
 *
 * Proves, by rendering the real ScheduleBlock with the program hooks stubbed:
 *   - the organiser's level carries an "Organiser says:" source label;
 *   - level ranges are spelled out ("Improver to Intermediate"), no "IMP/INT";
 *   - "Special tonight" renders once per date block, however many rows qualify;
 *   - programme title / level / time text is >= 12px and the schedule text
 *     colours hold >= 4.5:1 on every schedule background.
 * The dancer-rated level ("Dancers rate:") is series-wide and lives in
 * DerivedLevelBadge -- see DerivedLevelBadge.test.tsx.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import type { ScheduleSession } from '../../../sections/EventScheduleGrid';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: { rpc: () => ({ data: null, error: null }) },
}));

const program = vi.hoisted(() => ({ items: [] as unknown[] }));

vi.mock('@/modules/event-page/sections/EventScheduleGrid', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../sections/EventScheduleGrid')>();
  return {
    ...actual,
    useProgramItems: () => ({ data: program.items, isLoading: false, isSuccess: true }),
    useOccurrenceProgram: () => ({ data: program.items, isLoading: false, isSuccess: true }),
    useProgramSections: () => ({ data: [] }),
  };
});

import {
  ScheduleBlock,
  levelPhraseFor,
  ORGANISER_LEVEL_LABEL,
  SCHEDULE_TEXT_ACCENT,
  SCHEDULE_TEXT_MUTED,
} from '../ScheduleBlock';

let n = 0;
const mk = (o: Partial<ScheduleSession>): ScheduleSession => ({
  id: o.id ?? `s${++n}`,
  title: 'Bachata Basics',
  type: 'class',
  day: '2026-10-10',
  startMins: 20 * 60,
  endMins: 21 * 60,
  programIndex: n,
  levels: [],
  room: null,
  people: [],
  sectionId: null,
  sectionKind: null,
  sectionLabel: null,
  ...o,
});

const render = (items: ScheduleSession[], occurrenceId: string | null = null) => {
  program.items = items;
  return renderToStaticMarkup(
    <MemoryRouter>
      <ScheduleBlock eventId="evt-1" occurrenceId={occurrenceId} />
    </MemoryRouter>,
  );
};

const count = (html: string, needle: string) => html.split(needle).length - 1;
const textOnly = (html: string) => html.replace(/<[^>]+>/g, '');

describe('levelPhraseFor', () => {
  it('spells out ranges in plain words', () => {
    expect(levelPhraseFor(['intermediate', 'improver'])).toBe('Improver to Intermediate');
    expect(levelPhraseFor(['beginner', 'improver', 'intermediate', 'advanced'])).toBe('Beginner to Advanced');
    expect(levelPhraseFor(['beginner', 'advanced'])).toBe('Beginner and Advanced');
    expect(levelPhraseFor(['beginner', 'intermediate', 'advanced'])).toBe('Beginner, Intermediate and Advanced');
    expect(levelPhraseFor(['beginner'])).toBe('Beginner');
    expect(levelPhraseFor(['open_level'])).toBe('Open level');
    expect(levelPhraseFor([])).toBeNull();
  });
});

describe('ScheduleBlock level labels', () => {
  it('labels the organiser level and never renders "IMP/INT"', () => {
    const html = render([
      mk({ id: 'a', levels: ['improver', 'intermediate'] }),
      mk({ id: 'b', title: 'Footwork', startMins: 21 * 60, endMins: 22 * 60, levels: ['beginner'] }),
    ]);
    const text = textOnly(html);
    expect(text).toContain(`${ORGANISER_LEVEL_LABEL} Improver to Intermediate`);
    expect(text).toContain(`${ORGANISER_LEVEL_LABEL} Beginner`);
    expect(text).not.toMatch(/imp\s*\/\s*int/i);
    expect(text).not.toMatch(/\b(Beg|Imp|Int|Adv)\b/);
  });

  it('spells out ranges in the multi-room card layout too', () => {
    const html = render([
      mk({ id: 'r1', room: 'Main', levels: ['improver', 'intermediate'] }),
      mk({ id: 'r2', room: 'Studio', levels: ['beginner', 'improver'] }),
    ]);
    const text = textOnly(html);
    expect(text).toContain(`${ORGANISER_LEVEL_LABEL} Improver to Intermediate`);
    expect(text).toContain(`${ORGANISER_LEVEL_LABEL} Beginner to Improver`);
    expect(text).not.toMatch(/imp\s*\/\s*int/i);
  });

  it('renders no organiser level line when the session declares no level', () => {
    const html = render([mk({ id: 'none', levels: [] })]);
    expect(html).not.toContain('schedule-organiser-level-none');
    expect(textOnly(html)).not.toContain(ORGANISER_LEVEL_LABEL);
  });

  it('never shows a dancer rating inside the schedule (it has no per-session source)', () => {
    const html = render([mk({ id: 'a', levels: ['beginner'] })]);
    expect(textOnly(html)).not.toContain('Dancers rate');
  });
});

describe('ScheduleBlock "Special tonight"', () => {
  // The rows below are on 2026-10-10; "tonight" needs that to be today in London.
  beforeEach(() => { vi.useFakeTimers({ toFake: ['Date'] }); vi.setSystemTime(new Date('2026-10-10T18:00:00Z')); });
  afterEach(() => { vi.useRealTimers(); });
  it('appears once per date block even when every row is added-only', () => {
    const html = render(
      [
        mk({ id: 'x1', addedOnly: true, levels: ['beginner'] }),
        mk({ id: 'x2', addedOnly: true, startMins: 21 * 60, endMins: 22 * 60 }),
        mk({ id: 'x3', addedOnly: true, type: 'party', title: 'Late social', startMins: 22 * 60, endMins: 26 * 60 }),
      ],
      'occ-1',
    );
    expect(count(html, 'data-testid="schedule-special-tonight"')).toBe(1);
    expect(count(textOnly(html), 'Special tonight')).toBe(1);
  });

  it('appears once in the multi-room grid as well', () => {
    const html = render(
      [
        mk({ id: 'm1', room: 'Main', addedOnly: true }),
        mk({ id: 'm2', room: 'Studio', addedOnly: true }),
      ],
      'occ-1',
    );
    expect(count(textOnly(html), 'Special tonight')).toBe(1);
  });

  it('names the one-off sessions when only some rows are added-only', () => {
    const html = render(
      [
        mk({ id: 'r1', title: 'Bachata Basics' }),
        mk({ id: 'r2', title: 'Footwork Workshop', addedOnly: true, startMins: 21 * 60, endMins: 22 * 60 }),
      ],
      'occ-1',
    );
    expect(count(textOnly(html), 'Special tonight')).toBe(1);
    expect(textOnly(html)).toContain('Special tonight: Footwork Workshop (9:00 PM)');
  });

  it('identifies generic-titled one-offs by type and start time', () => {
    const html = render(
      [
        mk({ id: 'g1', title: 'Bachata Basics' }),
        mk({ id: 'g2', title: 'Party 2', type: 'party', addedOnly: true, startMins: 22 * 60, endMins: 26 * 60 }),
      ],
      'occ-1',
    );
    expect(textOnly(html)).toContain('Special tonight: Party (10:00 PM)');
  });

  it('ignores an added-only session that has been cancelled', () => {
    const html = render(
      [
        mk({ id: 'k1' }),
        mk({ id: 'k2', addedOnly: true, cancelled: true, startMins: 21 * 60, endMins: 22 * 60 }),
      ],
      'occ-1',
    );
    expect(html).not.toContain('Special tonight');
  });

  it('is absent when no session is added-only', () => {
    const html = render([mk({ id: 'p1' })], 'occ-1');
    expect(html).not.toContain('Special tonight');
  });
});

describe('ScheduleBlock typography', () => {
  // Both inline `font-size` styles and Tailwind `text-[Npx]` classes are
  // scanned. Fixtures carry no people, so PeopleStack's own chip text (a
  // separate component, outside this change) is not rendered here.
  const sizesIn = (html: string) => [
    ...[...html.matchAll(/font-size:\s*(\d+)px/g)].map((m) => Number(m[1])),
    ...[...html.matchAll(/text-\[(\d+)px\]/g)].map((m) => Number(m[1])),
  ];

  it.each([
    ['single-room', [
      mk({ id: 'a', levels: ['improver', 'intermediate'] }),
      mk({ id: 'm', type: 'masterclass', title: 'Musicality', startMins: 18 * 60, endMins: 19 * 60, levels: ['advanced'] }),
      mk({ id: 'p', type: 'party', title: 'Late social', startMins: 22 * 60, endMins: 26 * 60 }),
      mk({ id: 't', title: 'Shines', startMins: null, endMins: 23 * 60 }),
      mk({ id: 'c', title: 'Styling', cancelled: true, startMins: 19 * 60, endMins: 20 * 60 }),
      mk({ id: 'sp', addedOnly: true, title: 'Bonus', startMins: 23 * 60, endMins: 24 * 60 }),
    ]],
    ['multi-room + show + multi-day', [
      mk({ id: 'r1', room: 'Main', levels: ['beginner', 'improver'] }),
      mk({ id: 'r2', room: 'Studio', levels: ['open_level'], cancelled: true }),
      mk({ id: 'sh', room: 'Main', type: 'show', title: 'Team show \u00b7 11:30pm', startMins: 23 * 60, endMins: 23 * 60 + 30 }),
      mk({ id: 'd2', room: 'Studio', day: '2026-10-11', levels: ['advanced'] }),
    ]],
  ] as const)('renders no programme text below 12px (%s)', (_name, items) => {
    const sizes = sizesIn(render([...items]));
    expect(sizes.length).toBeGreaterThan(0);
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(12);
  });

  // WCAG relative-luminance contrast, computed from the HSL tokens in
  // src/index.css (--bento-surface-raised 161 27% 14%) and the multi-room
  // stripe overlay (rgba(255,255,255,0.08)) -- the worst case behind any
  // schedule text.
  const hslToRgb = (h: number, s: number, l: number) => {
    s /= 100; l /= 100;
    const k = (x: number) => (x + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    const f = (x: number) => l - a * Math.max(-1, Math.min(k(x) - 3, Math.min(9 - k(x), 1)));
    return [f(0), f(8), f(4)].map((v) => v * 255);
  };
  const lum = (c: number[]) => {
    const [r, g, b] = c.map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a: number[], b: number[]) => {
    const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
    return (hi + 0.05) / (lo + 0.05);
  };
  const parse = (token: string) => {
    const m = /hsl\((\d+) (\d+)% (\d+)%\)/.exec(token);
    if (!m) throw new Error(`unparseable ${token}`);
    return hslToRgb(Number(m[1]), Number(m[2]), Number(m[3]));
  };
  const raised = hslToRgb(161, 27, 14);
  const stripe = raised.map((v) => v * 0.92 + 255 * 0.08);

  it.each([
    ['accent', SCHEDULE_TEXT_ACCENT],
    ['muted', SCHEDULE_TEXT_MUTED],
  ])('%s text holds >= 4.5:1 on the tile and on the room stripe', (_name, token) => {
    expect(ratio(parse(token), raised)).toBeGreaterThanOrEqual(4.5);
    expect(ratio(parse(token), stripe)).toBeGreaterThanOrEqual(4.5);
  });
});
