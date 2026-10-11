// @vitest-environment jsdom
/**
 * The owner layer end to end, against a harness that uses the bridge exactly as
 * src/pages/OrganiserProfile.tsx does (slots + overlay), under a data router so
 * the leave guard is live. Covers: draft states {none, one, many} x bar / tags /
 * leave-dialog choices; save {ok, server refuses a field, network error, double
 * tap}; restore of a stored draft; the sheet (Done only drafts, focus in and back,
 * Escape, overlay, focus trap, positioned against visualViewport, 16px inputs);
 * the photo sheet's upload failure and success; the card's Add / Change.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { useState } from 'react';
import { Link, RouterProvider, createMemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query';
import type { ProfileEntity } from '@/modules/organiser/profile/profileForm';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import EditInPlaceLayer from '../EditInPlaceLayer';
import type { EipBridge } from '../bridge';
import { ADDED_MESSAGE, SAVE_COPY, buildSavePatch, draftStorageKey, restoredMessage, type Drafts } from '../draftModel';
import { organiserEntityQueryKey } from '@/modules/profile/organiserPublicProfile';

const ID = '22222222-2222-4222-8222-222222222222';
const STORED: ProfileEntity = {
  id: ID, name: 'Ritmo Latino', avatar_url: null, bio: null,
  socials: { facebook: 'https://www.facebook.com/ritmolatino' },
  city_id: '11111111-1111-4111-8111-111111111111',
  instagram: null, website: 'https://ritmo.co.uk', organisation_category: 'Dance School', founded_year: null,
  cities: { name: 'London', slug: 'london-gb' },
} as ProfileEntity;

type Rpc = ReturnType<typeof vi.fn>;
let server: ProfileEntity;

const okRpc = (): Rpc => vi.fn(async (_name: string, args: { p_patch: Record<string, unknown> }) => {
  const p = args.p_patch;
  server = { ...server, avatar_url: p.avatar_url as string | null, bio: p.bio as string | null, instagram: p.instagram as string | null, website: p.website as string | null, organisation_category: p.organisation_category as string | null, founded_year: p.founded_year as number | null, socials: p.socials as ProfileEntity['socials'] };
  return { data: { changed_keys: [], profile: { ...server } }, error: null };
});

function Harness({ rpc, uploadPhoto }: { rpc: Rpc; uploadPhoto?: (id: string, f: File) => Promise<string> }) {
  const { data: entity } = useQuery({ queryKey: organiserEntityQueryKey(ID), queryFn: async () => ({ ...server }), initialData: STORED, staleTime: Infinity });
  const [eip, setEip] = useState<EipBridge | null>(null);
  const ep = { ...entity, ...(eip?.overlay ?? {}) } as ProfileEntity;
  return (
    <div>
      {eip?.slot('card')}
      <div data-testid="avatar" data-src={ep.avatar_url ?? ''} style={{ position: 'relative' }}>{eip?.slot('photo')}</div>
      <p data-testid="meta">{ep.organisation_category}{eip?.slot('meta')}</p>
      <h2>About{eip?.slot('about')}</h2>
      {ep.bio ? <p data-testid="bio" className={eip?.mark('bio')}>{ep.bio}</p> : eip?.slot('about-empty')}
      {eip?.slot('links')}
      <Link to="/organisers">Back to organisers</Link>
      <EditInPlaceLayer organiserId={ID} entity={entity!} onBridge={setEip} client={{ rpc } as never} uploadPhoto={uploadPhoto} />
    </div>
  );
}

function setup(opts: { rpc?: Rpc; uploadPhoto?: (id: string, f: File) => Promise<string> } = {}) {
  const rpc = opts.rpc ?? okRpc();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const router = createMemoryRouter(
    [
      { path: '/organisers/ritmo', element: <Harness rpc={rpc} uploadPhoto={opts.uploadPhoto} /> },
      { path: '/organisers', element: <p>All organisers</p> },
    ],
    { initialEntries: ['/organisers/ritmo'] },
  );
  render(<QueryClientProvider client={qc}><RouterProvider router={router} /></QueryClientProvider>);
  return { rpc, router, qc };
}

const pencil = (field: string) => document.querySelector<HTMLButtonElement>(`[data-eip-pencil="${field}"]`)!;
const tags = () => Array.from(document.querySelectorAll('[data-eip-unsaved]')).map((e) => e.getAttribute('data-eip-unsaved'));
const bar = () => screen.queryByTestId('eip-bar');
const notice = () => screen.queryByTestId('eip-notice')?.textContent ?? null;

async function draft(field: string, value: string) {
  fireEvent.click(await waitFor(() => { const p = pencil(field); if (!p) throw new Error('no pencil'); return p; }));
  const dialog = await screen.findByRole('dialog');
  const input = within(dialog).getByRole('textbox');
  fireEvent.change(input, { target: { value } });
  fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
}

beforeEach(() => {
  server = { ...STORED };
  window.localStorage.clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('draft states x bar / tags', () => {
  it('none: no bar, no tag, the card lists the three prompts', async () => {
    setup();
    const card = await screen.findByTestId('eip-complete-card');
    expect(within(card).getByText('Complete your page')).toBeTruthy();
    expect(within(card).getByTestId('eip-card-progress').textContent).toBe('0 of 3 done');
    expect(Array.from(card.querySelectorAll('[data-eip-card-row]')).map((r) => r.getAttribute('data-eip-card-row'))).toEqual(['avatar_url', 'founded_year', 'instagram']);
    expect(bar()).toBeNull();
    expect(tags()).toEqual([]);
  });

  it('one: Done only drafts -- gold message, unsaved tag, dashed outline, bar "1 change not saved", nothing sent', async () => {
    const { rpc } = setup();
    await draft('bio', 'We dance on Tuesdays.');
    expect(notice()).toContain(ADDED_MESSAGE);
    expect(screen.getByTestId('bio').textContent).toBe('We dance on Tuesdays.');
    expect(screen.getByTestId('bio').className).toBe('eip-drafted');
    expect(tags()).toEqual(['bio']);
    expect(screen.getByTestId('eip-bar-count').textContent).toBe('1 change not saved');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('many: each drafted field tagged; the card ticks drafted prompts with Change', async () => {
    setup();
    await draft('founded_year', '2019');
    await draft('instagram', 'ritmo');
    await draft('facebook', 'newpage');
    expect(screen.getByTestId('eip-bar-count').textContent).toBe('3 changes not saved');
    expect(tags().sort()).toEqual(['facebook', 'founded_year', 'founded_year', 'instagram', 'instagram'].sort());
    const card = screen.getByTestId('eip-complete-card');
    expect(within(card).getByTestId('eip-card-progress').textContent).toBe('2 of 3 done');
    expect(within(card).getByRole('button', { name: 'Change year started' })).toBeTruthy();
    expect(within(card).getByRole('button', { name: 'Add photo' })).toBeTruthy();
    // Link rows show the value as it will read, never the raw typing.
    const links = screen.getByTestId('eip-links');
    expect(within(links).getByText('@ritmo')).toBeTruthy();
    expect(within(links).getByText('@newpage')).toBeTruthy();
  });

  it('a draft equal to what is stored is not a change', async () => {
    setup();
    await draft('website', 'ritmo.co.uk');
    expect(bar()).toBeNull();
    expect(notice()).toContain('already on your page');
  });

  it('Discard clears the draft, the tags and the stored copy', async () => {
    setup();
    await draft('bio', 'Hi');
    fireEvent.click(screen.getByRole('button', { name: 'Discard' }));
    expect(bar()).toBeNull();
    expect(tags()).toEqual([]);
    expect(window.localStorage.getItem(draftStorageKey(ID))).toBeNull();
  });
});

describe('save', () => {
  it('ok: ONE call for all drafts; tags and bar clear only after the server confirms; honest message', async () => {
    let release!: () => void;
    const inner = okRpc();
    const rpc = vi.fn(async (...a: unknown[]) => { await new Promise<void>((r) => { release = r; }); return inner(...(a as [string, never])); });
    setup({ rpc });
    await draft('founded_year', '2019');
    await draft('bio', 'Hello');
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    // While in flight: disabled, still tagged, bar still there.
    await waitFor(() => expect(screen.getByRole('button', { name: /Saving/ })).toHaveProperty('disabled', true));
    expect(tags().length).toBeGreaterThan(0);
    expect(bar()).not.toBeNull();
    await act(async () => { release(); });
    await waitFor(() => expect(bar()).toBeNull());
    expect(rpc).toHaveBeenCalledTimes(1);
    const sent = (rpc.mock.calls[0][1] as { p_patch: Record<string, unknown> }).p_patch;
    expect(sent).toEqual(buildSavePatch(STORED, { founded_year: '2019', bio: 'Hello' }));
    expect(tags()).toEqual([]);
    expect(notice()).toMatch(/^Saved at \d\d:\d\d\. Visitors may take a few minutes to see it\./);
    expect(screen.getByTestId('bio').className).toBe('');
    expect(window.localStorage.getItem(draftStorageKey(ID))).toBeNull();
  });

  it('double tap sends ONE call', async () => {
    const { rpc } = setup();
    await draft('bio', 'Hello');
    const save = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(save);
    fireEvent.click(save);
    fireEvent.click(save);
    await waitFor(() => expect(bar()).toBeNull());
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('double tap across both Save buttons (bar + "Save and leave") still sends ONE call', async () => {
    let release!: () => void;
    const inner = okRpc();
    const rpc = vi.fn(async (...a: unknown[]) => { await new Promise<void>((r) => { release = r; }); return inner(...(a as [string, never])); });
    const { router } = setup({ rpc });
    await draft('bio', 'Hello');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    fireEvent.click(screen.getByRole('link', { name: 'Back to organisers' }));
    const d = await screen.findByTestId('eip-leave');
    fireEvent.click(within(d).getByRole('button', { name: 'Save and leave' }));
    await act(async () => { release(); });
    await waitFor(() => expect(bar()).toBeNull());
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(router.state.location.pathname).toBe('/organisers/ritmo');
  });

  it('server refuses a field: names it, keeps the draft, the tags and the bar', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'invalid_socials: facebook' } }));
    setup({ rpc });
    await draft('facebook', 'newpage');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(notice()).toContain(SAVE_COPY.field('facebook')));
    expect(notice()).toContain('Facebook');
    expect(screen.getByTestId('eip-bar-count').textContent).toBe('1 change not saved');
    expect(tags()).toContain('facebook');
    expect(JSON.parse(window.localStorage.getItem(draftStorageKey(ID))!).fields).toEqual({ facebook: 'https://facebook.com/newpage' });
    expect(screen.getByRole('button', { name: 'Save' })).toHaveProperty('disabled', false);
  });

  it('network error: says so, never clears the draft', async () => {
    const rpc = vi.fn(async () => { throw new TypeError('Failed to fetch'); });
    setup({ rpc });
    await draft('bio', 'Hello');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(notice()).toContain(SAVE_COPY.network));
    expect(bar()).not.toBeNull();
    expect(screen.getByTestId('bio').textContent).toBe('Hello');
  });
});

describe('restore of a stored draft', () => {
  it('says so and shows the bar on arrival', async () => {
    window.localStorage.setItem(draftStorageKey(ID), JSON.stringify({ v: 1, fields: { founded_year: '2019', bio: 'From before' } }));
    setup();
    await waitFor(() => expect(notice()).toContain(restoredMessage(2)));
    expect(screen.getByTestId('eip-bar-count').textContent).toBe('2 changes not saved');
    expect(screen.getByTestId('bio').textContent).toBe('From before');
  });
  it('drops a stored draft that is already on the page', async () => {
    window.localStorage.setItem(draftStorageKey(ID), JSON.stringify({ v: 1, fields: { website: 'https://ritmo.co.uk' } }));
    setup();
    await screen.findByTestId('eip-complete-card');
    expect(bar()).toBeNull();
    expect(notice()).toBeNull();
  });
  it('works without storage (it throws)', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('denied'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('denied'); });
    setup();
    await draft('bio', 'Hi');
    expect(screen.getByTestId('eip-bar-count').textContent).toBe('1 change not saved');
  });
});

describe('leaving with unsaved changes', () => {
  const leave = async () => {
    fireEvent.click(screen.getByRole('link', { name: 'Back to organisers' }));
    return screen.findByTestId('eip-leave');
  };

  it('no draft: no dialog', async () => {
    const { router } = setup();
    await screen.findByTestId('eip-complete-card');
    fireEvent.click(screen.getByRole('link', { name: 'Back to organisers' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/organisers'));
  });

  it('Stay here: stays, draft kept', async () => {
    const { router } = setup();
    await draft('bio', 'Hi');
    const d = await leave();
    expect(within(d).getAllByRole('button').map((b) => b.textContent)).toEqual(['Save and leave', 'Leave, keep draft', 'Discard changes', 'Stay here']);
    expect(document.activeElement?.textContent).toBe('Save and leave');
    fireEvent.click(within(d).getByRole('button', { name: 'Stay here' }));
    await waitFor(() => expect(screen.queryByTestId('eip-leave')).toBeNull());
    expect(router.state.location.pathname).toBe('/organisers/ritmo');
    expect(bar()).not.toBeNull();
  });

  it('Leave, keep draft: leaves; the draft is still stored', async () => {
    const { router, rpc } = setup();
    await draft('bio', 'Hi');
    fireEvent.click(within(await leave()).getByRole('button', { name: 'Leave, keep draft' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/organisers'));
    expect(JSON.parse(window.localStorage.getItem(draftStorageKey(ID))!).fields).toEqual({ bio: 'Hi' });
    expect(rpc).not.toHaveBeenCalled();
  });

  it('Discard changes: leaves; nothing stored, nothing sent', async () => {
    const { router, rpc } = setup();
    await draft('bio', 'Hi');
    fireEvent.click(within(await leave()).getByRole('button', { name: 'Discard changes' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/organisers'));
    expect(window.localStorage.getItem(draftStorageKey(ID))).toBeNull();
    expect(rpc).not.toHaveBeenCalled();
  });

  it('Save and leave: saves once, then leaves', async () => {
    const { router, rpc } = setup();
    await draft('bio', 'Hi');
    fireEvent.click(within(await leave()).getByRole('button', { name: 'Save and leave' }));
    await waitFor(() => expect(router.state.location.pathname).toBe('/organisers'));
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('Save and leave that fails: stays, keeps the draft, says why', async () => {
    const rpc = vi.fn(async () => ({ data: null, error: { message: 'invalid_website' } }));
    const { router } = setup({ rpc });
    await draft('bio', 'Hi');
    fireEvent.click(within(await leave()).getByRole('button', { name: 'Save and leave' }));
    await waitFor(() => expect(screen.queryByTestId('eip-leave')).toBeNull());
    expect(router.state.location.pathname).toBe('/organisers/ritmo');
    expect(notice()).toContain(SAVE_COPY.field('website'));
    expect(bar()).not.toBeNull();
  });

  it('a beforeunload guard is set only while a draft exists', async () => {
    const add = vi.spyOn(window, 'addEventListener');
    setup();
    await screen.findByTestId('eip-complete-card');
    expect(add.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(false);
    await draft('bio', 'Hi');
    expect(add.mock.calls.some((c) => c[0] === 'beforeunload')).toBe(true);
  });
});

describe('the sheet', () => {
  it('is a modal dialog: focus into the field, 16px input, Escape closes and focus returns to the pencil', async () => {
    setup();
    const p = await waitFor(() => pencil('founded_year'));
    p.focus();
    fireEvent.click(p);
    const dialog = await screen.findByRole('dialog');
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    const input = within(dialog).getByRole('textbox') as HTMLInputElement;
    expect(document.activeElement).toBe(input);
    expect(input.style.fontSize).toBe('16px');
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(pencil('founded_year')));
  });

  it('the overlay closes it without drafting', async () => {
    setup();
    fireEvent.click(await waitFor(() => pencil('bio')));
    await screen.findByRole('dialog');
    fireEvent.click(screen.getByTestId('eip-sheet-overlay'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(bar()).toBeNull();
  });

  it('traps Tab inside', async () => {
    setup();
    fireEvent.click(await waitFor(() => pencil('website')));
    const dialog = await screen.findByRole('dialog');
    const done = within(dialog).getByRole('button', { name: 'Done' });
    done.focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(document.activeElement).toBe(within(dialog).getByRole('textbox'));
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(document.activeElement).toBe(done);
  });

  it('sits above the keyboard: positioned against visualViewport', async () => {
    const listeners: Array<() => void> = [];
    const vv = { height: 400, offsetTop: 0, addEventListener: (_: string, f: () => void) => listeners.push(f), removeEventListener: () => {} };
    Object.defineProperty(window, 'visualViewport', { value: vv, configurable: true });
    Object.defineProperty(window, 'innerHeight', { value: 844, configurable: true });
    try {
      setup();
      fireEvent.click(await waitFor(() => pencil('bio')));
      const dialog = await screen.findByRole('dialog');
      expect(dialog.style.bottom).toBe('444px');
      expect(dialog.style.maxHeight).toBe('388px');
      expect(dialog.style.overflowY).toBe('auto');
      expect(dialog.style.padding).toContain('safe-area-inset-bottom');
    } finally {
      Object.defineProperty(window, 'visualViewport', { value: undefined, configurable: true });
    }
  });

  it('a link sheet shows what will be saved, the hints, and a safe "open" link when valid', async () => {
    setup();
    fireEvent.click(await waitFor(() => pencil('website')));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'instagram.com/ritmo' } });
    expect(within(dialog).getByTestId('eip-will-save').textContent).toBe('We will save:https://instagram.com/ritmo');
    expect(within(dialog).getByTestId('eip-hint').textContent).toContain('Put it under Instagram');
    const open = within(dialog).getByRole('link', { name: 'Open the link to check it' });
    expect(open.getAttribute('target')).toBe('_blank');
    expect(open.getAttribute('rel')).toBe('noopener nofollow ugc');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'tba' } });
    expect(within(dialog).queryByRole('link', { name: 'Open the link to check it' })).toBeNull();
    expect(within(dialog).getByRole('alert').textContent).toBe('Use a web address, like yourschool.com.');
    expect(within(dialog).getByRole('button', { name: 'Done' })).toHaveProperty('disabled', true);
  });

  it('About counts characters', async () => {
    setup();
    fireEvent.click(await waitFor(() => pencil('bio')));
    const dialog = await screen.findByRole('dialog');
    fireEvent.change(within(dialog).getByRole('textbox'), { target: { value: 'Hello' } });
    expect(within(dialog).getByTestId('eip-about-counter').textContent).toBe('5 / 4000');
  });

  it('Category is a picker of the five values plus None', async () => {
    setup();
    fireEvent.click(await waitFor(() => pencil('organisation_category')));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByRole('radio').map((r) => (r as HTMLInputElement).value)).toEqual(['Dance School', 'Event Brand', 'Community Group', 'Promoter', 'Festival Brand', '']);
    fireEvent.click(within(dialog).getByLabelText('Promoter'));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.getByTestId('meta').textContent).toContain('Promoter'));
    expect(tags()).toContain('organisation_category');
  });
});

describe('the photo sheet', () => {
  const pick = async () => {
    fireEvent.click(await waitFor(() => pencil('avatar_url')));
    const dialog = await screen.findByRole('dialog');
    const input = dialog.querySelector('input[type="file"]') as HTMLInputElement;
    expect(input.accept).toBe('image/jpeg,image/png,image/webp');
    const f = new File([new Uint8Array([0xff, 0xd8, 0xff])], 'me.jpg', { type: 'image/jpeg' });
    URL.createObjectURL = vi.fn(() => 'blob:preview');
    URL.revokeObjectURL = vi.fn();
    fireEvent.change(input, { target: { files: [f] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    return dialog;
  };

  it('Done uploads first; the draft holds the public URL; nothing is saved yet', async () => {
    const url = `https://proj.supabase.co/storage/v1/object/public/organiser-photos/${ID}/${'a'.repeat(32)}.webp`;
    const uploadPhoto = vi.fn(async () => url);
    const { rpc } = setup({ uploadPhoto });
    await pick();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(uploadPhoto).toHaveBeenCalledWith(ID, expect.any(File));
    expect(screen.getByTestId('avatar').getAttribute('data-src')).toBe(url);
    expect(tags()).toContain('avatar_url');
    expect(rpc).not.toHaveBeenCalled();
  });

  it('a refused upload shows the plain copy, keeps the sheet and every other draft', async () => {
    const uploadPhoto = vi.fn(async () => { throw new Error('You can only change the photo of an organiser you own or manage. Your other changes are kept.'); });
    setup({ uploadPhoto });
    await draft('bio', 'Kept');
    const dialog = await pick();
    await waitFor(() => expect(within(dialog).getByRole('alert').textContent).toContain('own or manage'));
    expect(screen.getByRole('dialog')).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(screen.getByTestId('eip-bar-count').textContent).toBe('1 change not saved');
    expect(screen.getByTestId('bio').textContent).toBe('Kept');
  });
});

describe('the card disappears for good only once all three are SAVED', () => {
  it('drafting all three keeps the card; saving them removes it', async () => {
    const url = `https://proj.supabase.co/storage/v1/object/public/organiser-photos/${ID}/${'b'.repeat(32)}.webp`;
    setup({ uploadPhoto: vi.fn(async () => url) });
    await draft('founded_year', '2019');
    await draft('instagram', '@ritmo');
    fireEvent.click(await waitFor(() => pencil('avatar_url')));
    const dialog = await screen.findByRole('dialog');
    URL.createObjectURL = vi.fn(() => 'blob:x');
    URL.revokeObjectURL = vi.fn();
    fireEvent.change(dialog.querySelector('input[type="file"]')!, { target: { files: [new File([new Uint8Array([1])], 'a.jpg', { type: 'image/jpeg' })] } });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(within(screen.getByTestId('eip-complete-card')).getByTestId('eip-card-progress').textContent).toBe('3 of 3 done');
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByTestId('eip-complete-card')).toBeNull());
  });
});

export type { Drafts };
