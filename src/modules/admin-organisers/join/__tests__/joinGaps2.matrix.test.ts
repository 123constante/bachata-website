import { describe, expect, it } from 'vitest';
import { bannerModel } from '@/lib/profileCompletion';
import { NEW_LINK_ALREADY_COPY, NEW_LINK_SENT_COPY, REDEEM_COPY, newLinkResultCopy, reasonScreen } from '../../inviteModel';
import { JOIN_COPY, doneBody } from '../joinCopy';
import { timePromise } from '@/modules/organiser/p3/onboarding/graceModel';

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

  // Item 7: J3 Done, rows left 0/1/3/6/10/unknown -> one rule, timePromise is the only time source.
  it.each([[10, false], [6, false], [3, false], [1, false], [null, false], [undefined, false], [0, true]])('rows left %s -> everything-yours=%s', (left, yours) => {
    const body = doneBody(left as number | null);
    if (yours) expect(body).toBe(JOIN_COPY.done.body);
    else {
      expect(body).toBe([JOIN_COPY.done.bodyDetailsFirst, timePromise((left as number | null) ?? null)].filter(Boolean).join(' '));
      expect(body).not.toMatch(/Everything/);
    }
  });
  it('time grows with rows left, never claims a time for unknown', () => {
    expect(doneBody(3)).toMatch(/minute or two/);
    expect(doneBody(6)).toMatch(/three minutes/);
    expect(doneBody(10)).toMatch(/five minutes/);
    expect(doneBody(null)).not.toMatch(/minute/);
  });
  it('item 6 label names the team, not the inviter', () => expect(reasonScreen('expired', { inviterFirstName: 'Marta' }).newLinkLabel).toBe('Ask the team for a new one'));

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
