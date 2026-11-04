import { describe, expect, it } from 'vitest';
import { bannerModel } from '@/lib/profileCompletion';
import { NEW_LINK_ALREADY_COPY, NEW_LINK_SENT_COPY, REDEEM_COPY, newLinkResultCopy, reasonScreen } from '../../inviteModel';
import { JOIN_COPY, doneBody } from '../joinCopy';

const incomplete = { status: 'incomplete', missing: ['first_name'], refetch: async () => ({}) } as never;

describe('join gaps 2 (items 5-8), (journey, state) -> exact words', () => {
  // Item 5: J1 About. The site banner is off on /invite/*, unchanged elsewhere.
  it.each([
    ['/invite/abc', false],
    ['/invite/abc?x=1', false],
    ['/parties', true],
    ['/', true],
  ])('banner on %s shown=%s', (pathname, shown) => {
    expect(!!bannerModel(incomplete, { dismissed: false, pathname })).toBe(shown);
  });

  // Item 6: J2 request-new-link answers. No inviter promise, no time, no email promise.
  it.each([
    [{ ok: true }, null, true, NEW_LINK_SENT_COPY],
    [{ ok: false, reason: 'already_requested' }, null, true, NEW_LINK_ALREADY_COPY],
    [{ ok: false, reason: 'rate_limited' }, null, false, 'Try again later.'],
    [{ ok: false, reason: 'invalid' }, null, false, 'This link cannot be renewed from here.'],
  ])('answer %j', (data, err, ok, text) => {
    const r = newLinkResultCopy(data, err);
    expect(r).toEqual({ ok, text });
    if (ok) {
      expect(text).toMatch(/Bachata Calendar team/);
      expect(text).toMatch(/cannot say when/);
      expect(text).not.toMatch(/told|email you|within|hours|day/i);
    }
  });
  it('network failure is a retryable error', () => expect(newLinkResultCopy(null, new Error('x')).ok).toBe(false));

  // Item 7: J3 Done, rows left 10/6/3/1/0/unknown, one rule for both flag states' selfServe body.
  it.each([[10, false], [6, false], [3, false], [1, false], [null, false], [undefined, false], [0, true]])('rows left %s -> everything-yours=%s', (left, yours) => {
    expect(doneBody(left as number | null)).toBe(yours ? JOIN_COPY.done.body : JOIN_COPY.done.bodyDetailsFirst);
    if (!yours) expect(doneBody(left as number | null)).not.toMatch(/Everything/);
  });

  // Item 8: J4 revoked, same words on every viewer/name; never guesses the reason.
  it.each([['Alex'], [null], ['A very long inviter name that goes on and on']])('revoked, inviter %s', (inviter) => {
    const s = reasonScreen('revoked', { inviterFirstName: inviter });
    expect(s.title).toBe('This link was withdrawn');
    expect(s.body).toBe(REDEEM_COPY.revoked.body);
    expect(s.body).toMatch(/Ask for a new one.*message us/);
    expect(s.body).not.toMatch(/replaced|because|newer|admin/i);
    expect(s.offerNewLink).toBe(true);
  });
});
