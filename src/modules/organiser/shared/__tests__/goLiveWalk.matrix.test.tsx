// @vitest-environment jsdom
/**
 * W2 walk fixes 1, 3, 4, 5: ONE go-live mapping (shared/goLiveKeys), checked
 * over every blocker key x every screen that names, links, counts or asks it.
 * The server codes and sections are pinned from prod (_series_go_live_check_p5,
 * 2026-10-24): a new server code fails the first table until it has words and a link.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn(), from: vi.fn(), auth: {} } }));

import {
  GO_LIVE_BLOCKERS, GO_LIVE_SECTIONS, REQUIRED_HINT, ROLE_GO_LIVE_KEYS, UNKNOWN_ITEM_LABEL, askOrder, eventBlockers,
  goLiveLeft, isRoleGoLiveField, thingsLeftText,
} from '../goLiveKeys';
import { goLiveFixHref, goLiveLabel, parseGoLiveCheck, type GoLiveCheck } from '../goLiveCheck';
import { goLiveList, leftCount } from '../../events/lifecycleModel';
import { goLiveGaps } from '../../home/onboarding/golive/goLiveModel';
import { homeJobs } from '../../jobs/homeJobs';
import type { HomeOrganiser } from '../selfServeApi';
import { ROLE_FIELDS, type Role } from '@/modules/areas/shared/fieldRegistry';
import { RoleProfileForm } from '@/modules/areas/shared/RoleProfilePage';
import { makeRoleWizardSteps } from '@/modules/areas/shared/roleWizard';

afterEach(cleanup);

/** Every event code the server sends, with its section, in the server's order. */
const SERVER_EVENT: readonly [code: string, section: string][] = [
  ['venue', 'venue'], ['city', 'venue'], ['upcoming_date', 'dates'], ['session', 'programme'], ['cover', 'cover'],
  ['name', 'basics'], ['country', 'venue'], ['organiser', 'organisers'], ['no_session_first_date', 'programme'],
  ['first_date_past', 'dates'], ['bad_session_times', 'programme'], ['no_payment', 'payment'], ['no_flyer', 'cover'],
];
const SERVER_RECOMMENDED: readonly [string, string][] = [['ticket_link', 'tickets']];
/** _role_required_keys_v1 on prod. */
const SERVER_ROLE_KEYS: Record<Role, string[]> = { teacher: ['teaching_styles'], dj: ['dj_name', 'dj_genres'] };

const check = (codes: readonly (readonly [string, string])[], profile: GoLiveCheck['profileMissing'] = [], applies = true): GoLiveCheck => parseGoLiveCheck({
  ready: codes.length === 0 && profile.length === 0,
  event_missing: codes.map(([code, section]) => ({ code, section })),
  recommended: SERVER_RECOMMENDED.map(([code, section]) => ({ code, section })),
  profile_rule_applies: applies,
  profile_missing: profile.map((p) => ({ area: p.area, organiser_id: p.organiserId, fields: p.fields })),
});

const PROFILE: GoLiveCheck['profileMissing'] = [
  { area: 'dancer', organiserId: null, fields: ['languages'] },
  { area: 'organiser', organiserId: 'org-1', fields: ['founded_year'] },
  { area: 'teacher', organiserId: null, fields: ['teaching_styles'] },
  { area: 'dj', organiserId: null, fields: ['dj_name', 'dj_genres'] },
];

/** Prod-shaped checks: a fresh draft (every code), one gap, profile only, ready, rule off. */
const SHAPES: [string, GoLiveCheck][] = [
  ['fresh draft, every code + every profile key', check(SERVER_EVENT, PROFILE)],
  ['flyer only (cover + no_flyer twins)', check([['cover', 'cover'], ['no_flyer', 'cover']])],
  ['payment only', check([['no_payment', 'payment']])],
  ['profile only', check([], PROFILE)],
  ['profile rule off (admin)', check([['no_payment', 'payment']], PROFILE, false)],
  ['ready', check([])],
];

describe('every server code has words and a screen (findings 5)', () => {
  it.each(SERVER_EVENT.concat(SERVER_RECOMMENDED))('%s (%s)', (code, section) => {
    expect(goLiveLabel(code)).not.toBe(UNKNOWN_ITEM_LABEL);
    expect(GO_LIVE_BLOCKERS[code]?.section).toBe(section);
    expect(GO_LIVE_SECTIONS).toContain(section);
    const href = goLiveFixHref(section, 's1');
    expect(href).not.toBeNull();
    expect(href).toContain(`returnTo=${encodeURIComponent('/account/o/events/s1')}`);
  });

  it('no_payment links to the payment editor on the details screen', () => {
    expect(goLiveFixHref('payment', 's1')).toMatch(/^\/account\/o\/events\/s1\/details\?edit=payment&returnTo=/);
  });

  it('twins show once: no_flyer is the same fact as cover', () => {
    expect(eventBlockers(check([['cover', 'cover'], ['no_flyer', 'cover']]).eventMissing).map((i) => i.code)).toEqual(['cover']);
    expect(eventBlockers(check([['no_flyer', 'cover']]).eventMissing).map((i) => i.code)).toEqual(['no_flyer']);
  });
});

