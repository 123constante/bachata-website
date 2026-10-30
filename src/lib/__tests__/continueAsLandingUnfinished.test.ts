import { describe, expect, it } from 'vitest';
import { ORGANISER_HOME_PATH, appWelcomeHref, signInLanding, type SidesFacts } from '@/lib/accountRouting';
import { continueAsLanding } from '@/lib/auth-otp-routing';

// Review r1 F2 (owner click 2026-10-30): an unfinished dancer with no page who is waiting on an open
// access request finishes the dancer profile, then lands on P3 Welcome. Everything else is unchanged.
const START = '/account/p3/start';
const base = (over: Partial<SidesFacts>): SidesFacts => ({
  organisers: [], dancer: 'incomplete', areaAllowed: true, organiserIntent: false, openRequestCount: 1, isAdmin: false, deletion: null, ...over,
});
const unchanged = (f: SidesFacts, p3Live: boolean) => ({ ...signInLanding({ ...f, newOrganiserTo: p3Live ? START : ORGANISER_HOME_PATH }, null) });

describe('unfinished dancer, 0 pages: sign-in landing', () => {
  const cases: { name: string; facts: SidesFacts; p3Live: boolean; want: unknown }[] = [
    { name: 'open request, no organiser intent, P3 on -> dancer profile, then Welcome', facts: base({}), p3Live: true, want: { kind: 'go', to: appWelcomeHref(START) } },
    { name: 'open request, organiser intent, P3 on -> same', facts: base({ organiserIntent: true }), p3Live: true, want: { kind: 'go', to: appWelcomeHref(START) } },
    { name: 'request count not read yet, P3 on -> wait, never the dancer app', facts: base({ openRequestCount: undefined }), p3Live: true, want: { kind: 'wait' } },
    { name: 'no open request, P3 on -> exactly as before', facts: base({ openRequestCount: 0 }), p3Live: true, want: unchanged(base({ openRequestCount: 0 }), true) },
    { name: 'open request, P3 OFF -> exactly as before', facts: base({}), p3Live: false, want: unchanged(base({}), false) },
    { name: 'open request, P3 on, has a page -> exactly as before', facts: base({ organisers: [{ id: 'a', name: 'A', avatar_url: null }] }), p3Live: true, want: unchanged(base({ organisers: [{ id: 'a', name: 'A', avatar_url: null }] }), true) },
    { name: 'open request, P3 on, area not allowed -> exactly as before', facts: base({ areaAllowed: false }), p3Live: true, want: unchanged(base({ areaAllowed: false }), true) },
  ];
  it.each(cases)('$name', ({ facts, p3Live, want }) => {
    expect(continueAsLanding(facts, p3Live)).toEqual(want);
  });
});
