import { describe, expect, it } from 'vitest';
import { blankCreate, leaveSheetNeeded } from '../model';

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
