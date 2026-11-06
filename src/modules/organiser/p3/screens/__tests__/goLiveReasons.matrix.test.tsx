// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { TODAY, ws } from './wsFixtures';
import { STATUS_COPY, statusRows } from '../../data/eventPage';
import { P3_PATHS } from '../../shell/paths';
import {
  GO_LIVE_BLOCKERS, GO_LIVE_NOT_READY, GO_LIVE_REASONS_SHOWN, PROFILE_GAP_TODO, ROLE_GO_LIVE_KEYS,
  goLiveLabel, goLiveReasonText, goLiveReasons, profileGapText,
} from '../../../shared/goLiveKeys';
import type { GoLiveCheck, GoLiveItem, ProfileMissing } from '../../../shared/goLiveCheck';

/*
 * p3-status-real-reasons: Put it live names what the SERVER says is left
 * (series_go_live_check_v1 / the refusal's JSON), every item in the one mapping's
 * words, never server text, never the cover when the cover is there.
 * Prod 2026-11-05, series 7f0236e5 (East London Bachata Monthly Party): event_missing [],
 * profile_missing [{area: organiser, fields: [founded_year]}].
 */

const gl = vi.hoisted(() => ({ data: undefined as unknown, fresh: undefined as unknown }));
const sent = vi.hoisted(() => ({ calls: [] as unknown[], fail: null as unknown }));

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-25' }));
const wsQ = vi.hoisted(() => ({ value: {} as Record<string, unknown> }));
vi.mock('../../../shared/runCommands', () => ({
  useEventWorkspace: () => wsQ.value,
  useRunCommands: () => async (commands: unknown[]) => {
    sent.calls.push(commands);
    if (sent.fail) throw sent.fail;
    return 8;
  },
  useSendOnce: () => async () => { throw new Error('not used'); },
}));
vi.mock('../../data/useP3Data', () => ({ useP3Home: () => ({ isPending: true, data: undefined }) }));
vi.mock('../../../shared/goLiveCheck', async (orig) => ({
  ...(await orig<typeof import('../../../shared/goLiveCheck')>()),
  useGoLiveCheck: () => ({ data: gl.data, refetch: () => { if (gl.fresh) gl.data = gl.fresh; return Promise.resolve({ data: gl.fresh, isError: false }); } }),
}));

import { EventPage } from '../EventPage';

const check = (eventMissing: GoLiveItem[], profileMissing: ProfileMissing[], ready = false): GoLiveCheck =>
  ({ ready, eventMissing, recommended: [{ code: 'ticket_link', section: 'tickets' }], profileRuleApplies: true, profileMissing });
const ev = (code: string): GoLiveItem => ({ code, section: GO_LIVE_BLOCKERS[code]?.section ?? 'basics' });
const org = (fields: string[]): ProfileMissing => ({ area: 'organiser', organiserId: '2631450a-0000-0000-0000-000000000000', fields });

/** The prod refusal / check of the owner's screenshot. */
const PROD = check([], [org(['founded_year'])]);
const PROD_LINE = 'Not ready to go live yet. Add the year you started to your organiser page.';

/** Every blocking event code the server sends (ticket_link is recommended; no_flyer is cover's twin). */
const EVENT_CODES = Object.keys(GO_LIVE_BLOCKERS).filter((c) => c !== 'ticket_link');
/** Every required profile field the server names, by area (_profile_fields_p5 + _role_required_keys_v1, prod). */
const PROFILE_ITEMS: Array<[ProfileMissing['area'], string]> = [
  ...Object.keys(PROFILE_GAP_TODO.organiser).map((f) => ['organiser', f] as [ProfileMissing['area'], string]),
  ...Object.keys(PROFILE_GAP_TODO.dancer).map((f) => ['dancer', f] as [ProfileMissing['area'], string]),
  ...ROLE_GO_LIVE_KEYS.teacher.map((k) => ['teacher', k.key] as [ProfileMissing['area'], string]),
  ...ROLE_GO_LIVE_KEYS.dj.map((k) => ['dj', k.key] as [ProfileMissing['area'], string]),
];
const pm = (area: ProfileMissing['area'], field: string): ProfileMissing =>
  ({ area, organiserId: area === 'organiser' ? 'o-1' : null, fields: [field] });

