/** @vitest-environment jsdom */
// fix-join-copy-r1: every join screen/card state x the four rough edges (constant step total,
// one possessive, visible email placeholder, a plain "what to do" line on dead-link cards).
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { JOIN_COPY, ASK_FOR_NEW_LINK, askForNewLinkLine, possessive } from '../joinCopy';
import { joinProgress } from '../joinModel';
import { DeadScreen, DoneScreen, EmailStep, StopScreen } from '../JoinScreens';

afterEach(cleanup);
const wrap = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);
const preview = (organiserName: string) => ({ status: 'open' as const, organiserName, inviterFirstName: 'Sam', emailHint: null });

const NAMES: [string, string][] = [
  ['Alex Boneva Teachings', 'Alex Boneva Teachings’'],
  ['Bachata Moves', 'Bachata Moves’'],
  ['Luna', 'Luna’s'],
  ["O'Neil Dance", "O'Neil Dance’s"],
];

describe('possessive: one helper, every screen that builds one', () => {
  it.each(NAMES)('%s -> %s', (name, want) => {
    expect(possessive(name)).toBe(want);
    expect(JOIN_COPY.done.heading(name)).toBe(`You’re on ${want} team.`);
    expect(JOIN_COPY.join.card(name)).toContain(`events of ${name}`);
    expect(JOIN_COPY.join.card(name)).not.toMatch(/s’s|s's/);
  });
  it('the done screen renders it', () => {
    wrap(<DoneScreen org="Alex Boneva Teachings" flags={{ organiserP3: false, organiserSelfServe: true }} organiserId={null} />);
    expect(screen.getByTestId('join-done').textContent).toBe('You’re on Alex Boneva Teachings’ team.');
  });
});

describe('step total is constant across one journey', () => {
  it.each(['signed_out', 'incomplete', 'complete', 'loading'] as const)('completion %s: email, code, join, done all say of 3', (c) => {
    for (const step of ['email', 'code', 'about', 'join', 'done'] as const) expect(joinProgress(step, c)?.total).toBe(3);
    expect(joinProgress('join', c)?.n).toBe(3);
  });
});

describe('signed-out email field', () => {
  it('has a visible placeholder and an explicit 16px size', () => {
    wrap(<EmailStep initial="" busy={false} error={null} onSend={() => {}} />);
    const input = screen.getByTestId('join-email-input') as HTMLInputElement;
    expect(input.placeholder).toBe('you@example.com');
    expect(input.className).toContain('text-[16px]');
    expect(input.className).toMatch(/border-foreground/);
  });
});

describe('dead-link cards say what to do next', () => {
  it.each(['used', 'revoked', 'expired'] as const)('DeadScreen %s: the button is the next step, no duplicate line', (reason) => {
    wrap(<DeadScreen reason={reason} preview={preview('Alex Boneva Teachings')} newLink={<button data-testid="ask-btn">Ask</button>} />);
    expect(screen.getByTestId('ask-btn')).toBeTruthy();
    expect(screen.queryByTestId('invite-next')).toBeNull();
  });
  it('DeadScreen invalid: no button, so the line carries the next step', () => {
    wrap(<DeadScreen reason="invalid" preview={preview('Alex Boneva Teachings')} newLink={null} />);
    expect(screen.getByTestId('invite-next').textContent).toBe(ASK_FOR_NEW_LINK);
    expect(screen.getByRole('heading').textContent).not.toBe('');
  });
  it.each(['invalid', 'used', 'revoked', 'expired'] as const)('StopScreen refused %s', (reason) => {
    wrap(<StopScreen stop={{ kind: 'refused', reason, emailHint: null }} preview={preview('Luna')} signedInAs="a@b.co" busy={false} error={null} onRetry={() => {}} onSwitch={() => {}} onDismiss={() => {}} />);
    expect(screen.getByTestId('invite-next').textContent).toBe(ASK_FOR_NEW_LINK);
  });
  it.each(['email_mismatch', 'rate_limited', 'team_full', 'sign_in_required'])('no extra line for %s', (reason) => {
    expect(askForNewLinkLine(reason)).toBeNull();
  });
});
