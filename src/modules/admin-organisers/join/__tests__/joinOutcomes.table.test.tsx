// @vitest-environment jsdom
/** Redeem outcome x {after sign-in, join tap} -> screen. One shared mapping; text never claims an action that did not happen. */
import { describe, expect, it, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { redeemAction, type JoinRedeemOutcome } from '../joinModel';
import { EmailStep, StopScreen } from '../JoinScreens';

afterEach(cleanup);

const OUTCOMES: { o: JoinRedeemOutcome; act: string; stop?: string }[] = [
  { o: { kind: 'done', organiserId: 'o1', alreadyMember: false }, act: 'done' },
  { o: { kind: 'not_linked' }, act: 'stop', stop: 'not_linked' },
  { o: { kind: 'dead', reason: 'used' }, act: 'refetch_preview' },
  { o: { kind: 'wrong_account', emailHint: 'a***@x.com' }, act: 'stop', stop: 'wrong_account' },
  { o: { kind: 'email_unproven' }, act: 'stop', stop: 'email_unproven' },
  { o: { kind: 'rate_limited' }, act: 'stop', stop: 'rate_limited' },
  { o: { kind: 'profile_incomplete' }, act: 'refetch_completion' },
  { o: { kind: 'sign_in' }, act: 'sign_out' },
  { o: { kind: 'refused', reason: 'org_inactive', emailHint: null }, act: 'stop', stop: 'refused' },
  { o: { kind: 'failed' }, act: 'stop', stop: 'network' },
];

describe('redeem outcome mapping (shared by sign-in and join tap)', () => {
  for (const row of OUTCOMES) {
    it(`${row.o.kind} -> ${row.act}${row.stop ? '/' + row.stop : ''}`, () => {
      const a = redeemAction(row.o);
      expect(a.act).toBe(row.act);
      if (a.act === 'stop') {
        expect(a.stop.kind).toBe(row.stop);
        const { container } = render(
          <MemoryRouter><StopScreen stop={a.stop} preview={null} signedInAs="me@x.com" busy={false} error={null} onRetry={() => {}} onSwitch={() => {}} onDismiss={() => {}} /></MemoryRouter>,
        );
        const text = container.textContent ?? '';
        // "We've told" only for not_linked.
        expect(/told/i.test(text)).toBe(a.stop.kind === 'not_linked');
        // One primary action (a button or link) is on screen.
        expect(container.querySelectorAll('button,a').length).toBeGreaterThan(0);
      }
    });
  }
});

describe('Send my code is never a dead control', () => {
  it('an empty tap hands an empty string up; the page validates', () => {
    const onSend = vi.fn();
    render(<EmailStep initial="" busy={false} error={null} onSend={onSend} />);
    const btn = screen.getByTestId('join-send') as HTMLButtonElement;
    expect(btn.disabled).toBe(false);
    expect(screen.getByTestId('join-why').textContent).not.toBe('');
    fireEvent.click(btn);
    // The page owns validation; the step hands the typed value up so the bad-shape error can show.
    expect(onSend).toHaveBeenCalledWith('');
  });
});
