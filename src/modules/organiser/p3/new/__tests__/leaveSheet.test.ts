import { describe, expect, it } from 'vitest';
import { blankCreate, createPayload, descriptionLine, isUntouched, leaveSheetNeeded, parseStoredDraft } from '../model';
import { emptyForm, everyAddAll } from '../../data/sessions';
import { parseTree } from '../../../events/programmeSeriesModel';

describe('leaveSheetNeeded (option C leave sheet)', () => {
  it('untouched: no sheet, Back leaves at once', () => {
    expect(leaveSheetNeeded(blankCreate('one_date', 's1'))).toBe(false);
  });
  it('anything typed: sheet', () => {
    expect(leaveSheetNeeded({ ...blankCreate('one_date', 's1'), name: 'Friday Bachata' })).toBe(true);
  });
  it('a flyer alone counts as touched', () => {
    expect(leaveSheetNeeded(blankCreate('one_date', 's1'), true)).toBe(true);
  });
  it('created: the draft exists, no sheet', () => {
    expect(leaveSheetNeeded({ ...blankCreate('one_date', 's1'), name: 'Friday Bachata', created: true })).toBe(false);
  });
});

describe('description (create look slice 2)', () => {
  it('counts as touched', () => {
    expect(isUntouched({ ...blankCreate('one_date', 's1'), description: 'Social dancing' })).toBe(false);
    expect(leaveSheetNeeded({ ...blankCreate('one_date', 's1'), description: 'Social dancing' })).toBe(true);
  });
  it('rides the create payload only when non-empty', () => {
    const d = { ...blankCreate('one_date', 's1'), name: 'Friday', description: '  Social dancing  ' };
    expect(createPayload(d, { cityId: null }).default_description).toBe('Social dancing');
    expect('default_description' in createPayload({ ...d, description: ' ' }, { cityId: null })).toBe(false);
  });
  it('a stored draft without description still parses', () => {
    const { description: _omit, ...old } = blankCreate('one_date', 's1');
    const parsed = parseStoredDraft(JSON.stringify(old));
    expect(parsed?.description).toBe('');
  });
  it('descriptionLine: empty, first line, truncated', () => {
    const b = blankCreate('one_date', 's1');
    expect(descriptionLine(b)).toBe('No description');
    expect(descriptionLine({ ...b, description: 'Line one\nLine two' })).toBe('Line one');
    expect(descriptionLine({ ...b, description: 'x'.repeat(80) })).toHaveLength(58);
  });
});

describe('teachers ride the sessions step', () => {
  it('everyAddAll puts people on the added item', () => {
    const f = { ...emptyForm('class'), title: 'Class', start: '19:00', end: '20:00', people: [{ profileId: 'p1', name: 'Ana', role: 'teaching' }] };
    const built = everyAddAll(parseTree(null), [f]);
    expect(built.problem).toBeNull();
    expect(JSON.stringify(built.command)).toContain('p1');
  });
});