describe('goLiveReasonText: the one mapping, every item x every item x both x neither', () => {
  it('the prod shape (cover there, organiser page missing founded_year) names the year, not the cover', () => {
    expect(goLiveReasonText(PROD)).toBe(PROD_LINE);
    expect(goLiveReasonText(PROD)).not.toMatch(/cover|flyer|photo|date|founded_year/i);
  });

  it.each(EVENT_CODES)('event_missing %s alone: its own words', (code) => {
    const text = goLiveReasonText(check([ev(code)], []))!;
    expect(text).toBe(`Not ready to go live yet. ${goLiveLabel(code)}.`);
  });

  it.each(PROFILE_ITEMS)('profile_missing %s %s alone: its own words, never the field name', (area, field) => {
    const text = goLiveReasonText(check([], [pm(area, field)]))!;
    expect(text).toBe(`Not ready to go live yet. ${profileGapText(area, field)}.`);
    if (field.includes('_')) expect(text).not.toContain(field);
    expect(text).not.toMatch(/cover|flyer/i);
  });

  const BOTH = EVENT_CODES.flatMap((code) => PROFILE_ITEMS.map(([area, field]) => [code, area, field] as const));
  it.each(BOTH)('both: event %s + profile %s %s, event first', (code, area, field) => {
    expect(goLiveReasons(check([ev(code)], [pm(area, field)]))).toEqual([goLiveLabel(code), profileGapText(area, field)]);
  });

  it('neither: a refusal naming no item says the neutral sentence, which blames nothing and says what to do', () => {
    const none = check([], []);
    expect(goLiveReasonText(none)).toBe(GO_LIVE_NOT_READY);
    expect(goLiveReasonText(null)).toBe(GO_LIVE_NOT_READY);
    expect(GO_LIVE_NOT_READY).not.toMatch(/cover|photo|flyer|date/i);
    expect(GO_LIVE_NOT_READY).toMatch(/Check the event.s details and your profile/);
  });

  it('a ready check that is older than the page still says no date is coming up', () => {
    const live = statusRows(ws('draft'), TODAY, new Date(), check([], [], true)).find((r) => r.move === 'live')!;
    expect(live.reason).toBe(STATUS_COPY.noComingDate);
  });

  it('a ready check gives no reason (Put it live is on)', () => {
    expect(goLiveReasonText(check([], [], true))).toBeNull();
  });

  it('cover and its twin no_flyer show once', () => {
    expect(goLiveReasons(check([ev('cover'), ev('no_flyer')], []))).toEqual(['Upload a flyer']);
  });

  it('a long list shows the first ones and says how many more', () => {
    const text = goLiveReasonText(check([ev('venue'), ev('city')], [{ area: 'dancer', organiserId: null, fields: Object.keys(PROFILE_GAP_TODO.dancer) }]))!;
    const total = 2 + Object.keys(PROFILE_GAP_TODO.dancer).length;
    expect(text.endsWith(` And ${total - GO_LIVE_REASONS_SHOWN} more.`)).toBe(true);
  });

  it('a field the map does not know still reads as words', () => {
    expect(profileGapText('organiser', 'tiktok_handle')).toBe('Add your tiktok handle to your organiser page');
  });

  it('statusRows: once the check is in, Put it live is off with its reason; a ready check turns it on', () => {
    const live = (c: GoLiveCheck | null | undefined) => statusRows(ws('draftReady'), TODAY, new Date(), c).find((r) => r.move === 'live')!;
    expect(live(PROD).reason).toBe(PROD_LINE);
    expect(live(check([], [], true)).reason).toBeNull();
    expect(live(undefined).reason).toBeNull();
  });

  it('one mapping: the profile words live in one non-test source file', () => {
    const root = join(__dirname, '../../..');
    const files: string[] = [];
    const walk = (d: string) => readdirSync(d).forEach((n) => {
      const p = join(d, n);
      if (statSync(p).isDirectory()) { if (n !== '__tests__') walk(p); } else if (/\.tsx?$/.test(n)) files.push(p);
    });
    walk(root);
    const hits = files.filter((f) => readFileSync(f, 'utf8').includes('Add the year you started to your organiser page'));
    expect(hits.map((f) => f.slice(root.length + 1).replace(/\\/g, '/'))).toEqual(['shared/goLiveKeys.ts']);
  });
});

