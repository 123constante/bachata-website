// @vitest-environment jsdom
/**
 * Duplicate-account linking on My tickets (brief docs/briefs/onboard-dups-website.md).
 * Mocked at the RPC edge (rpcLoose): request/confirm/list/unlink return the exact jsonb shapes
 * read from prod. Flag off ('disabled') = nothing renders; every refusal maps to its sentence.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const rpcLoose = vi.hoisted(() => vi.fn());
vi.mock('@/integrations/supabase/rpcLoose', () => ({ rpcLoose }));

import { AccountLinkPanel, LINK_OPEN, unlinkConfirmLine } from '../AccountLinkPanel';
import { ACCOUNT_LINK_RPC, LINK_ERROR_COPY, SENT_LINE, linkErrorLine, linkedLine, parseLinks } from '../../../api/accountLink';

type Answers = Partial<Record<string, unknown[]>>;
/** Each RPC name -> a queue of `data` answers (last one repeats). */
function backend(answers: Answers) {
  const q: Record<string, unknown[]> = { ...answers } as Record<string, unknown[]>;
  rpcLoose.mockImplementation(async (fn: string) => {
    const list = q[fn] ?? [{ ok: false, error: 'disabled' }];
    const data = list.length > 1 ? list.shift() : list[0];
    if (data instanceof Error) throw data;
    return { data, error: null };
  });
}
const LINK = { user_id: '00000000-0000-4000-8000-000000000002', email: 'old@example.com', linked_at: '2026-11-18T10:00:00Z' };
const calls = (fn: string) => rpcLoose.mock.calls.filter((c) => c[0] === fn);

const mount = async (onLinked = vi.fn()) => {
  render(<AccountLinkPanel onLinked={onLinked} />);
  await act(async () => { await Promise.resolve(); });
  return onLinked;
};
const openAndSend = async (email = 'old@example.com') => {
  fireEvent.click(screen.getByTestId('account-link-open'));
  fireEvent.change(screen.getByTestId('account-link-email'), { target: { value: email } });
  await act(async () => { fireEvent.click(screen.getByTestId('account-link-send')); });
};
const typeCode = async (code: string) => {
  await act(async () => { fireEvent.change(screen.getByLabelText('Digit 1'), { target: { value: code } }); });
};

beforeEach(() => rpcLoose.mockReset());
afterEach(cleanup);

describe('flag gate', () => {
  it.each([
    ['flag off', { ok: false, error: 'disabled' }],
    ['signed out', { ok: false, error: 'not_signed_in' }],
    ['garbage', null],
  ])('%s: nothing renders', async (_n, data) => {
    backend({ [ACCOUNT_LINK_RPC.list]: [data] });
    await mount();
    expect(screen.queryByTestId('account-link-panel')).toBeNull();
    expect(calls(ACCOUNT_LINK_RPC.request)).toHaveLength(0);
  });
  it('transport throw: nothing renders, no crash', async () => {
    backend({ [ACCOUNT_LINK_RPC.list]: [new Error('net')] });
    await mount();
    expect(screen.queryByTestId('account-link-panel')).toBeNull();
  });
  it('flag on: the quiet link shows, no list when there are no links', async () => {
    backend({ [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [] }] });
    await mount();
    expect(screen.getByTestId('account-link-open').textContent).toBe(LINK_OPEN);
    expect(screen.queryByTestId('account-link-list')).toBeNull();
  });
  it('disabled mid-flow (request answers disabled): the whole panel hides', async () => {
    backend({ [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [] }], [ACCOUNT_LINK_RPC.request]: [{ ok: false, error: 'disabled' }] });
    await mount();
    await openAndSend();
    expect(screen.queryByTestId('account-link-panel')).toBeNull();
  });
});

describe('error copy', () => {
  it('every DB refusal code has its own sentence; unknown falls back', () => {
    for (const code of ['invalid_email', 'own_email', 'rate_limited', 'not_signed_in', 'wrong_code', 'expired', 'too_many_attempts', 'no_pending_request']) {
      expect(LINK_ERROR_COPY[code]).toBeTruthy();
      expect(linkErrorLine(code)).toBe(LINK_ERROR_COPY[code]);
    }
    expect(linkErrorLine('weird_new_code')).toBe(LINK_ERROR_COPY.error);
  });

  it.each(['own_email', 'rate_limited', 'invalid_email', 'not_signed_in'])('request %s -> its sentence, stays on the email step', async (code) => {
    backend({ [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [] }], [ACCOUNT_LINK_RPC.request]: [{ ok: false, error: code }] });
    await mount();
    await openAndSend();
    expect(screen.getByTestId('account-link-error').textContent).toBe(LINK_ERROR_COPY[code]);
    expect(screen.getByTestId('account-link-email')).toBeTruthy();
  });

  it('a bad email is refused locally, no RPC', async () => {
    backend({ [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [] }] });
    await mount();
    await openAndSend('not-an-email');
    expect(screen.getByTestId('account-link-error').textContent).toBe(LINK_ERROR_COPY.invalid_email);
    expect(calls(ACCOUNT_LINK_RPC.request)).toHaveLength(0);
  });

  it.each([
    ['wrong_code', 'Change email'],
    ['expired', 'Send a new code'],
    ['too_many_attempts', 'Send a new code'],
    ['no_pending_request', 'Send a new code'],
  ])('confirm %s -> its sentence and a way forward (%s)', async (code, way) => {
    backend({ [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [] }], [ACCOUNT_LINK_RPC.request]: [{ ok: true }], [ACCOUNT_LINK_RPC.confirm]: [{ ok: false, error: code }] });
    await mount();
    await openAndSend();
    await typeCode('123456');
    expect(screen.getByTestId('account-link-error').textContent).toBe(LINK_ERROR_COPY[code]);
    expect(screen.getByTestId('account-link-new').textContent).toBe(way);
    // Boxes cleared for a retry (checkout behaviour).
    expect((screen.getByLabelText('Digit 1') as HTMLInputElement).value).toBe('');
  });
});

