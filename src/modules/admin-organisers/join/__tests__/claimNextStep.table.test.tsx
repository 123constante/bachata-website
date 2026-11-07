// @vitest-environment jsdom
/**
 * people-find-before-create (model 2): the ONE claim x invite-kind mapping, and the `unmatched` stop's one control.
 * Every cell's copy names a control that is on screen; with the organiser area off the link is the public site.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CLAIM_STATUSES } from '@/lib/claimMyDancerProfile';
import { StopScreen } from '../JoinScreens';
import { JOIN_COPY } from '../joinCopy';
import { claimNextStep, inviteKind, type ClaimAnswer, type InviteKind, type JoinPreview } from '../joinModel';

afterEach(cleanup);

const BASE: JoinPreview = { status: 'open', organiserName: 'Sensual Vibes', inviterFirstName: 'Ricky', emailHint: null, person: null, prefill: null };
const KINDS: InviteKind[] = ['person', 'email', 'none'];
const ANSWERS: ClaimAnswer[] = [...CLAIM_STATUSES, 'unavailable'];

describe('inviteKind: only the invite’s own proof', () => {
  it.each([
    [{ ...BASE, person: { firstName: 'Papacito', avatarUrl: null, city: null } }, 'person'],
    [{ ...BASE, person: { firstName: 'Papacito', avatarUrl: null, city: null }, emailHint: 'a***@x.com' }, 'person'],
    [{ ...BASE, emailHint: 'a***@x.com' }, 'email'],
    [BASE, 'none'],
    [null, 'none'],
  ] as const)('%j -> %s', (p, kind) => {
    expect(inviteKind(p)).toBe(kind);
  });
});

describe('claimNextStep: every claim answer x invite kind has exactly one next step', () => {
  it.each(ANSWERS.flatMap((a) => KINDS.map((k) => [a, k] as const)))('%s x %s', (answer, kind) => {
    const next = claimNextStep(answer, kind);
    expect(['continue', 'safety_redeem', 'unmatched']).toContain(next);
    // Only a person-bound invite ever redeems before the Join tap.
    if (next === 'safety_redeem') expect(kind).toBe('person');
    // A link that landed, or a claim that could not run, never stops the sign-in.
    if (answer === 'linked' || answer === 'already_linked' || answer === 'unavailable' || answer === 'not_applicable') expect(next).toBe('continue');
  });
});

describe('the unmatched stop: one control, named by the copy', () => {
  it.each([
    [{ organiserP3: false, organiserSelfServe: false }, JOIN_COPY.done.buttonOff, '/'],
    [{ organiserP3: false, organiserSelfServe: true }, JOIN_COPY.done.button, null],
  ] as const)('flags %j -> "%s"', (homeFlags, label, href) => {
    render(
      <MemoryRouter>
        <StopScreen stop={{ kind: 'unmatched' }} preview={BASE} signedInAs="ana@example.com" busy={false} error={null} onRetry={() => {}} onSwitch={() => {}} onDismiss={() => {}} homeFlags={homeFlags} />
      </MemoryRouter>,
    );
    const link = screen.getByTestId('join-unmatched-home');
    expect(link.textContent).toBe(label);
    if (href) expect(link.getAttribute('href')).toBe(href);
    expect(link.getAttribute('href')).not.toContain('/invite');
    expect(screen.getByTestId('join-unmatched-next').textContent).toContain(label);
    expect(screen.getByRole('heading').textContent).toBe(JOIN_COPY.unmatched.heading);
    // Never a raw code, never a promise that someone was told (nothing was recorded on this path).
    expect(document.body.textContent).not.toMatch(/ambiguous|email_unproven|no_match|told/);
    // One action only: no retry, no switch-account, no About.
    expect(screen.queryByTestId('join-retry')).toBeNull();
    expect(screen.queryByTestId('invite-switch-account')).toBeNull();
    expect(screen.getAllByRole('link')).toHaveLength(1);
  });
});
