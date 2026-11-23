import { describe, it, expect } from 'vitest';
import { sanitizeReturnTo } from '@/lib/authRouting';
import {
  formatLocalNight, parseClaim, parseLock, screenForClaim, winAuthHref, winReturnTo, doorUrl, NEXT, parseNight, screenAfterLock,
} from '../model';

const night = { occurrence_id: 'o1', title: 'Friday Bachata', start_local: '2026-12-04T20:00:00' };
const ok = (win: object, open_nights: unknown[] = [night]) => ({ ok: true, win: { id: 'w1', ...win }, open_nights });

describe('claim -> screen', () => {
  it.each([
    ['link_not_found', 'cancel'], ['link_expired', 'cancel'], ['bound_to_other_account', 'other'], ['something_new', 'cancel'],
  ])('refused %s -> %s', (reason, screen) => {
    expect(screenForClaim(parseClaim({ ok: false, reason }), { fromAuth: false })).toBe(screen);
  });
  it('state matrix', () => {
    const c = (d: unknown, fromAuth = false) => screenForClaim(parseClaim(d), { fromAuth });
    expect(c(ok({ state: 'contacted' }))).toBe('won');
    expect(c(ok({ state: 'contacted' }), true)).toBe('pick');
    expect(c(ok({ state: 'contacted' }, []), true)).toBe('none');
    expect(c(ok({ state: 'locked', qr_token: 'abc' }, []))).toBe('qr');
    expect(c(null)).toBe('error');
    expect(c({ ok: true })).toBe('error');
  });
});

describe('lock outcome', () => {
  it('ok gives qr', () => {
    expect(parseLock({ ok: true, win: { id: 'w1', qr_token: 'tok', night } })).toMatchObject({ kind: 'qr', qrToken: 'tok' });
    expect(parseLock({ ok: true, win: { id: 'w1' } }).kind).toBe('error');
  });
  it.each(['spot_taken', 'already_been_to_event', 'night_not_open'])('%s -> back to pick, night dropped', (reason) => {
    expect(parseLock({ ok: false, reason })).toMatchObject({ kind: 'back-to-pick', dropNight: true });
  });
  it('every documented reason maps to a screen or a line', () => {
    for (const r of ['not_found', 'not_claimable', 'honesty_required', 'night_not_open', 'already_been_to_event', 'spot_taken']) {
      expect(parseLock({ ok: false, reason: r }).kind, r).not.toBe('error');
    }
    expect(parseLock({ ok: false, reason: 'weird' }).kind).toBe('error');
  });
});

describe('taps and helpers', () => {
  it('tap table', () => {
    expect(NEXT.won.chooseNight).toBe('pick');
    expect(NEXT.pick.lock).toBe('honest');
    expect(NEXT.honest.back).toBe('pick');
  });
  it('returnTo keeps the token case through sanitizeReturnTo', () => {
    const t = 'AbC_dEf-123';
    expect(sanitizeReturnTo(winReturnTo(t))).toBe(`/raffle/win/${t}`);
    expect(decodeURIComponent(winAuthHref(t).split('returnTo=')[1])).toBe(`/raffle/win/${t}`);
  });
  it('shows the stored London wall clock without zone conversion', () => {
    expect(formatLocalNight('2026-07-03T20:00:00')).toBe('Fri 3 Jul, 20:00');
    expect(formatLocalNight('junk')).toBe('');
  });
  it('door url', () => expect(doorUrl('https://x.test', 'q')).toBe('https://x.test/raffle/door/q'));
});

describe('share poster data + screen table', () => {
  it('parseNight keeps old fields, adds venue/poster/public id, missing = null', () => {
    expect(parseNight({ ...night, venue_name: 'The Wardrobe', poster_url: 'https://x/p.jpg', public_event_id: 'e1' })).toEqual({
      occurrenceId: 'o1', title: 'Friday Bachata', startLocal: '2026-12-04T20:00:00',
      venueName: 'The Wardrobe', posterUrl: 'https://x/p.jpg', publicEventId: 'e1',
    });
    expect(parseNight(night)).toMatchObject({ venueName: null, posterUrl: null, publicEventId: null });
  });
  it('parseClaim / parseLock return firstName, null when missing', () => {
    const c = parseClaim({ ...ok({ state: 'contacted' }), first_name: 'Maya' });
    expect(c.kind === 'ok' && c.firstName).toBe('Maya');
    const c2 = parseClaim(ok({ state: 'contacted' }));
    expect(c2.kind === 'ok' && c2.firstName).toBeNull();
    expect(parseLock({ ok: true, first_name: 'Maya', win: { id: 'w1', qr_token: 't', night } })).toMatchObject({ firstName: 'Maya' });
    expect(parseLock({ ok: true, win: { id: 'w1', qr_token: 't' } })).toMatchObject({ firstName: null });
  });
  it('screen table', () => {
    expect(screenAfterLock(true)).toBe('share');
    expect(screenAfterLock(false)).toBe('qr');
    expect(NEXT.share.skip).toBe('qr');
    expect(screenForClaim(parseClaim(ok({ state: 'locked', qr_token: 'abc' }, [])), { fromAuth: false })).toBe('qr');
  });
});
