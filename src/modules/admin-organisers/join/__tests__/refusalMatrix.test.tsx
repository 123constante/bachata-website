// @vitest-environment jsdom
/**
 * Login audit 2026-10-29, FIX LATER L2 / L3 / L4 / L6: every redeem refusal reason x every screen that
 * can show it. ONE mapping (REDEEM_COPY via reasonScreen) says the words AND the next action -- the
 * help link, the Try again button, or a disabled Try again with its reason -- and the screens only
 * render what the mapping says. The rows marked L2/L3/L4/L6 failed on the code before this fix.
 */
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { SIGNUP_HELP_WHATSAPP_URL } from '@/lib/auth-otp-routing';
import { REDEEM_COPY, reasonScreen } from '../../inviteModel';
import { DeadScreen, StopScreen } from '../JoinScreens';
import { interpretJoinRedeem, type DeadReason, type JoinPreview, type JoinRedeemOutcome, type JoinStop } from '../joinModel';

afterEach(cleanup);

const PREVIEW: JoinPreview = { status: 'open', organiserName: 'Sensual Vibes', inviterFirstName: 'Ricky', emailHint: null, person: null, prefill: null };
const WAIT = 'Please wait an hour before trying again.';

/** The stop JoinPage shows for an outcome after the Join tap (mirrors JoinPage.join()). null = no stop screen. */
function stopFor(o: JoinRedeemOutcome): JoinStop | null {
  switch (o.kind) {
    case 'not_linked': return { kind: 'not_linked' };
    case 'wrong_account': return { kind: 'wrong_account', emailHint: o.emailHint };
    case 'email_unproven': return { kind: 'email_unproven' };
    case 'rate_limited': return { kind: 'rate_limited', from: 'join' };
    case 'refused': return { kind: 'refused', reason: o.reason, emailHint: o.emailHint };
    case 'failed': return { kind: 'network', from: 'join' };
    default: return null;
  }
}

type Retry = 'none' | 'enabled' | 'disabled';
interface Row { reason: string; kind: JoinRedeemOutcome['kind']; title: string | null; help: boolean; retry: Retry }

/** Every reason the live redeem_organiser_invite_v1 body returns, plus an unknown one and an empty answer. */
const ROWS: Row[] = [
  { reason: 'sign_in_required', kind: 'sign_in', title: null, help: false, retry: 'none' },
  { reason: 'authentication_required', kind: 'sign_in', title: null, help: false, retry: 'none' },
  // L3: its own words, never a silent sign-out.
  { reason: 'unconfirmed_account', kind: 'refused', title: 'Confirm your account first', help: false, retry: 'none' },
  // L6: Try again is shown disabled, with the reason, never an immediate retry.
  { reason: 'rate_limited', kind: 'rate_limited', title: 'Too many tries', help: false, retry: 'disabled' },
  { reason: 'profile_incomplete', kind: 'profile_incomplete', title: null, help: false, retry: 'none' },
  { reason: 'email_mismatch', kind: 'wrong_account', title: 'This link is for a different email', help: false, retry: 'none' },
  { reason: 'email_unproven', kind: 'email_unproven', title: 'Sign in with a code to continue', help: false, retry: 'none' },
  { reason: 'not_linked', kind: 'not_linked', title: 'We couldn’t join your profiles automatically', help: false, retry: 'none' },
  { reason: 'invalid', kind: 'dead', title: null, help: false, retry: 'none' },
  { reason: 'used', kind: 'dead', title: null, help: false, retry: 'none' },
  { reason: 'revoked', kind: 'dead', title: null, help: false, retry: 'none' },
  { reason: 'expired', kind: 'dead', title: null, help: false, retry: 'none' },
  // L2: the copy says "ask the Bachata Calendar team", so the screen carries the way to ask.
  { reason: 'team_full', kind: 'refused', title: 'This team is full', help: true, retry: 'none' },
  // L4: an unknown reason is the retryable fallback, with Try again as well as the home link.
  { reason: 'brand_new_reason', kind: 'refused', title: 'Something went wrong', help: false, retry: 'enabled' },
  { reason: '', kind: 'failed', title: 'Something went wrong', help: false, retry: 'enabled' },
];

