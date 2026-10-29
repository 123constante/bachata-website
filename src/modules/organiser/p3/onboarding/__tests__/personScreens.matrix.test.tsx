// @vitest-environment jsdom
/**
 * W4b build 2 slice 1: every person screen (10-20) x the prod shapes (empty persona, a filled one,
 * teach = No, no page). Asserts: one question per screen, Continue is aria-disabled WITH its reason
 * when the answer is missing, an untouched screen sends nothing, a change sends one command, the
 * progress bar's aria-valuenow equals the percentage shown, Back / Esc walk the path (Esc closes a
 * sheet first), sheets portal to body, flags are images (never emoji), and a failed save keeps the
 * answer and shows the error.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/constants/countries', () => ({
  loadCountries: () => Promise.resolve([
    { code: 'VE', name: 'Venezuela', flag: '', flagUrl: '' },
    { code: 'ES', name: 'Spain', flag: '', flagUrl: '' },
  ]),
}));

import { PersonScreens } from '../PersonFlow';
import { EMPTY_DRAFT, PERSON_ORDER, STEP_COPY, personPath, progressPercent, type PersonCommand, type PersonDraft, type PersonStep } from '../personModel';
import type { OrganiserBrief, PersonWrites } from '../personApi';

const FULL: PersonDraft = {
  first_name: 'Sam', avatar_url: 'https://img/a.jpg', dance_role: 'Follower', nationality: 'GB-SCT', languages: ['English'],
  teach: 'yes', levels: ['Beginner'], styles: ['Moderna'], years: '3', about: 'We dance on Fridays.',
};
const ORG: OrganiserBrief = { id: 'o1', name: 'Leeds Nights', bio: FULL.about, category: 'Promoter', city: 'Leeds' };

function mount(opts: { held?: PersonDraft; step?: PersonStep; org?: OrganiserBrief | null; fail?: boolean; email?: string | null }) {
  const sent: PersonCommand[] = [];
  const skipped: string[] = [];
  const writes: PersonWrites = {
    run: vi.fn(async (cmd: PersonCommand) => {
      if (opts.fail) throw new Error('offline');
      sent.push(cmd);
    }),
    skipAbout: vi.fn(async (id: string) => { skipped.push(id); }),
  };
  const onExit = vi.fn();
  const onDone = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PersonScreens
        held={opts.held ?? EMPTY_DRAFT}
        organiser={opts.org === undefined ? ORG : opts.org}
        userId="u1"
        signInEmail={opts.email === undefined ? 'sam@example.com' : opts.email}
        writes={writes}
        theme="light"
        onExit={onExit}
        onDone={onDone}
        initialStep={opts.step}
        upload={async () => 'https://img/new.jpg'}
      />
    </QueryClientProvider>,
  );
  return { sent, skipped, writes, onExit, onDone };
}

const cont = () => screen.getByTestId('p3-ob-continue');
const title = () => screen.getByTestId('p3-ob-title').textContent ?? '';
const shownStep = () => screen.getByTestId('p3-ob-shell').getAttribute('data-screen');

afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('every screen x empty / filled', () => {
  it.each(PERSON_ORDER.map((s) => [s] as const))('%s', async (step) => {
    // Empty persona: required screens are off with a reason; optional ones are on.
    mount({ step });
    expect(title()).toContain(step === 'about' ? 'About Leeds Nights' : STEP_COPY[step].title);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const path = personPath(null, true);
    const bar = screen.getByTestId('p3-ob-progress');
    expect(bar.getAttribute('aria-valuenow')).toBe(String(progressPercent(step, path)));
    expect(screen.getByTestId('p3-ob-pct').textContent).toBe(`${progressPercent(step, path)}%`);
    if (STEP_COPY[step].optional) {
      expect(cont().getAttribute('aria-disabled')).toBeNull();
      expect(screen.getByTestId('p3-ob-skip')).toBeTruthy();
    } else {
      expect(cont().getAttribute('aria-disabled')).toBe('true');
      expect(screen.getByTestId('p3-ob-why').textContent).toBe(STEP_COPY[step].reason);
      // A tap on the off button says why (the 320 + keyboard step hides the line) and sends nothing.
      fireEvent.click(cont());
      expect(screen.getByTestId('p3-ob-toast').textContent).toBe(STEP_COPY[step].reason);
    }
    cleanup();
    document.body.innerHTML = '';

    // Filled persona: untouched Continue sends nothing (email asks the server, by design) and moves on.
    const f = mount({ held: FULL, step });
    expect(cont().getAttribute('aria-disabled')).toBeNull();
    await act(async () => { fireEvent.click(cont()); });
    if (step === 'email') expect(f.sent).toEqual([{ kind: 'signinEmail' }]);
    else expect(f.sent).toEqual([]);
    if (step === 'email') expect(f.onDone).toHaveBeenCalled();
    else expect(shownStep()).toBe(personPath('yes', true)[personPath('yes', true).indexOf(step) + 1]);
  });
});

describe('answers send one command', () => {
  it('name: typing then Continue saves only first_name', async () => {
    const f = mount({ held: FULL, step: 'name' });
    fireEvent.change(screen.getByTestId('p3-ob-name'), { target: { value: 'Alex' } });
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([{ kind: 'dancer', patch: { first_name: 'Alex' } }]);
    expect(shownStep()).toBe('photo');
  });

  it('photo: an upload fills the preview and Continue saves avatar_url', async () => {
    const f = mount({ step: 'photo' });
    const file = new File(['x'], 'me.jpg', { type: 'image/jpeg' });
    await act(async () => { fireEvent.change(screen.getByTestId('p3-ob-photo-file'), { target: { files: [file] } }); });
    expect(screen.getByTestId('p3-ob-ava').getAttribute('data-has')).toBe('true');
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([{ kind: 'dancer', patch: { avatar_url: 'https://img/new.jpg' } }]);
  });

  it('role: Both is stored as Lead and Follow', async () => {
    const f = mount({ step: 'role' });
    fireEvent.click(screen.getByTestId('p3-ob-role-Both'));
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([{ kind: 'dancer', patch: { dance_role: 'Lead and Follow' } }]);
  });

  it('nationality: home nations are chips with FLAG IMAGES, and a pick saves the code', async () => {
    const f = mount({ step: 'nat' });
    const scot = screen.getByTestId('p3-ob-nat-GB-SCT');
    const img = scot.querySelector('img');
    expect(img?.getAttribute('src')).toBe('https://flagcdn.com/gb-sct.svg');
    expect(img?.getAttribute('loading')).toBe('lazy');
    expect(/[\u{1F1E6}-\u{1F1FF}\u{1F3F4}]/u.test(scot.textContent ?? '')).toBe(false);
    fireEvent.click(scot);
    expect(scot.getAttribute('aria-checked')).toBe('true');
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([{ kind: 'dancer', patch: { nationality: 'GB-SCT' } }]);
  });

  it('nationality: a held code outside the popular six shows as the chosen chip with its name and flag', async () => {
    mount({ held: { ...FULL, nationality: 'VE' }, step: 'nat' });
    const chip = await screen.findByTestId('p3-ob-nat-VE');
    await waitFor(() => expect(chip.textContent).toContain('Venezuela'));
    expect(chip.getAttribute('aria-checked')).toBe('true');
    expect(chip.querySelector('img')?.getAttribute('src')).toBe('https://flagcdn.com/ve.svg');
  });

  it('languages: Skip sends nothing; toggling one and Continue sends the list', async () => {
    const f = mount({ held: FULL, step: 'langs' });
    fireEvent.click(screen.getByTestId('p3-ob-langs-Spanish'));
    await act(async () => { fireEvent.click(screen.getByTestId('p3-ob-skip')); });
    expect(f.sent).toEqual([]);
    expect(shownStep()).toBe('teach');
    fireEvent.click(screen.getByTestId('p3-ob-back'));
    expect(shownStep()).toBe('langs');
    fireEvent.click(screen.getByTestId('p3-ob-langs-Polish'));
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([{ kind: 'dancer', patch: { languages: ['English', 'Polish'] } }]);
  });

  it('teach = No skips levels, styles and years, and the bar jumps to the shorter path', async () => {
    const f = mount({ step: 'teach' });
    fireEvent.click(screen.getByTestId('p3-ob-teach-no'));
    const path = personPath('no', true);
    expect(screen.getByTestId('p3-ob-progress').getAttribute('aria-valuenow')).toBe(String(progressPercent('teach', path)));
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([{ kind: 'teach', yes: false }]);
    expect(shownStep()).toBe('about');
    fireEvent.click(screen.getByTestId('p3-ob-back'));
    expect(shownStep()).toBe('teach');
  });

  it('levels, styles, years each save one teacher key', async () => {
    const f = mount({ held: { ...FULL, levels: [], styles: [], years: '' }, step: 'levels' });
    fireEvent.click(screen.getByTestId('p3-ob-level-Advanced'));
    await act(async () => { fireEvent.click(cont()); });
    fireEvent.click(screen.getByTestId('p3-ob-styles-Salsa'));
    await act(async () => { fireEvent.click(cont()); });
    fireEvent.change(screen.getByTestId('p3-ob-years'), { target: { value: '7y' } });
    expect((screen.getByTestId('p3-ob-years') as HTMLInputElement).value).toBe('7');
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([
      { kind: 'teacher', patch: { levels_taught: ['Advanced'] } },
      { kind: 'teacher', patch: { teaching_styles: ['Salsa'] } },
      { kind: 'teacher', patch: { years_teaching: 7 } },
    ]);
  });

  it('about: the starter fills the box; Skip records the skip and sends no bio', async () => {
    const f = mount({ held: { ...FULL, about: '' }, step: 'about' });
    fireEvent.click(screen.getByTestId('p3-ob-starter'));
    expect((screen.getByTestId('p3-ob-about') as HTMLTextAreaElement).value).toBe('Leeds Nights is a promoter in Leeds. Classes in Moderna.');
    await act(async () => { fireEvent.click(screen.getByTestId('p3-ob-skip')); });
    expect(f.sent).toEqual([]);
    expect(f.skipped).toEqual(['o1']);
    expect(shownStep()).toBe('email');
  });

  it('no page: About is not on the path and the bar counts 10 steps', () => {
    mount({ step: 'years', org: null, held: FULL });
    expect(screen.getByTestId('p3-ob-progress').getAttribute('aria-valuenow')).toBe(String(progressPercent('years', personPath('yes', false))));
  });

  it('email with no sign-in email: the primary button just continues, nothing is sent', async () => {
    const f = mount({ step: 'email', email: null });
    expect(screen.getByTestId('p3-ob-email-line').textContent).toContain('nothing to keep');
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([]);
    expect(f.onDone).toHaveBeenCalled();
  });
});

describe('save failed, Back, Esc, sheets', () => {
  it('a failed save keeps the answer, shows the error, stays on the screen', async () => {
    mount({ step: 'name', fail: true });
    fireEvent.change(screen.getByTestId('p3-ob-name'), { target: { value: 'Alex' } });
    await act(async () => { fireEvent.click(cont()); });
    expect(screen.getByTestId('p3-ob-error').textContent).toMatch(/Couldn.t save/);
    expect(shownStep()).toBe('name');
    expect((screen.getByTestId('p3-ob-name') as HTMLInputElement).value).toBe('Alex');
  });

  it('Back on the first screen leaves; Esc goes back one step', () => {
    const f = mount({ held: FULL, step: 'photo' });
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(shownStep()).toBe('name');
    fireEvent.click(screen.getByTestId('p3-ob-back'));
    expect(f.onExit).toHaveBeenCalled();
  });

  it('a picker sheet is portalled to body, Esc closes it first, then Back', async () => {
    mount({ held: FULL, step: 'nat' });
    fireEvent.click(screen.getByTestId('p3-ob-more'));
    const sheet = screen.getByTestId('p3-ob-sheet-nat');
    expect(screen.getByTestId('p3-ob-shell').contains(sheet)).toBe(false);
    expect(sheet.closest('.p3-ob-layer')?.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(screen.getByTestId('p3-ob-sheet-nat-close'));
    await screen.findByTestId('p3-ob-nat-row-VE');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByTestId('p3-ob-sheet-nat')).toBeNull();
    expect(shownStep()).toBe('nat');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(shownStep()).toBe('role');
  });

  it('picking in the country sheet saves the code and closes it', async () => {
    const f = mount({ step: 'nat' });
    fireEvent.click(screen.getByTestId('p3-ob-more'));
    fireEvent.click(await screen.findByTestId('p3-ob-nat-row-VE'));
    expect(screen.queryByTestId('p3-ob-sheet-nat')).toBeNull();
    await act(async () => { fireEvent.click(cont()); });
    expect(f.sent).toEqual([{ kind: 'dancer', patch: { nationality: 'VE' } }]);
  });
});
