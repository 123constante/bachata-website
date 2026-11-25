import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  ABOUT_YOU_MESSAGES, buildAboutYouArgs, nextAfterClaim, parseAboutYouResult, validateAboutYou,
} from '../aboutYouModel';

const form = { firstName: ' Ana ', avatarUrl: '', phone: '', email: '', showContact: false };

describe('parseAboutYouResult', () => {
  it('ok is saved', () => {
    expect(parseAboutYouResult({ ok: true, person_id: 'p', profile_complete: true })).toEqual({ kind: 'saved', profileComplete: true });
    expect(parseAboutYouResult({ ok: true })).toEqual({ kind: 'saved', profileComplete: false });
  });
  it.each(Object.keys(ABOUT_YOU_MESSAGES))('refusal %s maps to a message', (reason) => {
    expect(parseAboutYouResult({ ok: false, reason })).toEqual({ kind: 'refused', reason });
    expect(ABOUT_YOU_MESSAGES[reason as keyof typeof ABOUT_YOU_MESSAGES].message.length).toBeGreaterThan(0);
  });
  it('plain words for the named refusals', () => {
    expect(ABOUT_YOU_MESSAGES.email_unverified.message).toBe('Use the email you signed in with.');
    expect(ABOUT_YOU_MESSAGES.contact_required.message).toBe('Add a phone number or email so people can reach you.');
    for (const r of ['not_claimant', 'profile_unavailable', 'feature_off'] as const) expect(ABOUT_YOU_MESSAGES[r].field).toBeNull();
  });
  it('garbage is failed', () => {
    for (const raw of [null, 'x', {}, { ok: false, reason: 'weird' }]) expect(parseAboutYouResult(raw)).toEqual({ kind: 'failed' });
  });
});

describe('validation and args', () => {
  it('only checks email shape', () => {
    expect(validateAboutYou(form)).toBeNull();
    expect(validateAboutYou({ ...form, email: 'nope' })?.field).toBe('email');
    expect(validateAboutYou({ ...form, email: 'a@b.co' })).toBeNull();
  });
  it('blanks become null, show-contact defaults off', () => {
    expect(buildAboutYouArgs(form)).toEqual({ p_first_name: 'Ana', p_avatar_url: null, p_phone: null, p_email: null, p_show_contact_publicly: false });
  });
  it('Continue routes by about_you_needed', () => {
    expect(nextAfterClaim(true)).toBe('about');
    expect(nextAfterClaim(false)).toBe('done');
  });
});

describe('keep-list', () => {
  const page = readFileSync(new URL('../ClaimLinkPage.tsx', import.meta.url), 'utf8');
  it('W1a refusal and email flow is still wired', () => {
    for (const id of ['claim-send', 'claim-try-again', 'claim-retry', 'claim-page-name', 'claim-refusal-']) expect(page).toContain(id);
    expect(page).toContain('redeemClaimLink');
  });
  it('Continue no longer links straight home; Open my page and Skip/later go home or done', () => {
    expect(page).toMatch(/data-testid="claim-continue"/);
    expect(page).toContain('nextAfterClaim');
    expect(page).toContain('data-testid="claim-open-page"');
  });
  it('invite pages, OrganiserSheet and OnboardingView are not imported by the claim module', () => {
    const screen = readFileSync(new URL('../AboutYouScreen.tsx', import.meta.url), 'utf8');
    for (const src of [page, screen]) expect(src).not.toMatch(/OrganiserSheet|OnboardingView/);
  });
});