describe('happy path', () => {
  it('send -> neutral line; 6th digit auto-checks; success line + My tickets refetch + list reload', async () => {
    backend({
      [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [] }, { ok: true, links: [LINK] }],
      [ACCOUNT_LINK_RPC.request]: [{ ok: true }],
      [ACCOUNT_LINK_RPC.confirm]: [{ ok: true, linked_user_id: LINK.user_id }],
    });
    const onLinked = await mount();
    await openAndSend(' old@example.com ');
    expect(calls(ACCOUNT_LINK_RPC.request)[0][1]).toEqual({ p_other_email: 'old@example.com' });
    expect(screen.getByTestId('account-link-sent').textContent).toBe(SENT_LINE);
    for (let i = 1; i <= 5; i++) fireEvent.change(screen.getByLabelText(`Digit ${i}`), { target: { value: String(i) } });
    expect(calls(ACCOUNT_LINK_RPC.confirm)).toHaveLength(0);
    await act(async () => { fireEvent.change(screen.getByLabelText('Digit 6'), { target: { value: '6' } }); });
    expect(calls(ACCOUNT_LINK_RPC.confirm)[0][1]).toEqual({ p_code: '123456' });
    expect(screen.getByTestId('account-link-done').textContent).toBe(linkedLine('old@example.com'));
    expect(onLinked).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getAllByTestId('account-link-row')).toHaveLength(1));
  });

  it('unlink asks first, then calls unlink_account_v1 with the row id and refetches', async () => {
    backend({
      [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [LINK] }, { ok: true, links: [] }],
      [ACCOUNT_LINK_RPC.unlink]: [{ ok: true, unlinked: true }],
    });
    const onLinked = await mount();
    fireEvent.click(screen.getByTestId('account-unlink'));
    expect(screen.getByText(unlinkConfirmLine(LINK.email))).toBeTruthy();
    expect(calls(ACCOUNT_LINK_RPC.unlink)).toHaveLength(0);
    await act(async () => { fireEvent.click(screen.getByTestId('account-unlink-confirm')); });
    expect(calls(ACCOUNT_LINK_RPC.unlink)[0][1]).toEqual({ p_other_user_id: LINK.user_id });
    expect(onLinked).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.queryByTestId('account-link-list')).toBeNull());
  });

  it('parseLinks drops malformed rows', () => {
    expect(parseLinks([LINK, { user_id: 3 }, null, 'x'])).toEqual([{ userId: LINK.user_id, email: LINK.email, linkedAt: LINK.linked_at }]);
    expect(parseLinks(undefined)).toEqual([]);
  });

  it('an unlinked row leaves the list even when the re-read fails', async () => {
    backend({
      [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [LINK] }, new Error('net')],
      [ACCOUNT_LINK_RPC.unlink]: [{ ok: true, unlinked: true }],
    });
    await mount();
    fireEvent.click(screen.getByTestId('account-unlink'));
    await act(async () => { fireEvent.click(screen.getByTestId('account-unlink-confirm')); });
    expect(screen.queryByTestId('account-link-row')).toBeNull();
  });

  it('with one order in view the success line does not promise the card shows them', () => {
    expect(linkedLine('a@b.co', true)).toBe('Linked. Tickets from a@b.co now show on this account.');
    expect(linkedLine('a@b.co')).toBe('Linked. Tickets from a@b.co now show here.');
  });

  it('typing over a filled box replaces that digit only (not treated as a paste)', async () => {
    backend({ [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [] }], [ACCOUNT_LINK_RPC.request]: [{ ok: true }] });
    await mount();
    await openAndSend();
    for (let i = 1; i <= 3; i++) fireEvent.change(screen.getByLabelText(`Digit ${i}`), { target: { value: String(i) } });
    fireEvent.change(screen.getByLabelText('Digit 2'), { target: { value: '29' } });
    const vals = [1, 2, 3, 4].map((i) => (screen.getByLabelText(`Digit ${i}`) as HTMLInputElement).value);
    expect(vals).toEqual(['1', '9', '3', '']);
  });
});

describe('email step a11y (390x844 walk nit)', () => {
  it('a refusal is tied to the field, and the field is not auto-capitalised', async () => {
    backend({ [ACCOUNT_LINK_RPC.list]: [{ ok: true, links: [] }] });
    await mount();
    fireEvent.click(screen.getByTestId('account-link-open'));
    const input = screen.getByTestId('account-link-email');
    expect(input.getAttribute('autocapitalize')).toBe('none');
    expect(input.getAttribute('aria-invalid')).toBeNull();
    fireEvent.change(input, { target: { value: 'nope' } });
    await act(async () => { fireEvent.click(screen.getByTestId('account-link-send')); });
    expect(input.getAttribute('aria-invalid')).toBe('true');
    expect(input.getAttribute('aria-describedby')).toBe(screen.getByTestId('account-link-error').id);
  });
});