function show() {
  return render(
    <MemoryRouter initialEntries={[P3_PATHS.event('ser-1')]}>
      <Routes><Route path="/account/p3/events/:seriesId" element={<EventPage />} /></Routes>
    </MemoryRouter>,
  );
}
const openSheet = () => fireEvent.click(screen.getByTestId('p3-open-status'));
const liveRow = () => screen.getByTestId('p3-status-row-live') as HTMLButtonElement;

describe('the Status sheet on the prod draft shape', () => {
  beforeEach(() => {
    wsQ.value = { isPending: false, isError: false, data: ws('draftReady'), error: null, refetch: vi.fn() };
    gl.data = undefined;
    gl.fresh = undefined;
    sent.calls = [];
    sent.fail = null;
  });
  afterEach(cleanup);

  it('before the tap: the loaded check names the organiser page year; Put it live is disabled with that reason', () => {
    gl.data = PROD;
    show();
    openSheet();
    expect(liveRow().disabled).toBe(true);
    expect(liveRow().textContent).toContain(PROD_LINE);
    expect(screen.getByTestId('p3-sheet').textContent).not.toMatch(/cover photo|founded_year|permission_denied/);
  });

  it('a go-live refusal names its items, keeps Put it live off with them, and shows no server text', async () => {
    const json = JSON.stringify({ ready: false, event_missing: [], recommended: [{ code: 'ticket_link', section: 'tickets' }], profile_rule_applies: true,
      profile_missing: [{ area: 'organiser', organiser_id: '2631450a-0000-0000-0000-000000000000', fields: ['founded_year'] }] });
    sent.fail = { message: `permission_denied: series.set_lifecycle draft -> live needs a ready series: ${json}`, code: 'P0001' };
    show();
    openSheet();
    expect(liveRow().disabled).toBe(false);
    await act(async () => { fireEvent.click(liveRow()); });
    expect(sent.calls).toHaveLength(1);
    expect(liveRow().disabled).toBe(true);
    expect(liveRow().textContent).toContain(PROD_LINE);
    expect(screen.getByTestId('p3-sheet').textContent).not.toMatch(/cover photo|founded_year|permission_denied|ready series/);
    expect(screen.getByRole('alert').textContent).toBe(STATUS_COPY.goLiveRefused);
  });

  it('a go-live refusal with no items falls back to the neutral sentence, not the cover', async () => {
    sent.fail = { message: 'permission_denied: series.set_lifecycle draft -> live needs a ready series: readiness ok, a cover image and an upcoming scheduled date', code: 'P0001' };
    show();
    openSheet();
    await act(async () => { fireEvent.click(liveRow()); });
    expect(liveRow().disabled).toBe(true);
    expect(liveRow().textContent).toContain(GO_LIVE_NOT_READY);
    expect(screen.getByTestId('p3-sheet').textContent).not.toMatch(/cover photo|cover image|permission_denied/);
  });

  it('after a refusal, the check asked again owns the row (a fresh answer is never hidden by the old refusal)', async () => {
    sent.fail = { message: 'permission_denied: series.set_lifecycle draft -> live needs a ready series: x', code: 'P0001' };
    gl.fresh = PROD; // the refusal named nothing; the fresh check names the year
    show();
    openSheet();
    await act(async () => { fireEvent.click(liveRow()); });
    expect(liveRow().disabled).toBe(true);
    expect(liveRow().textContent).toContain(PROD_LINE);
  });
});
