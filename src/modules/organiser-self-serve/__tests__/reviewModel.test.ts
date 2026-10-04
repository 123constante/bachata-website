import { describe, expect, it } from 'vitest';
import { reviewStrip } from '../reviewModel';
import { lifecycleCommand, submitForReviewCommand } from '../seriesCommands';

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

  it('links the public page only where event_view_p5 serves the series (live, paused, ended)', () => {
    for (const s of ['live', 'paused', 'ended']) {
      expect(reviewStrip(s, null).publicPage).toBe(true);
      expect(reviewStrip(s, null).previewNote).toBeNull();
    }
    for (const s of ['draft', 'pending_review', 'rejected', 'archived']) {
      expect(reviewStrip(s, null).publicPage).toBe(false);
      expect(reviewStrip(s, null).previewNote).toMatch(/once it is live/);
    }
  });
});

describe('submitForReviewCommand', () => {
  it('is series.set_lifecycle to pending_review, the one key the server reads', () => {
    expect(submitForReviewCommand()).toEqual({ kind: 'series.set_lifecycle', payload: { to: 'pending_review' } });
    expect(submitForReviewCommand()).toEqual(lifecycleCommand('pending_review'));
  });
});
