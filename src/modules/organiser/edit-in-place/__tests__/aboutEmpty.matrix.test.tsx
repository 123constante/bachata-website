// @vitest-environment jsdom
/**
 * The owner's empty About line carries the real bio pencil (aboutEmptyPencil).
 *
 * {no bio, bio set, bio drafted but unsaved} x {owner with the edit layer, visitor},
 * on both callers of the slots:
 *  - public: src/pages/OrganiserProfile.tsx picks `slot(ep.bio ? 'about' : 'about-empty')`;
 *  - page:   src/modules/organiser/page/index.tsx renders 'about-empty' (no bio) AND 'about'
 *            unconditionally, so it must still get exactly ONE bio pencil;
 *  - blank:  src/pages/OrganiserProfile.tsx in the owner-blank state (no bio, no events): the hero
 *            renders 'about-empty' AND the empty state's "Add a bio" pill renders 'about'.
 * 'public' is therefore the owner with no bio but with events (past the blank state).
 *
 * Red first (2026-11-07, run against origin/main 759d43f): 3 of 12 failed -- both "owner, no
 * bio" rows (the empty line had no control) and the public "drafted" row (with no bio pencil
 * there was nothing to open the sheet from to draft one).
 *
 * Continuation 1 (option a, docs/design/1473.md): 'about' always renders its pencil again and the
 * empty line drops its own while an 'about' pencil is mounted. Red first against the round-1 head
 * 462bd5b: the 'blank' owner/no-bio row failed (its one pencil sat in the hero line, none in the
 * "Add a bio" pill) as did visibility.matrix's owner-blank rows; the 'page' owner/no-bio row now
 * expects the pencil beside the line in the About row, not inside it.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import EditInPlaceLayer from '../EditInPlaceLayer';
import type { EipBridge } from '../bridge';
import { organiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';

const ID = '33333333-3333-4333-8333-333333333333';
const BASE: ProfileEntity = {
  id: ID, name: 'Ritmo Latino', avatar_url: null, bio: null, socials: {},
  city_id: '11111111-1111-4111-8111-111111111111', instagram: null, website: null,
  organisation_category: null, founded_year: null, cities: { name: 'London', slug: 'london-gb' },
} as ProfileEntity;

const EMPTY_LINE = 'Not added yet. Optional: tell dancers who you are and what your nights are like.';

type Caller = 'public' | 'page' | 'blank';
type Bio = 'none' | 'set' | 'drafted';

function Harness({ stored, owner, caller }: { stored: ProfileEntity; owner: boolean; caller: Caller }) {
  const { data: entity } = useQuery({ queryKey: organiserEntityQueryKey(ID), queryFn: async () => stored, initialData: stored, staleTime: Infinity });
  const [eip, setEip] = useState<EipBridge | null>(null);
  const ep = { ...entity, ...(eip?.overlay ?? {}) } as ProfileEntity;
  const bio = (ep.bio ?? '').trim();
  return (
    <div>
      {caller === 'blank' ? (
        <>
          <section>{ep.bio && <p data-testid="bio">{ep.bio}</p>}{eip?.slot(ep.bio ? 'about' : 'about-empty')}</section>
          {!ep.bio && eip && <span data-testid="org-blank-about">Add a bio{eip.slot('about')}</span>}
        </>
      ) : caller === 'public' ? (
        <section>
          {ep.bio && <p data-testid="bio">{ep.bio}</p>}
          {eip?.slot(ep.bio ? 'about' : 'about-empty')}
        </section>
      ) : (
        <div data-testid="page-about">
          {bio ? <p data-testid="bio">{bio}</p> : eip?.slot('about-empty')}
          {eip?.slot('about')}
        </div>
      )}
      {owner && <EditInPlaceLayer organiserId={ID} entity={entity!} onBridge={setEip} client={{ rpc: vi.fn() } as never} searchCities={async () => []} resolveCity={async () => null} />}
    </div>
  );
}

const bioPencils = () => Array.from(document.querySelectorAll<HTMLButtonElement>('[data-eip-pencil="bio"]'));
const allPencils = () => document.querySelectorAll('[data-eip-pencil]');
const emptyLine = () => screen.queryByTestId('eip-about-empty');

async function setup(bio: Bio, owner: boolean, caller: Caller) {
  const stored = { ...BASE, bio: bio === 'set' ? 'We run Friday socials.' : null };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter([{ path: '/o', element: <Harness stored={stored} owner={owner} caller={caller} /> }], { initialEntries: ['/o'] });
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  if (!owner) return;
  await waitFor(() => expect(bioPencils().length).toBeGreaterThan(0));
  if (bio === 'drafted') {
    fireEvent.click(bioPencils()[0]);
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Drafted bio' } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  }
}

beforeEach(() => window.localStorage.clear());
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

const CALLERS: Caller[] = ['public', 'page', 'blank'];

describe.each(CALLERS)('%s caller', (caller) => {
  it('owner, no bio: the empty line AND exactly one enabled bio pencil, which opens the bio sheet', async () => {
    await setup('none', true, caller);
    const line = emptyLine();
    expect(line?.textContent).toBe(EMPTY_LINE);
    const pencils = bioPencils();
    expect(pencils).toHaveLength(1);
    const pencil = pencils[0];
    if (caller === 'public') {
      // No other About pencil on this screen: the empty line carries it, inline.
      expect(line!.contains(pencil)).toBe(true);
      expect(within(line!).getByTestId('aboutEmptyPencil').contains(pencil)).toBe(true);
    } else {
      // The 'about' slot's pencil is on screen (About row / "Add a bio" pill): the line has none.
      expect(line!.contains(pencil)).toBe(false);
      expect(screen.queryByTestId('aboutEmptyPencil')).toBeNull();
      if (caller === 'blank') expect(screen.getByTestId('org-blank-about').contains(pencil)).toBe(true);
      else expect(screen.getByTestId('page-about').contains(pencil)).toBe(true);
    }
    expect(pencil.disabled).toBe(false);
    // The same accessible name as the filled-bio pencil.
    expect(pencil.getAttribute('aria-label')).toBe('Edit about');
    // 44px hit area in explicit px (the public html font-size is ~13.5px on phones).
    expect(pencil.style.width).toBe('44px');
    expect(pencil.style.height).toBe('44px');
    fireEvent.click(pencil);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox')).toBeTruthy();
    expect(within(dialog).getAllByText('About').length).toBeGreaterThan(0);
  });

  it('owner, bio set: the existing pencil only, no empty line', async () => {
    await setup('set', true, caller);
    expect(emptyLine()).toBeNull();
    expect(screen.queryByTestId('aboutEmptyPencil')).toBeNull();
    expect(bioPencils()).toHaveLength(1);
    expect(bioPencils()[0].getAttribute('aria-label')).toBe('Edit about');
  });

  it('owner, bio drafted but unsaved: the existing pencil with its unsaved tag, no empty line', async () => {
    await setup('drafted', true, caller);
    expect(screen.getByTestId('bio').textContent).toBe('Drafted bio');
    expect(emptyLine()).toBeNull();
    expect(screen.queryByTestId('aboutEmptyPencil')).toBeNull();
    expect(bioPencils()).toHaveLength(1);
    expect(document.querySelector('[data-eip-unsaved="bio"]')).not.toBeNull();
  });

  it.each<Bio>(['none', 'set', 'drafted'])('visitor, bio %s: never the empty line, never any pencil', async (bio) => {
    // A visitor has no layer, so a draft cannot exist; 'drafted' is the stored-draft-in-storage case.
    if (bio === 'drafted') window.localStorage.setItem(`bc:organiser-edit-draft:v1:${ID}`, JSON.stringify({ v: 1, fields: { bio: 'Secret draft' } }));
    await setup(bio, false, caller);
    expect(emptyLine()).toBeNull();
    expect(screen.queryByTestId('aboutEmptyPencil')).toBeNull();
    expect(allPencils()).toHaveLength(0);
    expect(screen.queryByText('Secret draft')).toBeNull();
  });
});
