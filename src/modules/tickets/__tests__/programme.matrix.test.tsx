import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { buildProgramme, type ProgrammeSessionInput } from '../programmeModel';
import { ProgrammeBlock } from '../EventTicketsPage';
import { buildChips } from '../goodToKnow';

const s = (o: Partial<ProgrammeSessionInput> & { id: string }): ProgrammeSessionInput => ({
  title: '', type: 'party', day: null, startMins: null, endMins: null, levels: [], ...o,
});

const shapes: Array<[string, ProgrammeSessionInput[], { n: number; more: boolean; first?: string; len?: string | null }]> = [
  ['none', [], { n: 0, more: false }],
  ['class+party', [s({ id: 'p', startMins: 1260, endMins: 120 }), s({ id: 'c', type: 'class', levels: ['beginner'], startMins: 1200, endMins: 1260 })],
    { n: 2, more: false, first: '8:00pm to 9:00pm', len: '6 hours' }],
  ['tbc last', [s({ id: 'x', type: 'show', title: 'Live' }), s({ id: 'p', startMins: 1260 })], { n: 2, more: false, first: '9:00pm', len: null }],
  ['five items', ['a', 'b', 'c', 'd', 'e'].map((id, i) => s({ id, startMins: 600 + i * 60 })), { n: 4, more: true, first: '10:00am' }],
  ['open level', [s({ id: 'c', type: 'workshop', levels: ['open_level'], startMins: 600 })], { n: 1, more: false, first: '10:00am' }],
];

describe('programme x shape', () => {
  it.each(shapes)('%s', (_n, input, want) => {
    const v = buildProgramme(input);
    if (want.n === 0) { expect(v).toBeNull(); expect(renderToStaticMarkup(<ProgrammeBlock view={v} />)).toBe(''); return; }
    expect(v!.items).toHaveLength(want.n);
    expect(v!.hasMore).toBe(want.more);
    if (want.first) expect(v!.items[0].timeText).toBe(want.first);
    const html = renderToStaticMarkup(<ProgrammeBlock view={v} />);
    expect(html.match(/data-programme-item/g) ?? []).toHaveLength(want.n);
    expect(html.includes('see-full-programme')).toBe(want.more);
    if ('len' in want) {
      const chips = buildChips({ startIso: null, endIso: null, programmeStartIso: v!.startIso, programmeEndIso: v!.endIso, idRequired: null, bar: null, cloakroom: null, facilities: [], floorType: null, musicStyles: [], latestCloseIso: null, parking: null, timeZone: 'Europe/London' });
      expect(chips.find((c) => c.kind === 'length')?.text ?? null).toBe(want.len);
    }
  });
  it('labels levels, plain type without', () => {
    const v = buildProgramme([s({ id: 'c', type: 'class', levels: ['beginner'], startMins: 1 }), s({ id: 'd', type: 'class', startMins: 2 })])!;
    expect(v.items.map((i) => i.label)).toEqual(['Class · Beginner', 'Class']);
  });
});
