// @vitest-environment jsdom
//
// SeeAllGuestsDrawer has NO importer anywhere in this repo -- it is the only orphan of the
// seven components in bento/modals/, and GuestListBlock renders every pill inline with no
// truncation and no "see all" affordance to open it. It is the UNBUILT HALF of that feature
// rather than dead code: the bento grid gives `guest` a minH with no maximum and the pill
// list has no max-height, so a 200-name night grows the block without bound, which is
// exactly what a truncated preview plus this drawer would fix. Whether to wire it up is a
// live UI decision (docs/open-loops.md), not one a test file should make.
//
// What this file does is stop it being edited BLIND, which is what P6 had to do when it
// added the active/waitlist split below. It needs its own file because it needs a DOM:
// under the repo-default `node` environment the drawer renders EMPTY markup -- measured,
// not assumed -- so renderToStaticMarkup, the WeeksLadderBlock idiom used for the block
// itself, cannot see any of this.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { SeeAllGuestsDrawer } from '@/modules/event-page/bento/modals/SeeAllGuestsDrawer';
import type { GuestListEntry } from '@/modules/event-page/hooks/useEventGuestList';

let seq = 0;
const entry = (first_name: string, status?: 'active' | 'waitlist'): GuestListEntry => ({
  first_name,
  created_at: `2026-08-27T20:0${(seq += 1) % 10}:00Z`,
  ...(status ? { status } : {}),
});

const open = (entries: GuestListEntry[]) => {
  render(<SeeAllGuestsDrawer open onOpenChange={() => {}} entries={entries} />);
};

// This repo runs vitest WITHOUT globals, so testing-library never finds an `afterEach` to
// register its automatic cleanup on and every render accumulates in the same document.
// Left implicit, the queries below match names left behind by earlier cases and the file
// fails with "found multiple elements" on assertions that are actually correct.
afterEach(cleanup);

describe('SeeAllGuestsDrawer — P6 active/waitlist split', () => {
  it('titles itself with the ACTIVE count so it cannot disagree with the block', () => {
    // The block headline is active-only after P6. If this drawer counted entries.length the
    // two surfaces would report different sizes for the same list on the same screen.
    open([entry('Ana'), entry('Zed', 'waitlist')]);
    const title = screen.getByText(/Guest list/i);
    expect(title.textContent).toContain('(1)');
    expect(title.textContent).toContain('+1 waiting');
  });

  it('omits the waiting badge entirely when nobody is queued', () => {
    open([entry('Ana'), entry('Bea')]);
    const title = screen.getByText(/Guest list/i);
    expect(title.textContent).toContain('(2)');
    expect(title.textContent).not.toContain('waiting');
  });

  it('tags each queued row and leaves active rows untagged', () => {
    open([entry('Ana'), entry('Yan', 'waitlist'), entry('Zed', 'waitlist')]);
    expect(screen.getAllByText('Waitlist')).toHaveLength(2);

    const ana = screen.getByText('Ana').closest('li');
    expect(ana).not.toBeNull();
    expect(within(ana as HTMLElement).queryByText('Waitlist')).toBeNull();
  });

  it('treats a row with no status as active, matching the pre-P6 payload', () => {
    // A cached response minted before the migration published no status at all, and
    // entryStatus() resolves that to 'active'. It must not paint the whole list amber.
    open([entry('Ana'), entry('Bea'), entry('Cal')]);
    expect(screen.queryByText('Waitlist')).toBeNull();
    expect(screen.getByText(/Guest list/i).textContent).toContain('(3)');
  });

  it('says the list is empty rather than rendering a bare shell', () => {
    open([]);
    expect(screen.getByText('No names on the guest list yet.')).toBeTruthy();
  });
});