describe.each(SHAPES)('Go live list x %s (findings 4, 5)', (_name, c) => {
  it('every row has words other than the unknown label, and a link', () => {
    const list = goLiveList(c, 's1');
    for (const line of [...list.missing, ...list.recommended]) {
      expect(line.label).not.toBe(UNKNOWN_ITEM_LABEL);
      expect(line.href).not.toBeNull();
    }
    expect(new Set(list.missing.map((l) => l.label)).size).toBe(list.missing.length);
  });

  it('the event screen and Home count the same rows', () => {
    expect(leftCount(goLiveList(c, 's1'))).toBe(goLiveLeft(c));
  });

  it('the Go live flow says every gap in words, role gaps from the one map', () => {
    const gaps = goLiveGaps(c, 's1', 'org-1');
    for (const g of gaps) expect(g.text).not.toBe(UNKNOWN_ITEM_LABEL);
    const roleTexts = gaps.filter((g) => g.key.startsWith('teacher::') || g.key.startsWith('dj::')).map((g) => g.text);
    const expected = c.profileRuleApplies ? (['teacher', 'dj'] as Role[]).flatMap((r) => c.profileMissing.filter((p) => p.area === r)
      .flatMap((p) => p.fields.map((f) => ROLE_GO_LIVE_KEYS[r].find((k) => k.key === f)!.todo))) : [];
    expect(roleTexts).toEqual(expected);
  });

  it("Home's to-do row for the draft quotes the Go live list's count (finding 4)", () => {
    const page = {
      id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: 'c1', lifecycle_status: 'live', role: 'owner', latest_decision: null, team: [],
      series: [{ id: 's1', name: 'Friday Social', lifecycle_status: 'draft', format: 'weekly', upcoming_count: 0, cancelled_upcoming_count: 0, default_cover_image_url: null, default_local_start_time: null, created_at: '2026-10-23T10:00:00Z', dates: [] }],
    } as unknown as HomeOrganiser;
    const jobs = homeJobs(page, [], '2026-10-24', { s1: c });
    const row = jobs.find((j) => j.kind === 'go_live');
    const n = goLiveLeft(c);
    if (n === 0) {
      expect(row?.sub ?? '').not.toMatch(/left/);
    } else {
      expect(row?.title).toBe('Finish and go live: Friday Social');
      expect(row?.sub).toContain(thingsLeftText(n));
      expect(row?.to).toBe('/account/o/events/s1');
    }
  });
});

describe('the role go-live keys are the server list, and real editor fields', () => {
  it.each(['teacher', 'dj'] as Role[])('%s', (role) => {
    expect(ROLE_GO_LIVE_KEYS[role].map((k) => k.key)).toEqual(SERVER_ROLE_KEYS[role]);
    for (const k of ROLE_GO_LIVE_KEYS[role]) expect(ROLE_FIELDS[role].map((f) => f.key)).toContain(k.field);
  });
});

describe.each(['teacher', 'dj'] as Role[])('%s details editor (finding 3)', (role) => {
  it('a go-live field never says optional and says the required words; the rest stay optional', () => {
    render(<MemoryRouter><RoleProfileForm role={role} details={{}} saving={false} onSave={() => {}} serverError={null} /></MemoryRouter>);
    expect(document.body.textContent).not.toMatch(/Every detail is optional/);
    for (const f of ROLE_FIELDS[role]) {
      const box = screen.getByTestId(`field-${f.key}`);
      if (isRoleGoLiveField(role, f.key)) {
        expect(box.textContent).not.toMatch(/optional/i);
        expect(box.textContent).toContain(REQUIRED_HINT);
      } else {
        expect(box.textContent).toMatch(/\(optional\)/);
      }
    }
  });
});

describe.each(['teacher', 'dj'] as Role[])('%s wizard step (finding 1)', (role) => {
  const goLive = makeRoleWizardSteps(role).filter((s) => isRoleGoLiveField(role, s.field));
  it.each(goLive.map((s) => [s.field, s] as const))('%s asked as required: the required words, no Optional, a disabled Continue with its reason', (_f, s) => {
    const Step = s.Component;
    render(<MemoryRouter><Step field={s.field} value={null} required saving={false} error={null} onAnswer={() => {}} /></MemoryRouter>);
    expect(document.body.textContent).not.toMatch(/Optional/);
    expect(document.body.textContent).toContain(REQUIRED_HINT);
    const go = screen.getByTestId('step-continue');
    expect((go as HTMLButtonElement).disabled).toBe(true);
    // A disabled control says why: Continue points at the required words.
    const why = go.getAttribute('aria-describedby');
    expect(why && document.getElementById(why)?.textContent).toContain(REQUIRED_HINT);
  });
});

describe('the wizard asks required steps first; from an event, only those (finding 1)', () => {
  const steps = [
    { k: 'dancer:surname', required: false }, { k: 'dancer:languages', required: true },
    { k: 'teacher:years_teaching', required: false }, { k: 'teacher:teaching_styles', required: true },
  ];
  it('required first, server order kept inside each group', () => {
    expect(askOrder(steps).map((s) => s.k)).toEqual(['dancer:languages', 'teacher:teaching_styles', 'dancer:surname', 'teacher:years_teaching']);
  });
  it('required only', () => {
    expect(askOrder(steps, true).map((s) => s.k)).toEqual(['dancer:languages', 'teacher:teaching_styles']);
  });
});
