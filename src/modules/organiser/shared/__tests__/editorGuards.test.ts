import { describe, expect, it } from 'vitest';
import { UNSAVED_MESSAGE, canConfirm, confirmCopy, leaveGuardEnabled, publicEventPath, type ConfirmKind } from '../editorGuards';
import { formToDraft, lifecycleActions, type BasicsForm } from '../seriesModel';
import { emptyCreateForm, previewModel } from '../createModel';

describe('leaveGuardEnabled (unsaved-changes warning)', () => {
  it('warns only while there are edits to lose', () => {
    expect(leaveGuardEnabled({ dirty: true })).toBe(true);
    expect(leaveGuardEnabled({ dirty: false })).toBe(false);
  });
  it('stays quiet while a save runs and once the create has landed', () => {
    expect(leaveGuardEnabled({ dirty: true, saving: true })).toBe(false);
    expect(leaveGuardEnabled({ dirty: true, finished: true })).toBe(false);
  });
  it('says plainly what is lost', () => {
    expect(UNSAVED_MESSAGE).toMatch(/not saved/);
    expect(UNSAVED_MESSAGE).not.toMatch(/—/);
  });
});

describe('publicEventPath (View on the site)', () => {
  it('uses the slug, and the id until the event has one', () => {
    expect(publicEventPath({ slug: 'tuesday-class', id: 'uuid-1' })).toBe('/event/tuesday-class');
    expect(publicEventPath({ slug: null, id: 'uuid-1' })).toBe('/event/uuid-1');
  });
});

describe('confirmCopy (hard confirm)', () => {
  const kinds: ConfirmKind[] = ['cancel_date', 'remove_date', 'pause_series', 'archive_series'];
  it('names the subject and the consequence for every kind, in plain British English', () => {
    for (const kind of kinds) {
      const c = confirmCopy(kind, { subject: 'Tue 6 Oct', reason: 'Teacher is ill' });
      expect(c.title).toContain('Tue 6 Oct');
      expect(c.consequence.length).toBeGreaterThan(20);
      expect(c.undo.length).toBeGreaterThan(10);
      expect(c.confirmLabel).toMatch(/^Yes, /);
      expect(c.keepLabel).toMatch(/^No, /);
      const all = JSON.stringify(c);
      expect(all).not.toMatch(/—|&mdash;/);
      expect(all.toLowerCase()).not.toContain('social');
    }
  });
  it('cancel tells dancers what they will see, including the reason', () => {
    const c = confirmCopy('cancel_date', { subject: 'Tue 6 Oct', reason: 'Teacher is ill' });
    expect(c.consequence).toContain('Teacher is ill');
    expect(c.consequence).toMatch(/Dancers will see/);
  });
  it('archive says only the team can bring it back; pause says nothing is deleted', () => {
    expect(confirmCopy('archive_series', { subject: 'X' }).undo).toMatch(/team/);
    expect(confirmCopy('pause_series', { subject: 'X' }).consequence).toMatch(/Nothing is deleted/);
  });
  it('asks for a tick on cancel, remove and archive, but not on pause', () => {
    expect(confirmCopy('cancel_date', { subject: 'X' }).requireAck).toBe(true);
    expect(confirmCopy('remove_date', { subject: 'X' }).requireAck).toBe(true);
    expect(confirmCopy('archive_series', { subject: 'X' }).requireAck).toBe(true);
    expect(confirmCopy('pause_series', { subject: 'X' }).requireAck).toBe(false);
  });
  it('remove explains the tidy-up when the date was already cancelled', () => {
    expect(confirmCopy('remove_date', { subject: 'X', alreadyCancelled: true }).consequence).toMatch(/cancelled date/);
  });
});

describe('canConfirm', () => {
  const hard = { requireAck: true };
  it('needs the tick when one is asked for', () => {
    expect(canConfirm(hard, false, false)).toBe(false);
    expect(canConfirm(hard, true, false)).toBe(true);
    expect(canConfirm({ requireAck: false }, false, false)).toBe(true);
  });
  it('never while a command is running', () => {
    expect(canConfirm(hard, true, true)).toBe(false);
    expect(canConfirm({ requireAck: false }, false, true)).toBe(false);
  });
});

describe('pause and archive both ask again; resume does not', () => {
  it('flags confirm on pause and archive only', () => {
    const live = Object.fromEntries(lifecycleActions('live').map((a) => [a.to, a.confirm]));
    expect(live).toEqual({ paused: true, archived: true });
    expect(lifecycleActions('paused').find((a) => a.to === 'live')?.confirm).toBe(false);
  });
});

describe('Level is no longer set by organisers and never wiped', () => {
  const form: BasicsForm = {
    name: 'Thursday Class', description: '', venueId: 'v1', startTime: '20:00', endTime: '22:00',
    ticketUrl: '', coverImageUrl: '', instagramUrl: '', passes: null,
  };

  it('the form and draft carry no level', () => {
    expect('level' in form).toBe(false);
    expect('level' in formToDraft(form)).toBe(false);
  });
  it('the create preview shows no level', () => {
    const form = { ...emptyCreateForm(), name: 'Party', date: '2026-10-17', startTime: '20:00' };
    expect('level' in previewModel(form, null, 'Org', '2026-10-05')).toBe(false);
  });
});
