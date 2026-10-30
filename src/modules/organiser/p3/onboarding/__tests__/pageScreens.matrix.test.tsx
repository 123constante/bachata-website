// @vitest-environment jsdom
/**
 * W4b build 2 slices 2+3: the whole onboarding route (OnboardingFlow) x the prod page shapes, with fake
 * reads / writes (no network). Asserts per page screen: one question, aria-valuenow = the % shown and on
 * the FULL path, an untouched Continue sends nothing (diff-first), a change sends one command; Find / claim
 * (sheet portalled to body) / create and its refusals; Review from missing[] (Go live disabled WITH the
 * reason while complete_organiser_onboarding_v1 is not wired in, deployed: false); Live (confetti) only via a deployed
 * go-live; the Settings sheet (dark switch writes p3-ob-theme); the Home grace banner.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/modules/organiser/wizard/wizardCountries', () => ({ wizardCountries: () => Promise.resolve([]) }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }) }));
vi.mock('@/components/account/profiles/signOutToHome', () => ({ SIGN_OUT_FAILED: 'failed', useSignOutToHome: () => ({ signOutToHome: vi.fn(async () => 'ok'), busy: false }) }));
const home = vi.hoisted(() => ({ organisers: [{ id: 'o1' }] as { id: string }[], teach: 'yes' as 'yes' | 'no' }));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ data: { organisers: home.organisers }, isPending: false, isError: false, refetch: vi.fn() }) }));

import OnboardingFlow from '../OnboardingFlow';
import { GraceBanner } from '../../screens/GraceBanner';
import { GO_LIVE_NOT_DEPLOYED, type GoLiveApi, type PageReads, type PageWrites } from '../pageApi';
import type { PersonReads, PersonWrites } from '../personApi';
import type { PageCommand } from '../pageModel';
import { OB_THEME_KEY } from '../obEnv';
import { GRACE_HIDE_KEY } from '../graceModel';

type Shape = { page: Record<string, unknown>; phone: string | null; missing: string[]; lifecycle?: string };
const SHAPES: Record<string, Shape> = {
  e164Confirmed: { page: { name: 'Leeds Nights', city: 'Leeds', socials: { facebook: 'https://facebook.com/ln' }, instagram: 'leedsnights', website: 'https://ln.com', organisation_category: 'Promoter', avatar_url: 'https://img/l.png' }, phone: '+447700900123', missing: [] },
  noPhone: { page: { name: 'No Phone', city: 'York', socials: null, organisation_category: null, avatar_url: null }, phone: null, missing: ['org_logo', 'org_link', 'org_category', 'contact_confirm'] },
  legacyPhone: { page: { name: 'Old Phone', city: 'Leeds', socials: {}, website: 'https://old.com', organisation_category: 'Event Brand', avatar_url: 'https://img/o.png' }, phone: '07700 900125', missing: ['contact_confirm'] },
  hasWhatsApp: { page: { name: 'Wa', city: 'Leeds', socials: { whatsapp: 'https://wa.me/447700900126' }, instagram: 'wa', organisation_category: 'Promoter', avatar_url: 'https://img/w.png' }, phone: '+447700900126', missing: ['contact_confirm'] },
};

const statusOf = (s: Shape, person: string[] = [], id = 'o1') => ({ v: 1, is_admin: false, person: { complete: person.length === 0, missing: person }, organisers: [{ id, name: s.page.name, role: 'owner', lifecycle: s.lifecycle ?? 'live', complete: s.missing.length === 0, missing: s.missing, about: { done: false, skipped: false } }] });

const PERSON_READS: PersonReads = {
  dancer: async () => ({ first_name: 'Sam', avatar_url: 'https://img/a.jpg', dance_role: 'Follower', nationality: 'GB', languages: ['English'] }),
  intent: async () => (home.teach === 'no' ? { roles: [], declined: ['teacher'] } : { roles: ['teacher'], declined: [] }) as never,
  teacher: async () => ({ teaching_styles: ['Moderna'], years_teaching: 3 }),
  organiser: async () => ({ id: 'o1', name: 'Leeds Nights', bio: '', category: 'Promoter', city: 'Leeds' }),
};

function Where() {
  const l = useLocation();
  return <span data-testid="where">{l.pathname + l.search}</span>;
}

function mount(opts: { shape?: string; at?: string; person?: string[]; goLive?: GoLiveApi; fail?: string; createFail?: string; claimFail?: string; noPage?: boolean; url?: string } = {}) {
  const shape = SHAPES[opts.shape ?? 'e164Confirmed'];
  home.organisers = opts.noPage ? [] : [{ id: 'o1' }];
  const sent: PageCommand[] = [];
  const reads: PageReads = {
    page: vi.fn(async () => shape.page),
    phone: vi.fn(async () => shape.phone),
    status: vi.fn(async (id: string) => statusOf(shape, opts.person, id)),
    findPages: vi.fn(async () => [
      { id: 'p1', name: 'Bachata Nights Leeds', slug: null, avatar_url: null, city_id: null, hint: 'email_matches' as const },
      { id: 'p2', name: 'Bachata Social Leeds', slug: null, avatar_url: null, city_id: null, hint: 'managed' as const },
    ]),
    cities: vi.fn(async () => [{ id: 'c1', label: 'Harrogate, United Kingdom' }, { id: 'c2', label: 'Leeds, United Kingdom' }]),
  };
  const writes: PageWrites = {
    run: vi.fn(async (cmd: PageCommand) => {
      if (opts.fail) throw new Error(opts.fail);
      sent.push(cmd);
    }),
    create: vi.fn(async () => {
      if (opts.createFail) throw new Error(opts.createFail);
      home.organisers = [{ id: 'o1' }];
      return 'o1';
    }),
    claim: vi.fn(async () => {
      if (opts.claimFail) throw new Error(opts.claimFail);
    }),
    ask: vi.fn(async () => undefined),
    rename: vi.fn(async () => undefined),
  };
  const personWrites: PersonWrites = { run: vi.fn(async () => undefined), skipAbout: vi.fn(async () => undefined) };
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const url = opts.url ?? `/account/p3/start${opts.at ? `?at=${opts.at}` : ''}`;
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/account/p3/start" element={<OnboardingFlow reads={reads} writes={writes} personReads={PERSON_READS} personWrites={personWrites} goLive={opts.goLive ?? GO_LIVE_NOT_DEPLOYED} organiserDetail upload={async () => 'https://img/new.png'} />} />
          <Route path="*" element={<Where />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return { sent, reads, writes, personWrites };
}

const cont = () => screen.getByTestId('p3-ob-continue');
const title = () => screen.getByTestId('p3-ob-title').textContent ?? '';
const shownStep = () => screen.getByTestId('p3-ob-shell').getAttribute('data-screen');
const pct = () => {
  const bar = screen.getByTestId('p3-ob-progress');
  return { now: bar.getAttribute('aria-valuenow'), shown: screen.getByTestId('p3-ob-pct').textContent };
};
const onStep = async (s: string) => waitFor(() => expect(shownStep()).toBe(s));

beforeEach(() => {
  window.localStorage.clear();
  home.teach = 'yes';
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = '';
});

describe('every page screen x every shape: one question, % on the full path, untouched sends nothing', () => {
  const STEPS = ['contact', 'whatsapp', 'cat', 'link', 'logo'] as const;
  const cells = Object.keys(SHAPES).flatMap((shape) => STEPS.map((at) => ({ shape, at })));
  it.each(cells)('$shape / $at', async ({ shape, at }) => {
    const { sent } = mount({ shape, at });
    const phone = SHAPES[shape].phone ?? '';
    const expected = at === 'contact' && !phone ? 'contact-phone' : at === 'whatsapp' && !phone ? 'cat' : at;
    await onStep(expected);
    expect(screen.getAllByRole('heading', { level: 1 })).toHaveLength(1);
    const p = pct();
    expect(p.shown).toBe(`${p.now}%`);
    expect(Number(p.now)).toBeGreaterThan(0);
    expect(Number(p.now)).toBeLessThan(100);
    const blocked = cont().getAttribute('aria-disabled') === 'true';
    if (blocked) {
      // never disabled without a reason
      expect(screen.getByTestId('p3-ob-why').textContent).not.toBe('');
      fireEvent.click(cont());
      expect(await screen.findByTestId('p3-ob-toast')).toBeTruthy();
      expect(sent).toHaveLength(0);
      return;
    }
    fireEvent.click(cont());
    await waitFor(() => expect(shownStep()).not.toBe(expected));
    const confirms = expected === 'contact' && SHAPES[shape].missing.includes('contact_confirm');
    expect(sent).toEqual(confirms ? [{ kind: 'confirm', phone: null }] : []);
  });
});

describe('page screens: changes and paths', () => {
  it('no number held: phone field; a UK 07 number is saved as E.164, then WhatsApp', async () => {
    const { sent } = mount({ shape: 'noPhone', at: 'contact' });
    await onStep('contact-phone');
    fireEvent.change(screen.getByTestId('p3-ob-phone'), { target: { value: '07700 900999' } });
    fireEvent.click(cont());
    await onStep('whatsapp');
    expect(sent).toEqual([{ kind: 'confirm', phone: '+447700900999' }]);
    fireEvent.click(screen.getByTestId('p3-ob-wa-yes'));
    fireEvent.click(cont());
    await onStep('cat');
    expect(sent[1]).toEqual({ kind: 'patch', patch: { socials: { whatsapp: 'https://wa.me/447700900999' } } });
  });
  it('"No public number" confirms with no phone and skips WhatsApp; Back from Category returns to the phone field', async () => {
    const { sent } = mount({ shape: 'noPhone', at: 'contact' });
    await onStep('contact-phone');
    fireEvent.click(screen.getByTestId('p3-ob-no-number'));
    await onStep('cat');
    expect(sent).toEqual([{ kind: 'confirm', phone: null }]);
    fireEvent.click(screen.getByTestId('p3-ob-back'));
    await onStep('contact-phone');
  });
  it('a legacy number (not E.164) skips WhatsApp; Change number opens the phone field', async () => {
    mount({ shape: 'legacyPhone', at: 'contact' });
    await onStep('contact');
    expect(screen.getByTestId('p3-ob-held-phone').textContent).toContain('07700 900125');
    fireEvent.click(screen.getByTestId('p3-ob-change-number'));
    await onStep('contact-phone');
  });
  it('category: five cards, a pick sends one patch', async () => {
    const { sent } = mount({ shape: 'noPhone', at: 'cat' });
    await onStep('cat');
    expect(screen.getAllByRole('radio')).toHaveLength(5);
    fireEvent.click(screen.getByTestId('p3-ob-cat-DanceSchool'));
    fireEvent.click(cont());
    await onStep('link');
    expect(sent).toEqual([{ kind: 'patch', patch: { organisation_category: 'Dance School' } }]);
  });
  it('link: an @handle is stored as Instagram', async () => {
    const { sent } = mount({ shape: 'noPhone', at: 'link' });
    await onStep('link');
    fireEvent.change(screen.getByTestId('p3-ob-link'), { target: { value: '@nophone' } });
    fireEvent.click(cont());
    await onStep('logo');
    expect(sent).toEqual([{ kind: 'patch', patch: { instagram: 'nophone' } }]);
  });
  it('logo: required; an upload then Continue saves it and opens the person screens', async () => {
    const { sent } = mount({ shape: 'noPhone', at: 'logo' });
    await onStep('logo');
    expect(cont().getAttribute('aria-disabled')).toBe('true');
    const file = new File(['x'], 'logo.png', { type: 'image/png' });
    fireEvent.change(screen.getByTestId('p3-ob-logo-file'), { target: { files: [file] } });
    await waitFor(() => expect(cont().getAttribute('aria-disabled')).toBeNull());
    fireEvent.click(cont());
    await onStep('name');
    expect(sent).toEqual([{ kind: 'patch', patch: { avatar_url: 'https://img/new.png' } }]);
    // person screens are on the SAME full path: % keeps rising, never 100 before Review
    const p = pct();
    expect(p.shown).toBe(`${p.now}%`);
    expect(Number(p.now)).toBeLessThan(100);
  });
  it('a failed save keeps the answer and says so', async () => {
    mount({ shape: 'noPhone', at: 'cat', fail: 'offline' });
    await onStep('cat');
    fireEvent.click(screen.getByTestId('p3-ob-cat-Promoter'));
    fireEvent.click(cont());
    expect((await screen.findByTestId('p3-ob-error')).textContent).toMatch(/Couldn.t save/);
    expect(shownStep()).toBe('cat');
    expect(screen.getByTestId('p3-ob-cat-Promoter').getAttribute('aria-checked')).toBe('true');
  });
  it('Esc and Back walk one step back', async () => {
    mount({ shape: 'e164Confirmed', at: 'link' });
    await onStep('link');
    fireEvent.keyDown(window, { key: 'Escape' });
    await onStep('cat');
    fireEvent.click(screen.getByTestId('p3-ob-back'));
    await onStep('whatsapp');
  });
});

describe('Welcome, Find, claim, create (no page yet)', () => {
  it('direct arrival: Welcome -> Find; rows say the hint words; claim sheet is portalled to body and claims', async () => {
    const { writes } = mount({ noPage: true });
    await onStep('welcome');
    expect(pct().now).toBe('0');
    fireEvent.click(cont());
    await onStep('find');
    fireEvent.change(screen.getByTestId('p3-ob-find-q'), { target: { value: 'Bachata' } });
    const row = await screen.findByTestId('p3-ob-find-p1');
    expect(row.textContent).toContain('Email on file is yours');
    fireEvent.click(row);
    const sheet = await screen.findByTestId('p3-ob-sheet-claim');
    expect(sheet.closest('.p3-ob-layer')?.parentElement).toBe(document.body);
    fireEvent.click(screen.getByTestId('p3-ob-claim-go'));
    await waitFor(() => expect(writes.claim).toHaveBeenCalledWith('p1'));
    await onStep('contact');
  });
  it('a claim refused for an unproven mailbox says so and offers the code proof', async () => {
    mount({ noPage: true, at: 'find', claimFail: 'mailbox_unproven' });
    await onStep('find');
    fireEvent.change(screen.getByTestId('p3-ob-find-q'), { target: { value: 'Bachata' } });
    fireEvent.click(await screen.findByTestId('p3-ob-find-p1'));
    fireEvent.click(await screen.findByTestId('p3-ob-claim-go'));
    expect((await screen.findByTestId('p3-ob-claim-err')).textContent).toContain('Confirm with an email code');
  });
  it('Ask to join ends on the asked screen', async () => {
    const { writes } = mount({ noPage: true, at: 'find' });
    await onStep('find');
    fireEvent.change(screen.getByTestId('p3-ob-find-q'), { target: { value: 'Bachata' } });
    fireEvent.click(await screen.findByTestId('p3-ob-find-p2'));
    fireEvent.click(await screen.findByTestId('p3-ob-claim-go'));
    await onStep('asked');
    expect(writes.ask).toHaveBeenCalledWith('p2');
    expect(title()).toBe('Asked to join Bachata Social Leeds');
  });
  it('create: name, city chip, Create page -> the phone field of the new page', async () => {
    const { writes } = mount({ noPage: true, at: 'create-name', shape: 'noPhone' });
    await onStep('create-name');
    expect(cont().getAttribute('aria-disabled')).toBe('true');
    fireEvent.change(screen.getByTestId('p3-ob-page-name'), { target: { value: 'Bachata Nights Harrogate' } });
    fireEvent.click(cont());
    await onStep('create-city');
    fireEvent.change(screen.getByTestId('p3-ob-city-q'), { target: { value: 'Harro' } });
    fireEvent.click(await screen.findByTestId('p3-ob-city-c1'));
    expect(screen.getByTestId('p3-ob-city-chosen').getAttribute('aria-checked')).toBe('true');
    expect(cont().textContent).toBe('Create page');
    fireEvent.click(cont());
    await waitFor(() => expect(writes.create).toHaveBeenCalledWith('Bachata Nights Harrogate', 'c1'));
    await onStep('contact-phone');
  });
  it('create refused (name taken) says so and offers Ask to join it instead', async () => {
    mount({ noPage: true, at: 'create-name', createFail: 'organiser_name_taken' });
    await onStep('create-name');
    fireEvent.change(screen.getByTestId('p3-ob-page-name'), { target: { value: 'Taken' } });
    fireEvent.click(cont());
    await onStep('create-city');
    fireEvent.change(screen.getByTestId('p3-ob-city-q'), { target: { value: 'Harro' } });
    fireEvent.click(await screen.findByTestId('p3-ob-city-c1'));
    fireEvent.click(cont());
    expect((await screen.findByTestId('p3-ob-error')).textContent).toContain('already listed');
    fireEvent.click(screen.getByTestId('p3-ob-ask-instead'));
    await onStep('find');
    expect((screen.getByTestId('p3-ob-find-q') as HTMLInputElement).value).toBe('Taken');
  });
});

describe('S2: the % never dips while a number is typed (WhatsApp counts once Continue has run)', () => {
  const createThenPhone = async () => {
    await onStep('create-name');
    fireEvent.change(screen.getByTestId('p3-ob-page-name'), { target: { value: 'Bachata Nights Harrogate' } });
    fireEvent.click(cont());
    await onStep('create-city');
    fireEvent.change(screen.getByTestId('p3-ob-city-q'), { target: { value: 'Harro' } });
    fireEvent.click(await screen.findByTestId('p3-ob-city-c1'));
    fireEvent.click(cont());
  };
  it.each([
    ['has-page', 'yes'],
    ['has-page', 'no'],
    ['no-page', 'yes'],
    ['no-page', 'no'],
  ] as const)('%s, teach %s: aria-valuenow is the same before and after typing a valid number', async (arrival, teach) => {
    home.teach = teach;
    if (arrival === 'has-page') mount({ shape: 'noPhone', at: 'contact' });
    else {
      mount({ noPage: true, at: 'create-name', shape: 'noPhone' });
      await createThenPhone();
    }
    await onStep('contact-phone');
    const before = pct().now;
    fireEvent.change(screen.getByTestId('p3-ob-phone'), { target: { value: '07700 900999' } });
    expect(pct().now).toBe(before);
    fireEvent.click(cont());
    await onStep('whatsapp');
    expect(Number(pct().now)).toBeGreaterThan(Number(before));
  });
});

describe('S3: a create refused for an unfinished dancer profile keeps the typed answers', () => {
  it('no-profile persona: refusal -> Finish your profile (return URL keeps name + city) -> back on create-name, prefilled -> Create', async () => {
    mount({ noPage: true, at: 'create-name', createFail: 'profile_incomplete' });
    await onStep('create-name');
    fireEvent.change(screen.getByTestId('p3-ob-page-name'), { target: { value: 'Bachata Nights Harrogate' } });
    fireEvent.click(cont());
    await onStep('create-city');
    fireEvent.change(screen.getByTestId('p3-ob-city-q'), { target: { value: 'Harro' } });
    fireEvent.click(await screen.findByTestId('p3-ob-city-c1'));
    fireEvent.click(cont());
    await screen.findByTestId('p3-ob-error');
    fireEvent.click(screen.getByRole('button', { name: 'Finish your profile' }));
    const where = (await screen.findByTestId('where')).textContent ?? '';
    const returnTo = new URLSearchParams(where.split('?')[1] ?? '').get('returnTo') ?? '';
    expect(returnTo.startsWith('/account/p3/start?')).toBe(true);
    cleanup();
    // The profile is finished; the Finish screen sends them back to returnTo.
    const { writes } = mount({ noPage: true, url: returnTo, shape: 'noPhone' });
    await onStep('create-name');
    expect((screen.getByTestId('p3-ob-page-name') as HTMLInputElement).value).toBe('Bachata Nights Harrogate');
    fireEvent.click(cont());
    await onStep('create-city');
    expect(screen.getByTestId('p3-ob-city-chosen').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('p3-ob-city-chosen').textContent).toContain('Harrogate');
    expect(cont().textContent).toBe('Create page');
    fireEvent.click(cont());
    await waitFor(() => expect(writes.create).toHaveBeenCalledWith('Bachata Nights Harrogate', 'c1'));
    await onStep('contact-phone');
  });
  it('a plain arrival (no kept answers in the URL) starts empty', async () => {
    mount({ noPage: true, at: 'create-name' });
    await onStep('create-name');
    expect((screen.getByTestId('p3-ob-page-name') as HTMLInputElement).value).toBe('');
  });
});

describe('Review and Live', () => {
  it('N things left from missing[]; the next row jumps to its screen; Show all lists every row in a sheet', async () => {
    mount({ shape: 'noPhone', at: 'review', person: ['photo'] });
    await onStep('review');
    expect(title()).toBe('5 things left');
    // review r1: done steps over all steps (15 on this path, 5 missing + Review itself not done), never 100 with things left.
    expect(pct()).toEqual({ now: '60', shown: '60%' });
    fireEvent.click(screen.getByTestId('p3-ob-review-all'));
    const sheet = await screen.findByTestId('p3-ob-sheet-review');
    expect(sheet.querySelectorAll('.p3-ob-row')).toHaveLength(5);
    fireEvent.click(screen.getByTestId('p3-ob-review-org_logo'));
    await onStep('logo');
  });
  it('a code with no screen here opens the dancer editor with a way back', async () => {
    mount({ shape: 'e164Confirmed', at: 'review', person: ['dj_answer'] });
    await onStep('review');
    fireEvent.click(screen.getByTestId('p3-ob-review-dj_answer'));
    await waitFor(() => expect(screen.getByTestId('where').textContent).toMatch(/returnTo=.*at%3Dreview/));
  });
  it('a draft page with nothing left: Go live is disabled WITH the reason while go-live is not wired (deployed: false)', async () => {
    const SH = { ...SHAPES.e164Confirmed, lifecycle: 'draft' };
    SHAPES.draftDone = SH;
    mount({ shape: 'draftDone', at: 'review' });
    await onStep('review');
    expect(title()).toBe('All set');
    expect(cont().getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('p3-ob-why').textContent).toBe('Going live opens soon. Everything you added is saved.');
    fireEvent.click(cont());
    expect(await screen.findByTestId('p3-ob-toast')).toBeTruthy();
    expect(screen.queryByTestId('p3-ob-confetti')).toBeNull();
  });
  it('with a deployed go-live: Go live -> You\u2019re live with confetti, View / Share / Home', async () => {
    const complete = vi.fn(async () => 'live' as const);
    mount({ shape: 'draftDone', at: 'review', goLive: { deployed: true, complete } });
    await onStep('review');
    fireEvent.click(cont());
    await onStep('live');
    expect(complete).toHaveBeenCalledWith('o1');
    expect(screen.getByTestId('p3-ob-confetti')).toBeTruthy();
    expect(screen.getByTestId('p3-ob-live-view').getAttribute('href')).toBe('/organisers/o1');
  });
  it('a live page: All done, Go to Home', async () => {
    mount({ shape: 'e164Confirmed', at: 'review' });
    await onStep('review');
    expect(title()).toBe('All done');
    fireEvent.click(cont());
    await waitFor(() => expect(screen.getByTestId('where').textContent).toBe('/account/p3'));
  });
});

describe('Settings sheet', () => {
  it('Not you? opens Settings; the dark switch flips the shell and is remembered', async () => {
    mount({ shape: 'e164Confirmed' });
    await onStep('welcome');
    await waitFor(() => expect(title()).toBe('Hey Sam, you made it!'));
    expect(screen.getByTestId('p3-ob-shell').getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByTestId('p3-ob-notyou'));
    const sw = await screen.findByTestId('p3-ob-dark');
    fireEvent.click(sw);
    expect(window.localStorage.getItem(OB_THEME_KEY)).toBe('dark');
    expect(screen.getByTestId('p3-ob-shell').getAttribute('data-theme')).toBe('dark');
    expect(screen.getByTestId('p3-ob-dark').getAttribute('aria-checked')).toBe('true');
  });
  it('page name: untouched Save sends nothing (disabled with a reason); a change renames', async () => {
    const { writes } = mount({ shape: 'e164Confirmed' });
    await onStep('welcome');
    fireEvent.click(screen.getByTestId('p3-ob-notyou'));
    const save = await screen.findByTestId('p3-ob-set-save');
    await waitFor(() => expect((screen.getByTestId('p3-ob-set-name') as HTMLInputElement).value).toBe('Leeds Nights'));
    expect(save.getAttribute('aria-disabled')).toBe('true');
    fireEvent.click(save);
    expect(writes.rename).not.toHaveBeenCalled();
    fireEvent.change(screen.getByTestId('p3-ob-set-name'), { target: { value: 'Leeds Nights Club' } });
    fireEvent.click(screen.getByTestId('p3-ob-set-save'));
    await waitFor(() => expect(writes.rename).toHaveBeenCalledWith('o1', 'Leeds Nights Club'));
  });
});

describe('Home grace banner', () => {
  const mountBanner = (raw: unknown) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter><GraceBanner fetcher={async () => raw} /></MemoryRouter>
      </QueryClientProvider>,
    );
  };
  const RAW = (o: Record<string, unknown> = {}) => ({ v: 1, is_admin: false, complete: false, person: { missing: ['photo'] }, organisers: [{ id: 'o1', name: 'L', complete: false, missing: ['contact_confirm', 'org_logo'] }], ...o });
  it('not complete: shows N things left and links into Review of that page', async () => {
    mountBanner(RAW());
    const b = await screen.findByTestId('p3-grace');
    expect(b.textContent).toContain('3 things left');
    expect(screen.getByTestId('p3-grace-go').getAttribute('href')).toBe('/account/p3/start?o=o1&at=review');
  });
  it('Hide for today hides it and remembers the day', async () => {
    mountBanner(RAW());
    fireEvent.click(await screen.findByTestId('p3-grace-hide'));
    expect(screen.queryByTestId('p3-grace')).toBeNull();
    expect(window.localStorage.getItem(GRACE_HIDE_KEY)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it.each([['complete', RAW({ complete: true })], ['admin', RAW({ is_admin: true })]])('%s: no banner, Settings still there', async (_n, raw) => {
    mountBanner(raw);
    await screen.findByTestId('p3-home-settings');
    await act(async () => { await new Promise((r) => setTimeout(r, 20)); });
    expect(screen.queryByTestId('p3-grace')).toBeNull();
  });
});
