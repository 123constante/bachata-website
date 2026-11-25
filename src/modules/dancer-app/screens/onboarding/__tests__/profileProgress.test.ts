import { describe, expect, it } from 'vitest';
import { NEXT_LABEL, PROGRESS_TOTAL, profileProgress, type ProgressInput } from '../profileProgress';

const none: ProgressInput = { photo: false, startedYear: null, styles: [], partnerAnswered: false, bio: '', link: '' };
const all: ProgressInput = { photo: true, startedYear: 2020, styles: ['sensual'], partnerAnswered: true, bio: 'hi', link: '@me' };

describe('profileProgress', () => {
  it('empty is 0', () => expect(profileProgress(none)).toMatchObject({ done: 0, total: PROGRESS_TOTAL, pct: 0 }));
  it('each item toggles done by 1', () => {
    for (const patch of [{ photo: true }, { startedYear: 2020 }, { styles: ['x'] }, { partnerAnswered: true }, { bio: 'b' }, { link: '@me' }]) {
      expect(profileProgress({ ...none, ...patch }).done).toBe(1);
      expect(profileProgress({ ...all, ...Object.fromEntries(Object.keys(patch).map((k) => [k, none[k as keyof ProgressInput]])) }).done).toBe(PROGRESS_TOTAL - 1);
    }
  });
  it('missing order and next label', () => {
    const r = profileProgress(none);
    expect(r.missing).toEqual(['photo', 'years', 'styles', 'partner', 'bio', 'link']);
    expect(r.next).toBe('photo');
    expect(NEXT_LABEL).toMatchObject({ photo: 'add a photo', years: 'add your years dancing', styles: 'add your styles', partner: 'answer the partner question', bio: 'add a bio', link: 'add a link' });
    expect(profileProgress({ ...all, bio: '  ' }).next).toBe('bio');
  });
  it('link counts instagram or website', () => {
    expect(profileProgress({ ...none, link: 'https://example.com' }).missing).not.toContain('link');
    expect(profileProgress({ ...none, link: '  ' }).missing).toContain('link');
  });
  it('partner yes == no == done (any answer; non-dancer too)', () => {
    expect(profileProgress({ ...none, partnerAnswered: true }).missing).not.toContain('partner');
  });
  it('100% only when everything is present', () => {
    const r = profileProgress(all);
    expect(r).toMatchObject({ done: PROGRESS_TOTAL, pct: 100, missing: [], next: null });
    expect(profileProgress({ ...all, bio: '' }).pct).toBeLessThan(100);
  });
  it('pct = round(done/total*100)', () => {
    const r = profileProgress({ ...none, photo: true, startedYear: 2020, styles: ['x'], partnerAnswered: true });
    expect(r.pct).toBe(Math.round((r.done / PROGRESS_TOTAL) * 100));
  });
});
