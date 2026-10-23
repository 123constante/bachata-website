// @vitest-environment jsdom
/**
 * B-S8 (a): on iOS Safari a tap does not focus the button it lands on, so the
 * opener SheetView records is <body> and VoiceOver restarts at the top. jsdom
 * behaves the same way (fireEvent.click moves no focus), which is what these
 * rows rely on. Every SheetView call site passes the opener it was opened from.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { useState } from 'react';

vi.mock('@/components/account/profiles/signOutToHome', () => ({
  SIGN_OUT_FAILED: 'x',
  useSignOutToHome: () => ({ signOutToHome: vi.fn(), busy: false }),
}));

import { SignOutSheet } from '../more/SignOutSheet';

afterEach(cleanup);

const ROOT = join(__dirname, '..');
const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return name === '__tests__' ? [] : walk(p);
    return /\.tsx$/.test(name) ? [p] : [];
  });

describe('B-S8 (a): every SheetView call site hands focus back to its opener', () => {
  const sites = walk(ROOT)
    .map((p) => ({ file: relative(ROOT, p).split('\\').join('/'), src: readFileSync(p, 'utf8') }))
    .filter(({ file, src }) => file !== 'ui/SheetView.tsx' && /<SheetView\b/.test(src));
  it('the known call sites are all found (the review named four; the leave and onboarding sign-out sheets are two more)', () => {
    expect(sites.map((s) => s.file).sort()).toEqual([
      'dates/DateSheet.tsx', 'events/EditorSheet.tsx', 'events/EventPage.tsx', 'events/ProgrammeSheet.tsx', 'events/SeriesOrganisers.tsx', 'home/onboarding/OrganiserSheet.tsx',
      'home/onboarding/SignOutLine.tsx', 'more/SignOutSheet.tsx', 'more/index.tsx', 'organisers/OrganisersScreen.tsx', 'sessions/SessionSheet.tsx',
    ]);
  });
  it.each(sites.map((s) => [s.file, s.src]))('%s passes returnFocusRef', (_f, src) => {
    const tags = [...src.matchAll(/<SheetView\b(?:=>|[^>])*>/g)].map((m) => m[0]); // an arrow's => is not the tag's end
    expect(tags.length).toBeGreaterThan(0);
    for (const t of tags) expect(t).toMatch(/returnFocusRef=\{/);
  });
});

function SignOutHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" data-testid="opener" onClick={() => setOpen(true)}>Sign out</button>
      <SignOutSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}

describe('B-S8 (a): a tapped (not focused) opener gets focus back', () => {
  it('Sign out: "No, stay signed in" returns focus to the row that opened it', async () => {
    render(<SignOutHarness />);
    const opener = screen.getByTestId('opener');
    fireEvent.pointerDown(opener);
    fireEvent.click(opener); // no focus moves: the opener SheetView records is <body>, as on iOS
    fireEvent.click(await screen.findByTestId('signout-no'));
    await waitFor(() => expect(screen.queryByTestId('signout-sheet')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(opener));
  });
});
