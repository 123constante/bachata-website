import { describe, expect, it } from 'vitest';
import { SUBMIT_NEEDS_VENUE, reviewStrip } from '@/modules/organiser-self-serve/reviewModel';
import { lifecycleCommand, submitForReviewCommand } from '@/modules/organiser/shared/seriesCommands';

const returned = { action: 'rejected', to_state: 'rejected', reason: 'Add the price and confirm the venue.', created_at: '2026-10-01T18:00:00+00:00' };

const states = (status: string) => reviewStrip(status, null).steps.map((s) => `${s.key}=${s.state}`).join(' ');

describe('reviewStrip (05-A)', () => {
  it('walks draft -> in review -> live', () => {
    expect(states('draft')).toBe('draft=current review=todo live=todo');
    expect(states('pending_review')).toBe('draft=done review=current live=todo');
    expect(states('live')).toBe('draft=done review=done live=current');
    expect(states('paused')).toBe('draft=done review=done live=done');
  });

  it('offers submit only where the server admits draft|rejected -> pending_review', () => {
    expect(reviewStrip('draft', null).submit).toEqual({ label: 'Send for review' });
    expect(reviewStrip('rejected', returned).submit).toEqual({ label: 'Send again for review' });
    for (const s of ['pending_review', 'live', 'paused', 'ended', 'archived']) expect(reviewStrip(s, null).submit).toBeNull();
  });

  it('shows the admin message and date on a returned series, and marks the step returned', () => {
    const m = reviewStrip('rejected', returned);
    expect(m.reason).toBe('Add the price and confirm the venue.');
    expect(m.returnedAt).toBe('2026-10-01T18:00:00+00:00');
    expect(m.steps[1]).toEqual({ key: 'review', label: 'Returned', state: 'returned' });
    expect(m.headline).toBe('Returned with a message');
  });

  it('never shows a stale approval as the reason, and tolerates a missing decision', () => {
    expect(reviewStrip('rejected', { action: 'approved', to_state: 'live', reason: 'Looks good', created_at: '2026-09-01T00:00:00Z' }).reason).toBeNull();
    expect(reviewStrip('rejected', { ...returned, reason: '   ' }).reason).toBeNull();
    expect(reviewStrip('rejected', undefined).reason).toBeNull();
    expect(reviewStrip('live', returned).reason).toBeNull();
  });

  it('links the public page only where it is up (live, ended); a paused page is a 404 (S1)', () => {
    for (const s of ['live', 'ended']) {
      expect(reviewStrip(s, null).publicPage).toBe(true);
      expect(reviewStrip(s, null).previewNote).toBeNull();
    }
    for (const s of ['draft', 'pending_review', 'rejected']) {
      expect(reviewStrip(s, null).publicPage).toBe(false);
      expect(reviewStrip(s, null).previewNote).toMatch(/once it is live/);
    }
    // Archived is not on its way to live, so no "once it is live" note; its detail says who brings it back.
    expect(reviewStrip('archived', null).publicPage).toBe(false);
    expect(reviewStrip('archived', null).previewNote).toBeNull();
    expect(reviewStrip('archived', null).detail).toMatch(/Ask the Bachata Calendar team/);
  });

  it('says a paused page is hidden, never that it stays up (S1)', () => {
    const paused = reviewStrip('paused', null);
    expect(paused.publicPage).toBe(false);
    expect(paused.detail).toMatch(/hidden/);
    expect(paused.detail).not.toMatch(/stays up/);
    expect(paused.previewNote).toMatch(/hidden while paused/);
    // Said once, and pointing at a control that exists (there is no "Status" section).
    expect(paused.detail).not.toMatch(/hidden while paused/);
    expect(paused.detail).not.toMatch(/Status/);
    expect(paused.detail).toMatch(/Resume/);
  });
});

describe('submitForReviewCommand', () => {
  it('is series.set_lifecycle to pending_review, the one key the server reads', () => {
    expect(submitForReviewCommand()).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'pending_review' } });
    expect(submitForReviewCommand()).toEqual(lifecycleCommand('pending_review'));
  });
});

describe('the venue gate on "Send for review" (Lever 2 B2)', () => {
  it('a draft or returned series with no venue keeps the button but says what is missing', () => {
    expect(reviewStrip('draft', null, { hasVenue: false }).submit).toEqual({ label: 'Send for review' });
    expect(reviewStrip('draft', null, { hasVenue: false }).submitMissing).toBe(SUBMIT_NEEDS_VENUE);
    expect(reviewStrip('rejected', null, { hasVenue: false }).submitMissing).toBe(SUBMIT_NEEDS_VENUE);
  });

  it('a series with a venue, or one that cannot be submitted, carries no hint', () => {
    expect(reviewStrip('draft', null, { hasVenue: true }).submitMissing).toBeNull();
    expect(reviewStrip('draft', null).submitMissing).toBeNull();
    for (const status of ['pending_review', 'live', 'paused', 'ended', 'archived']) {
      expect(reviewStrip(status, null, { hasVenue: false }).submitMissing).toBeNull();
    }
  });
});
