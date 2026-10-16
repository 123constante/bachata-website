/**
 * Review round 1 pins for slice 3a+3d.
 *  - S1: the ONE contact address is support@bachatacalendar.co.uk (the mailbox the /privacy page,
 *    Website PR #762, names), and no other source file spells a bachatacalendar.co.uk mailbox.
 *  - S2: the deletion check lives in the sign-in callback, so slice 3b's files carry none of it:
 *    lib/accountRouting and the Continue-as page do not import lib/accountDeletion, and
 *    /account/restore is not behind the dancer-first gate (a hidden account has no live profile).
 *  - S4: the rate-limit copy names the SQL's rolling 24 hours, never "tomorrow".
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ACCOUNT_CONTACT_EMAIL, deleteRefusalMessage } from '../accountDeletionCopy';

const SRC = path.resolve(__dirname, '..', '..');
const read = (rel: string) => readFileSync(path.join(SRC, rel), 'utf8');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((n) => {
    const p = path.join(dir, n);
    if (statSync(p).isDirectory()) return n === '__tests__' ? [] : walk(p);
    return /\.(ts|tsx)$/.test(n) ? [p] : [];
  });

describe('S1: one contact address', () => {
  it('is support@bachatacalendar.co.uk', () => {
    expect(ACCOUNT_CONTACT_EMAIL).toBe('support@bachatacalendar.co.uk');
  });
  it('no other source file spells a bachatacalendar.co.uk mailbox', () => {
    const others = walk(SRC).filter((f) => !f.endsWith(path.join('lib', 'accountDeletionCopy.ts')) && /[\w.+-]+@bachatacalendar\.co\.uk/.test(readFileSync(f, 'utf8')));
    expect(others.map((f) => path.relative(SRC, f))).toEqual([]);
  });
});

describe("S2: none of the deletion check in slice 3b's files", () => {
  it.each(['lib/accountRouting.ts', 'components/account/profiles/ContinueAsPage.tsx'])('%s does not import lib/accountDeletion', (f) => {
    expect(read(f)).not.toMatch(/accountDeletion/);
  });
  it('the sign-in callback runs the check', () => {
    expect(read('pages/AuthCallback.tsx')).toMatch(/signInDeletionTarget\(/);
  });
  it('/account/restore is not behind the dancer-first gate', () => {
    const route = read('components/AnimatedRoutes.tsx').split('\n').find((l) => l.includes('"/account/restore"'));
    expect(route).toBeDefined();
    expect(route).not.toMatch(/DancerProfileGate/);
    expect(read('pages/AccountRestore.tsx')).not.toMatch(/<DancerProfileGate/);
  });
});

describe('S4: the rate-limit window', () => {
  it('names 24 hours, never tomorrow', () => {
    expect(deleteRefusalMessage('rate_limited')).toMatch(/24 hours/);
    expect(deleteRefusalMessage('rate_limited')).not.toMatch(/tomorrow|today/i);
  });
});
