import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ChipRow, latestCloseIso } from '../EventTicketsPage';
import { buildChips } from '../goodToKnow';

describe('latestCloseIso', () => {
  const cases: Array<[string, Array<string | null>, string | null]> = [
    ['no types', [], null],
    ['all null', [null, null], null],
    ['one', ['2026-11-14T20:00:00Z'], '2026-11-14T20:00:00Z'],
    ['latest of several', ['2026-11-14T18:00:00Z', null, '2026-11-14T21:00:00Z'], '2026-11-14T21:00:00Z'],
    ['junk ignored', ['nope', '2026-11-14T18:00:00Z'], '2026-11-14T18:00:00Z'],
  ];
  it.each(cases)('%s', (_n, input, want) => expect(latestCloseIso(input)).toBe(want));
});

describe('ChipRow shapes', () => {
  const base = { startIso: null, endIso: null, programmeStartIso: null, programmeEndIso: null, idRequired: null, bar: null, cloakroom: null, facilities: [], floorType: null, musicStyles: [], latestCloseIso: null, parking: null, timeZone: 'Europe/London' };
  it('none: renders nothing', () => expect(renderToStaticMarkup(<ChipRow chips={buildChips(base)} />)).toBe(''));
  it('one chip', () => {
    const html = renderToStaticMarkup(<ChipRow chips={buildChips({ ...base, floorType: 'wood' })} />);
    expect(html).toContain('Wooden floor');
    expect(html).toContain('Good to know');
  });
  it('long parking note wraps, ID is marked', () => {
    const html = renderToStaticMarkup(<ChipRow chips={buildChips({ ...base, idRequired: true, parking: 'x'.repeat(200) })} />);
    expect(html).toContain('break-words');
    expect(html).toContain('Bring photo ID');
    expect(html).toContain('data-chip="parking"');
  });
});