const renderStop = (stop: JoinStop) => render(
  <MemoryRouter>
    <StopScreen stop={stop} preview={PREVIEW} signedInAs="ana@example.com" busy={false} error={null} onRetry={() => {}} onSwitch={() => {}} onDismiss={() => {}} />
  </MemoryRouter>,
);

const helpLinks = () => Array.from(document.querySelectorAll<HTMLAnchorElement>('a')).filter((a) => a.getAttribute('href') === SIGNUP_HELP_WHATSAPP_URL);

describe('the server reason -> outcome (one mapping)', () => {
  it.each(ROWS)('$reason -> $kind', ({ reason, kind }) => {
    expect(interpretJoinRedeem({ ok: false, reason: reason || undefined }, null).kind).toBe(kind);
  });
  it('every reason REDEEM_COPY knows is a row here', () => {
    const covered = new Set(ROWS.map((r) => r.reason));
    expect(Object.keys(REDEEM_COPY).filter((r) => !covered.has(r))).toEqual([]);
  });
});

describe('the post-Join stop screen: every reason x its words and its next action', () => {
  it.each(ROWS.filter((r) => r.title !== null && r.kind !== 'dead'))('$reason: "$title", help=$help, retry=$retry', ({ reason, title, help, retry }) => {
    const stop = stopFor(interpretJoinRedeem({ ok: false, reason: reason || undefined }, null));
    expect(stop).not.toBeNull();
    renderStop(stop!);
    expect(screen.getByRole('heading').textContent).toBe(title);
    expect(helpLinks()).toHaveLength(help ? 1 : 0);
    const btn = screen.queryByTestId('join-retry') as HTMLButtonElement | null;
    if (retry === 'none') expect(btn).toBeNull();
    else {
      expect(btn).not.toBeNull();
      expect(btn!.disabled).toBe(retry === 'disabled');
    }
    // Never a raw code on screen.
    if (reason) expect(document.body.textContent).not.toContain(reason);
  });

  it('a disabled Try again says why, tied to the button', () => {
    renderStop({ kind: 'rate_limited', from: 'join' });
    const btn = screen.getByTestId('join-retry') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    const why = document.getElementById(btn.getAttribute('aria-describedby') ?? '');
    expect(why?.textContent).toBe(WAIT);
  });

  it('every refusal and failure keeps the home link (never a dead end)', () => {
    for (const r of ROWS.filter((x) => x.kind === 'refused' || x.kind === 'rate_limited' || x.kind === 'failed')) {
      renderStop(stopFor(interpretJoinRedeem({ ok: false, reason: r.reason || undefined }, null))!);
      expect(screen.getByTestId('invite-home')).toBeTruthy();
      cleanup();
    }
  });

  it('a code-send rate limit ("wait a minute") still offers Try again: it returns to the email box, it does not resend', () => {
    renderStop({ kind: 'rate_limited', from: 'code' });
    expect((screen.getByTestId('join-retry') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('the mapping itself: one place for words and next action', () => {
  it('rate_limited carries its wait reason; nothing else blocks the retry', () => {
    expect(reasonScreen('rate_limited').retryBlocked).toBe(WAIT);
    expect(Object.keys(REDEEM_COPY).filter((r) => REDEEM_COPY[r].retryBlocked)).toEqual(['rate_limited']);
  });
  it('team_full is the only reason that offers the WhatsApp help link', () => {
    expect(Object.keys(REDEEM_COPY).filter((r) => REDEEM_COPY[r].help)).toEqual(['team_full']);
  });
  it('the unknown-reason fallback offers Try again', () => {
    expect(reasonScreen('brand_new_reason').action).toBe('retry');
  });
});

describe('the dead-link screen (same mapping): every finished-with reason, no retry, no help', () => {
  it.each(ROWS.filter((r) => r.kind === 'dead').map((r) => r.reason as DeadReason))('%s', (reason) => {
    render(<MemoryRouter><DeadScreen reason={reason} preview={PREVIEW} newLink={null} /></MemoryRouter>);
    expect(screen.getByRole('heading').textContent).toBe(REDEEM_COPY[reason].title);
    expect(screen.queryByTestId('join-retry')).toBeNull();
    expect(helpLinks()).toHaveLength(0);
    expect(screen.getByTestId('invite-home')).toBeTruthy();
  });
});
