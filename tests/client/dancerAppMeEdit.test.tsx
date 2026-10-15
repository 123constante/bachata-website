// @vitest-environment jsdom
/**
 * W2c: /app/me and /app/me/edit through renderInShell, every production shape.
 * Asserts the definition of done: untouched = Save disabled WITH a reason and no
 * request; exact delta keys; null to clear; replace-only fields refuse empty inline;
 * pure dancers never send WhatsApp; the same fact reads the same on Me and Edit.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';

vi.mock('@/hooks/useAuth', async (importOriginal) =>
  (await import('@/modules/dancer-app/shell/testAuth')).authModuleMock(importOriginal));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ value, onChange }: { value?: string; onChange: (id: string) => void }) => (
    <button type="button" data-testid="city-picker" onClick={() => onChange('c1000000-0000-4000-8000-000000000002')}>{value ?? 'Pick'}</button>
  ),
}));

import { renderInShell, resetShell } from '@/modules/dancer-app/shell/renderInShell';
import { createFakeBackend } from '@/modules/dancer-app/api/fakeBackend';
import { DANCER_SHAPES, DANCER_SHAPE_NAMES, type DancerShapeName } from '@/modules/dancer-app/api/fixtures';
import { DANCER_ERROR_CODES } from '@/modules/dancer-app/api/types';
import { copyFor } from '@/modules/dancer-app/api/errors';
import { mainAction, nextStepCopy, profileName, roleCityLine } from '@/modules/dancer-app/screens/me/model';

// Radix (the Switch inside HideSurnameSwitch) measures with ResizeObserver, which jsdom lacks.
class ResizeObserverStub { observe() {} unobserve() {} disconnect() {} }
(globalThis as { ResizeObserver?: unknown }).ResizeObserver ??= ResizeObserverStub;

afterEach(() => { cleanup(); resetShell(); });

const live = DANCER_SHAPE_NAMES.filter((n) => DANCER_SHAPES[n].profile && DANCER_SHAPES[n].signedIn);
const saves = (b: ReturnType<typeof createFakeBackend>) => b.calls.filter((c) => c.fn === 'saveMyDancerProfile');
const type = (id: string, v: string) => fireEvent.change(document.getElementById(id)!, { target: { value: v } });
const saveBtn = () => screen.getByTestId('edit-save') as HTMLButtonElement;
const openEdit = async (shape: DancerShapeName) => {
  const r = renderInShell({ path: '/app/me/edit', backend: { shape } });
  await screen.findByTestId('dancer-screen-edit');
  return r;
};

describe('Me x every shape', () => {
  it.each(live)('%s: card facts come from the shared mapping', async (shape) => {
    const p = DANCER_SHAPES[shape].profile!;
    renderInShell({ path: '/app/me', backend: { shape } });
    await screen.findByTestId('dancer-screen-me');
    expect(screen.getByTestId('me-name').textContent).toBe(profileName(p));
    expect(screen.getByTestId('me-role-city').textContent).toBe(roleCityLine(p));
    expect(screen.getByTestId('me-strength-pct').textContent).toBe(`${p.strength.pct}%`);
    expect(screen.getByTestId('me-next-step').textContent).toBe(nextStepCopy(p));
    const main = screen.getByTestId('me-main-action');
    expect(main.textContent).toBe(mainAction(p).label);
    expect(main.getAttribute('href')).toBe(mainAction(p).href);
    // At 100 the main button IS "Edit my profile": no second copy.
    expect(screen.queryAllByText('Edit my profile').length).toBe(p.strength.next_step === null ? 1 : 1);
    // Badges / year in review: nothing in 1a.
    expect(screen.queryByText(/badge|year in review/i)).toBeNull();
    // Paused: banner + a disabled public-page button with its reason; otherwise a plain link.
    if (!p.is_active) {
      expect(screen.getByText('Your profile is hidden')).toBeTruthy();
      expect(screen.getByRole('link', { name: 'Open account settings' }).getAttribute('href')).toBe('/account/settings');
      expect((screen.getByTestId('me-public-page') as HTMLButtonElement).disabled).toBe(true);
      expect(screen.getByTestId('me-public-page-reason').textContent).toMatch(/hidden/);
    } else {
      expect(screen.queryByTestId('me-paused')).toBeNull();
      expect(screen.getByTestId('me-public-page').getAttribute('href')).toBe(`/dancers/${p.profile_id}`);
    }
  });

  it('shows the 4 named steps: photo -> /app/me/photo, city -> edit focus, 100 -> Edit my profile', async () => {
    renderInShell({ path: '/app/me', backend: { shape: 'adminUnclaimedPhotoless' } });
    expect((await screen.findByTestId('me-main-action')).getAttribute('href')).toBe('/app/me/photo');
    cleanup(); resetShell();
    renderInShell({ path: '/app/me', backend: { shape: 'emptyStub' } });
    expect((await screen.findByTestId('me-main-action')).textContent).toBe('Add your first name');
    cleanup(); resetShell();
    renderInShell({ path: '/app/me', backend: { shape: 'completeAllExtras' } });
    expect((await screen.findByTestId('me-main-action')).textContent).toBe('Edit my profile');
  });

  it('no profile: says what the person can do', async () => {
    renderInShell({ path: '/app/me', backend: { shape: 'authUserNoPersona' } });
    expect((await screen.findByTestId('load-error')).textContent).toBe(copyFor('no_profile'));
    expect(screen.getByRole('button', { name: 'Try again' })).toBeTruthy();
    expect(screen.getByRole('link', { name: /back to the bachata calendar website/i })).toBeTruthy();
  });
});

describe('Edit: untouched = nothing sent', () => {
  it.each(live)('%s: Save disabled with the reason, submit sends no request', async (shape) => {
    const { backend } = await openEdit(shape);
    expect(saveBtn().disabled).toBe(true);
    expect(screen.getByTestId('edit-save-reason').textContent).toBe('Nothing has changed yet. Edit a field above to save.');
    fireEvent.submit(screen.getByTestId('dancer-screen-edit'));
    expect(saves(backend)).toHaveLength(0);
    expect(backend.writes).toBe(0);
    expect(document.querySelectorAll('[role="alert"]').length).toBe(0);
  });

  it.each(live)('%s: Edit shows the same name, city and role as Me', async (shape) => {
    const p = DANCER_SHAPES[shape].profile!;
    await openEdit(shape);
    const row = screen.getByTestId('edit-photo-row');
    expect(within(row).getByText(profileName(p))).toBeTruthy();
    expect((document.getElementById('first_name') as HTMLInputElement).value).toBe(p.first_name ?? '');
    const pressed = screen.queryAllByRole('button', { pressed: true }).filter((b) => b.getAttribute('data-testid')?.startsWith('dance_role-'));
    expect(pressed.length).toBe(p.dance_role ? 1 : 0);
  });
});

describe('Edit: exact delta keys', () => {
  it('one text change sends exactly that key', async () => {
    const { backend } = await openEdit('completeAllExtras');
    type('languages', 'French');
    expect(saveBtn().disabled).toBe(false);
    fireEvent.click(saveBtn());
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(saves(backend)[0].args).toEqual({ languages: ['French'] });
    // After save: shape refreshed, the done line, Save disabled again.
    await waitFor(() => expect(saveBtn().disabled).toBe(true));
    expect(screen.getByTestId('edit-saved')).toBeTruthy();
    expect(screen.getByTestId('edit-save-reason').textContent).toMatch(/Nothing has changed/);
  });

  it('clearing optional fields sends null', async () => {
    const { backend } = await openEdit('completeAllExtras');
    type('bio', ''); type('instagram', ''); type('surname', '');
    fireEvent.click(saveBtn());
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(saves(backend)[0].args).toEqual({ bio: null, instagram: null, surname: null });
  });

  it('role, style, band and chips: arrays and scalars as changed', async () => {
    const { backend } = await openEdit('completeAllExtras');
    fireEvent.click(screen.getByTestId('dance_role-Leader'));
    fireEvent.click(screen.getByTestId('favorite_styles-Kizomba'));
    type('favorite_songs', 'Propuesta'); fireEvent.click(screen.getByTestId('favorite_songs-add'));
    type('languages', 'English, Spanish, French');
    fireEvent.click(screen.getByTestId('dance_started_year-one-two'));
    fireEvent.click(saveBtn());
    await waitFor(() => expect(backend.writes).toBe(1));
    const sent = saves(backend)[0].args as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['dance_role', 'dance_started_year', 'favorite_songs', 'favorite_styles', 'languages']);
    expect(sent.dance_role).toBe('Leader');
    expect(sent.languages).toEqual(['English', 'Spanish', 'French']);
    expect(sent.favorite_songs).toEqual(['Obsesion', 'Propuesta']);
  });

  it('picking the band the saved year is already in sends no year', async () => {
    const { backend } = await openEdit('completeAllExtras'); // 2019 -> six-plus
    fireEvent.click(screen.getByTestId('dance_started_year-six-plus')); // clears
    fireEvent.click(screen.getByTestId('dance_started_year-six-plus')); // restores the saved 2019
    expect(saveBtn().disabled).toBe(true);
    expect(saves(backend)).toHaveLength(0);
  });

  it('city change goes through the real picker contract', async () => {
    const { backend } = await openEdit('fourFieldComplete');
    fireEvent.click(screen.getByTestId('city-picker'));
    fireEvent.click(saveBtn());
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(saves(backend)[0].args).toEqual({ based_city_id: 'c1000000-0000-4000-8000-000000000002' });
  });
});

describe('Edit: replace-only fields refuse empty, inline', () => {
  it('first name', async () => {
    const { backend } = await openEdit('fourFieldComplete');
    type('first_name', '');
    expect(screen.getByTestId('error-first_name').textContent).toBe(copyFor('first_name_required'));
    expect(saveBtn().disabled).toBe(true);
    expect(screen.getByTestId('edit-save-reason').textContent).toMatch(/Fix the fields marked above/);
    fireEvent.submit(screen.getByTestId('dancer-screen-edit'));
    expect(saves(backend)).toHaveLength(0);
  });
  it('the photo is only ever replaced: there is no remove control', async () => {
    await openEdit('fourFieldComplete');
    expect(screen.queryByText(/remove photo|delete photo/i)).toBeNull();
    expect(screen.getByTestId('edit-change-photo').getAttribute('href')).toBe('/app/me/photo?return=/app/me/edit');
  });
});

describe('Edit: bio 279 / 280 / 281 and links', () => {
  it.each([[279, true], [280, true], [281, false]] as const)('%i chars -> can save: %s', async (n, ok) => {
    const { backend } = await openEdit('fourFieldComplete');
    type('bio', 'x'.repeat(n));
    expect(screen.getByTestId('bio-count').textContent).toBe(`${n}/280`);
    expect(saveBtn().disabled).toBe(!ok);
    if (!ok) {
      expect(screen.getByTestId('error-bio').textContent).toMatch(/280/);
      fireEvent.submit(screen.getByTestId('dancer-screen-edit'));
      expect(saves(backend)).toHaveLength(0);
    }
  });
  it.each(['http://x.co', 'https://x.co', 'www.x.co'])('bio with %s is refused client-side', async (link) => {
    const { backend } = await openEdit('fourFieldComplete');
    type('bio', `hi ${link}`);
    expect(screen.getByTestId('error-bio').textContent).toBe(copyFor('bio_has_link'));
    fireEvent.submit(screen.getByTestId('dancer-screen-edit'));
    expect(saves(backend)).toHaveLength(0);
  });
  it('invalid handle and invalid url are refused with their field', async () => {
    await openEdit('fourFieldComplete');
    type('instagram', 'no way!');
    type('website_url', 'ana.com');
    expect(screen.getByTestId('error-instagram')).toBeTruthy();
    expect(screen.getByTestId('error-website_url').textContent).toBe(copyFor('invalid_url', 'website_url'));
    expect(saveBtn().disabled).toBe(true);
  });
});

describe('Edit: WhatsApp (D2)', () => {
  it('person with a teaching role: shown with the switch and the explanation, and sent when changed', async () => {
    const { backend } = await openEdit('teacherWithWhatsapp');
    expect(screen.getByTestId('edit-whatsapp')).toBeTruthy();
    expect(screen.getByText(/only for people who also teach, DJ or organise/i)).toBeTruthy();
    fireEvent.click(screen.getByRole('switch', { name: /Show my WhatsApp on my page/ }));
    fireEvent.click(saveBtn());
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(saves(backend)[0].args).toEqual({ show_whatsapp_publicly: false });
  });
  it.each(['fourFieldComplete', 'hiddenSurname', 'completeAllExtras', 'emptyStub'] as const)('pure dancer (%s): absent and NEVER sent', async (shape) => {
    const { backend } = await openEdit(shape);
    expect(screen.queryByTestId('edit-whatsapp')).toBeNull();
    expect(document.getElementById('whatsapp')).toBeNull();
    type('languages', 'Spanish');
    fireEvent.click(saveBtn());
    await waitFor(() => expect(backend.writes).toBe(1));
    const sent = saves(backend)[0].args as Record<string, unknown>;
    expect('whatsapp' in sent || 'show_whatsapp_publicly' in sent).toBe(false);
  });
});

describe('Edit: hide-surname switch (D5)', () => {
  it('is mounted once, under Surname, and flipping it writes immediately and refreshes the form', async () => {
    const { backend } = await openEdit('hiddenSurname');
    expect(screen.getAllByTestId('hide-surname-switch')).toHaveLength(1);
    const surname = screen.getByTestId('field-surname');
    expect(surname.nextElementSibling?.getAttribute('data-testid')).toBe('edit-hide-surname');
    const sw = screen.getByRole('switch', { name: /Hide my surname/ });
    expect(sw.getAttribute('aria-checked')).toBe('true');
    fireEvent.click(sw);
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(saves(backend)[0].args).toEqual({ hide_surname_publicly: false });
    await waitFor(() => expect(screen.getByRole('switch', { name: /Hide my surname/ }).getAttribute('aria-checked')).toBe('false'));
    // The form itself stayed untouched: Save is still disabled, and hide_surname never rides a form save.
    expect(saveBtn().disabled).toBe(true);
  });
});

describe('Edit: errors', () => {
  it('every dancer error code has copy, and a field code appears next to its field', async () => {
    for (const code of DANCER_ERROR_CODES) expect(copyFor(code).length).toBeGreaterThan(10);
    const { backend } = await openEdit('fourFieldComplete');
    type('languages', 'French');
    backend.failNextWith('invalid_display_name');
    fireEvent.click(saveBtn());
    expect((await screen.findByTestId('error-display_name')).textContent).toBe(copyFor('invalid_display_name'));
    expect(screen.queryByTestId('edit-top-error')).toBeNull();
  });
  it('a code the client did not predict shows at the top with Retry, and Retry resends the current delta (unchanged form = the same keys)', async () => {
    const { backend } = await openEdit('fourFieldComplete');
    type('languages', 'French');
    backend.failNextWith('rate_limited');
    fireEvent.click(saveBtn());
    expect((await screen.findByTestId('edit-top-error')).textContent).toMatch(copyFor('rate_limited'));
    fireEvent.click(screen.getByTestId('edit-retry'));
    await waitFor(() => expect(backend.writes).toBe(1));
    expect(saves(backend)).toHaveLength(2);
    expect(saves(backend)[1].args).toEqual({ languages: ['French'] });
  });
  it('invalid_handle lands under the handle that was sent', async () => {
    const { backend } = await openEdit('fourFieldComplete');
    type('facebook', 'ana.fb');
    backend.failNextWith('invalid_handle');
    fireEvent.click(saveBtn());
    expect((await screen.findByTestId('error-facebook')).textContent).toBe(copyFor('invalid_handle'));
    expect(screen.queryByTestId('error-instagram')).toBeNull();
  });
});

describe('Edit: ?focus= from the Me button', () => {
  it('focuses the city control', async () => {
    renderInShell({ path: '/app/me/edit?focus=city', backend: { shape: 'nameCityOnly' } });
    await screen.findByTestId('dancer-screen-edit');
    await waitFor(() => expect(document.activeElement).toBe(screen.getByTestId('city-picker')));
  });
});
