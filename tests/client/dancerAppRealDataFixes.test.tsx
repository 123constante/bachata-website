// @vitest-environment jsdom
/**
 * R1a real-data fixes F1-F3 (briefs/dancer-rebuild-r1a-fix-3.md). Each one was
 * seen on a real profile's SHAPE (prod read-only survey, counts only) and is
 * pinned here with the prod-shaped fixture `linkNoBio`. Every test went red on
 * d50046ff first; quotes in docs/handover/dancer-rebuild-r1a.md.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));

const h = vi.hoisted(() => ({
  rpc: async (fn: string) =>
    fn === 'get_my_event_attendance_v2' ? { data: [], error: null } : { data: null, error: { message: `unexpected rpc ${fn}` } },
}));
vi.mock('@/integrations/supabase/getSupabase', () => ({ getSupabase: async () => ({ rpc: h.rpc }) }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: h.rpc } }));
vi.mock('@/contexts/CityContext', () => ({
  CityProvider: ({ children }: { children: ReactNode }) => children,
  useCity: () => ({ citySlug: 'london-gb', setCitySlug: () => {} }),
}));
vi.mock('@/hooks/useCalendarEventsRpc', () => ({ useCalendarEvents: () => ({ data: [], isLoading: false, isError: false }) }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ value, onChange }: { value?: string; onChange: (id: string) => void }) => (
    <button type="button" data-testid="city-picker" onClick={() => onChange('c1000000-0000-4000-8000-000000000002')}>{value ?? 'Pick'}</button>
  ),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_SHAPES, makeProfile } from '@/modules/dancer-app/api/fixtures';
import * as nextStepModule from '@/modules/dancer-app/api/nextStep';
import { Meter } from '@/modules/dancer-app/screens/onboarding/ui';
import { mainAction } from '@/modules/dancer-app/screens/me/model';
import type { MyDancerEdit } from '@/modules/dancer-app/api/types';

class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

beforeEach(() => { localStorage.clear(); sessionStorage.clear(); });
afterEach(() => { cleanup(); resetShell(); });

const linkNoBio = DANCER_SHAPES.linkNoBio.profile;
const OLD_LABEL = /Add a bio and a link/;

const textOf = async (path: string, profile: MyDancerEdit, testId: string) => {
  renderInShell({ path, backend: { profile } });
  const t = (await screen.findByTestId(testId)).textContent ?? '';
  cleanup(); resetShell();
  return t;
};

describe('F1: the bio/link step names what is actually missing', () => {
  it('linkNoBio is the prod shape: 90%, complete, next step bio_social', () => {
    expect(linkNoBio.strength).toMatchObject({ pct: 90, next_step: 'bio_social' });
    expect(linkNoBio.complete).toBe(true);
  });

  it.each([
    ['link, no bio', {}, 'Add a short bio', 'bio'],
    ['bio, no link', { bio: 'Thursdays in Soho.', website_url: null, facebook: null, instagram: null }, 'Add your Instagram, Facebook or website', 'instagram'],
    ['neither', { website_url: null, facebook: null, instagram: null }, 'Add a bio and a link', 'bio'],
  ] as const)('%s', (_n, over, label, focus) => {
    const p = makeProfile({ ...linkNoBio, ...over });
    expect(p.strength.next_step).toBe('bio_social');
    const step = nextStepModule.nextStepFor(p);
    expect(step).toMatchObject({ label, focus });
    expect(nextStepModule.nextStepLine(p)).toBe(`${label} towards 100%.`);
    expect(mainAction(p)).toMatchObject({ label, href: `/app/me/edit?focus=${focus}` });
  });

  it('Home, Me and the onboarding meter all read "Add a short bio" for linkNoBio', async () => {
    const home = await textOf('/app/home', linkNoBio, 'tile-strength-next');
    const me = await textOf('/app/me', linkNoBio, 'me-next-step');
    render(<Meter profile={linkNoBio} />);
    const onboarding = screen.getByTestId('onboarding-next-step').textContent;
    expect(home).toBe('Add a short bio towards 100%.');
    expect(me).toBe(home);
    expect(onboarding).toBe(home);
    for (const t of [home, me, onboarding]) expect(t).not.toMatch(OLD_LABEL);
  });

  it('the Edit focus for "bio, no link" lands on the Instagram field', async () => {
    const p = makeProfile({ ...linkNoBio, bio: 'Thursdays in Soho.', website_url: null, facebook: null, instagram: null });
    renderInShell({ path: '/app/me/edit?focus=instagram', backend: { profile: p } });
    await screen.findByTestId('dancer-screen-edit');
    await waitFor(() => expect(document.activeElement?.id).toBe('instagram'));
  });
});

const saves = (b: ReturnType<typeof createFakeBackend>) => b.calls.filter((c) => c.fn === 'saveMyDancerProfile');
const type = (id: string, v: string) => fireEvent.change(document.getElementById(id)!, { target: { value: v } });
const saveBtn = () => screen.getByTestId('edit-save') as HTMLButtonElement;
const reason = () => screen.queryByTestId('edit-save-reason')?.textContent ?? null;

describe('F2: an untouched stored value never blocks a save', () => {
  it('untouched: no error, a calm hint, Save off only for "nothing to save"', async () => {
    renderInShell({ path: '/app/me/edit', backend: { profile: linkNoBio } });
    await screen.findByTestId('dancer-screen-edit');
    expect(screen.queryByTestId('error-website_url')).toBeNull();
    expect(document.getElementById('website_url')!.getAttribute('aria-invalid')).toBeNull();
    expect(screen.getByTestId('note-website_url').textContent).toBe('Add https:// at the start so this works as a link.');
    expect(screen.getByTestId('note-website_url').getAttribute('role')).toBeNull();
    expect(saveBtn().disabled).toBe(true);
    expect(reason()).toBe('Nothing has changed yet. Edit a field above to save.');
  });

  it('change only the first name: Save on, the delta is exactly { first_name }', async () => {
    const { backend } = renderInShell({ path: '/app/me/edit', backend: { profile: linkNoBio } });
    await screen.findByTestId('dancer-screen-edit');
    type('first_name', 'Anita');
    expect(saveBtn().disabled).toBe(false);
    expect(reason()).toBeNull();
    fireEvent.click(saveBtn());
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(saves(backend)[0].args).toEqual({ first_name: 'Anita' });
  });

  it('editing the website to another bad value: error + Save off with the fix reason', async () => {
    const { backend } = renderInShell({ path: '/app/me/edit', backend: { profile: linkNoBio } });
    await screen.findByTestId('dancer-screen-edit');
    type('website_url', 'dance-example.co.uk');
    expect(screen.getByTestId('error-website_url').textContent).toMatch(/http/);
    expect(document.getElementById('website_url')!.getAttribute('aria-invalid')).toBe('true');
    expect(screen.queryByTestId('note-website_url')).toBeNull();
    expect(saveBtn().disabled).toBe(true);
    expect(reason()).toBe('Fix the fields marked above, then save.');
    fireEvent.submit(screen.getByTestId('dancer-screen-edit'));
    expect(saves(backend)).toHaveLength(0);
  });
});

describe('F3: the WhatsApp switch cannot read On over an empty number', () => {
  it('no number: switch disabled with the reason; typing a number enables it', async () => {
    const { backend } = renderInShell({ path: '/app/me/edit', backend: { profile: linkNoBio } });
    await screen.findByTestId('dancer-screen-edit');
    const sw = document.getElementById('show_whatsapp_publicly') as HTMLButtonElement;
    expect(sw.disabled).toBe(true);
    const why = screen.getByTestId('whatsapp-switch-reason');
    expect(why.textContent).toBe('Add your number above to show it on your page.');
    expect(sw.getAttribute('aria-describedby')).toContain('whatsapp-switch-reason');
    fireEvent.click(sw);
    expect(sw.getAttribute('aria-checked')).toBe(String(linkNoBio.show_whatsapp_publicly));
    expect(reason()).toBe('Nothing has changed yet. Edit a field above to save.');
    type('whatsapp', '+44 7700 900123');
    expect(sw.disabled).toBe(false);
    expect(screen.queryByTestId('whatsapp-switch-reason')).toBeNull();
    fireEvent.click(saveBtn());
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(saves(backend)[0].args).toEqual({ whatsapp: '+44 7700 900123' });
  });
});
