/**
 * R1a review fixes (docs/handover/dancer-rebuild-r1a-review.md), the pure half:
 * every test here was run against the unfixed r1a head (3a6aa23) first and went
 * red; the quotes are in docs/handover/dancer-rebuild-r1a.md "Review fixes".
 * Screen-level halves: tests/client/dancerAppReviewFixesScreens.test.tsx.
 */
import { describe, expect, it, vi } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { buildDelta, draftFromProfile, profileName } from '@/modules/dancer-app/screens/me/model';
import { DANCER_SHAPES, makeProfile, CITY_LONDON } from '@/modules/dancer-app/api/fixtures';
import { parseMyDancerEdit, saveMyDancerProfile, setFakeBackend } from '@/modules/dancer-app/api/rpc';
import { diffDelta } from '@/modules/dancer-app/api/delta';
import { countCommitted, mapNights, nextNight, nudgeCandidates, statusLabel, type AttendanceRow } from '@/modules/dancer-app/screens/nights/nightsModel';
import { renderPublicName } from '@/lib/publicName';
import { addDaysToKey, londonTodayKey } from '@/lib/londonDate';
import { STRENGTH_STEPS } from '@/modules/dancer-app/api/types';
// Dynamic: on the unfixed head this module did not exist, and a static import would hide every other red.
const loadNextStep = () => import('@/modules/dancer-app/api/nextStep');

const ROOT = path.resolve(__dirname, '../..');
const today = londonTodayKey();
const row = (over: Partial<AttendanceRow>): AttendanceRow => ({
  event_id: 'e1', status: 'going', updated_at: null, name: 'Night', occurrence_date: addDaysToKey(today, 3),
  city_name: 'London', start_time: null, type: 'party', is_active: true, ...over,
});

describe('S3: Nights / Home honour is_active and every RSVP status', () => {
  it('an unlisted (is_active false) night is never the hero, never counted, never nudged', () => {
    const n = mapNights([row({ is_active: false })], today);
    expect(nextNight(n.upcoming)).toBeNull();
    expect(countCommitted(n.upcoming)).toBe(0);
    const past = mapNights([row({ is_active: false, occurrence_date: addDaysToKey(today, -2) })], today);
    expect(nudgeCandidates(past.past, today)).toEqual([]);
  });

  it.each([
    ['going', 'Going'], ['interested', 'Interested'], ['not_going', 'Not going'], ['cancelled', 'Cancelled'],
    ['registered', 'Registered'], ['attended', 'Attended'], ['', 'Status unknown'], ['weird_new', 'Status unknown'],
  ])('status %j reads %j (never "Saved")', (status, label) => {
    const n = mapNights([row({ status })], today).upcoming[0];
    expect(statusLabel(n)).toBe(label);
  });

  it('not_going / cancelled rows are never the hero or counted', () => {
    const n = mapNights([row({ status: 'not_going' }), row({ event_id: 'e2', status: 'cancelled' })], today);
    expect(nextNight(n.upcoming)).toBeNull();
    expect(countCommitted(n.upcoming)).toBe(0);
  });
});

describe('S4: diff-first holds for chips', () => {
  it('toggling a style off and on again is no change', () => {
    const p = DANCER_SHAPES.completeAllExtras.profile!;
    const d = draftFromProfile(p);
    const first = d.favorite_styles[0];
    d.favorite_styles = [...d.favorite_styles.filter((s) => s !== first), first];
    expect(buildDelta(p, d)).toEqual({});
  });
});

describe('S6: one display-name rule, the public one', () => {
  const shapes = [
    makeProfile({ first_name: 'Ana', surname: 'Lopez' }),
    makeProfile({ first_name: 'Ana', surname: 'Lopez', hide_surname_publicly: true }),
    makeProfile({ first_name: 'Ana', surname: 'Lopez', display_name: 'Ana Lopez Dance' }),
    makeProfile({ first_name: 'Ana', surname: 'Lopez', display_name: 'Ana Lopez Dance', hide_surname_publicly: true }),
    makeProfile({ display_name: 'Ana Lopez', hide_surname_publicly: true }),
    makeProfile({}),
  ];
  // The SQL the public page reads (get_public_dancer_names_v1 -> _public_person_name_v1).
  const sqlPublic = (p: (typeof shapes)[number]) => {
    const t = (s: string | null) => (s && s.trim() ? s.trim() : null);
    const surname = p.hide_surname_publicly ? null : p.surname;
    const display = p.hide_surname_publicly ? t(p.first_name) ?? t((p.display_name ?? '').trim().split(' ')[0]) : p.display_name;
    const publicName = t([p.first_name ?? '', t(surname) ?? ''].join(' ')) ?? t(display);
    return renderPublicName({ public_name: publicName }, 'No name yet');
  };
  it.each(shapes.map((p, i) => [i, p] as const))('shape %i: Me/Edit name == public page name', (_i, p) => {
    expect(profileName(p)).toBe(sqlPublic(p));
  });
});

describe('S7: next_step and dance_role validated at the API boundary', () => {
  const raw = (over: Record<string, unknown>) => ({ profile_id: 'p', strength: { pct: 40, next_step: 'role', missing: ['role'] }, ...over });
  it('an unknown next_step / missing item / dance_role degrades to a safe value and is logged', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const p = parseMyDancerEdit(raw({ dance_role: 'Lead-ish', strength: { pct: 40, next_step: 'bogus', missing: ['bogus', 'role'] } }));
    expect(p.strength.next_step).toBeNull();
    expect(p.strength.missing).toEqual(['role']);
    expect(p.dance_role).toBeNull();
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });
  it('known values pass through untouched', () => {
    const p = parseMyDancerEdit(raw({ dance_role: 'Follower' }));
    expect(p.strength.next_step).toBe('role');
    expect(p.dance_role).toBe('Follower');
  });
});

describe('S2: one next-step table', () => {
  it('every StrengthStep has words and a target, and the line starts with the label', async () => {
    const nextStepModule = await loadNextStep();
    for (const step of STRENGTH_STEPS) {
      const e = nextStepModule.NEXT_STEP[step];
      expect(e.label.length).toBeGreaterThan(0);
      const missing = STRENGTH_STEPS.slice(STRENGTH_STEPS.indexOf(step));
      expect(nextStepModule.nextStepShort({ next_step: step, missing: [...missing], pct: 0 }).startsWith(e.label)).toBe(true);
    }
  });
  it('N8: "reach 70%" only when this step is the last one before 70', async () => {
    const s = (await loadNextStep()).nextStepShort;
    expect(s({ pct: 10, next_step: 'first_name', missing: ['first_name', 'city', 'role', 'photo'] })).toBe('Add your first name towards 70%');
    expect(s({ pct: 55, next_step: 'photo', missing: ['photo', 'started_year'] })).toBe('Add your photo to reach 70%');
    expect(s({ pct: 70, next_step: 'started_year', missing: ['started_year'] })).toBe('Add when you started dancing towards 100%');
  });
});

describe('S8: no raw Unicode punctuation in the module source', () => {
  const BANNED = /[—…‘’“”·–]/;
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const f of readdirSync(dir)) {
      const p = path.join(dir, f);
      if (statSync(p).isDirectory()) walk(p);
      else if (/\.(ts|tsx|css)$/.test(f)) files.push(p);
    }
  };
  walk(path.join(ROOT, 'src/modules/dancer-app'));
  it.each(files.map((f) => [path.relative(ROOT, f)]))('%s', (rel) => {
    const lines = readFileSync(path.join(ROOT, rel), 'utf8').split('\n');
    const bad = lines.map((l, i) => (BANNED.test(l) ? `${i + 1}: ${l.trim()}` : null)).filter(Boolean);
    expect(bad).toEqual([]);
  });
});

describe('S10: the isolation allow-list lives in ONE place', () => {
  it('RULES are read from scripts/dancer-area-isolation-allowlist.json, and the script names no path in code', async () => {
    const json = JSON.parse(readFileSync(path.join(ROOT, 'scripts/dancer-area-isolation-allowlist.json'), 'utf8'));
    // In a child node: vitest's transform cannot load the CRLF + shebang .mjs directly.
    const RULES = JSON.parse(
      execFileSync(process.execPath, ['--input-type=module', '-e', "import { RULES } from './scripts/check-dancer-area-isolation.mjs'; console.log(JSON.stringify(RULES));"], { cwd: ROOT, encoding: 'utf8' }),
    );
    expect(RULES.SEAMS).toEqual(json.seams);
    expect(RULES.PROTECTED).toEqual(json.protected);
    expect(RULES.DOC_PREFIXES).toEqual(json.docPrefixes);
    const src = readFileSync(path.join(ROOT, 'scripts/check-dancer-area-isolation.mjs'), 'utf8');
    // The RULES object is where an allowance would be added; the self-test's fixture repos
    // (further down) legitimately name paths and are not allowances.
    const rulesBlock = src.slice(src.indexOf('export const RULES = {'), src.indexOf('\n};', src.indexOf('export const RULES = {')));
    expect(rulesBlock.length).toBeGreaterThan(100);
    const codeOnly = rulesBlock.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const pathLiterals = [...codeOnly.matchAll(/['"`]((?:src|app|public|scripts|docs|tests|\.github|e2e)\/[^'"`]*|[\w.-]+\.(?:tsx?|mjs|json|txt|ya?ml))['"`]/g)].map((m) => m[1]);
    // Only the module's own folder, the test prefix and the importer-scan file may be named in RULES.
    expect(pathLiterals.filter((p) => !['src/modules/dancer-app', 'tests/', 'middleware.ts'].includes(p))).toEqual([]);
  });
});

describe('N1 / N2: an empty delta never reaches the server', () => {
  it('saveMyDancerProfile({}) without `current` sends nothing', async () => {
    const calls: string[] = [];
    setFakeBackend({
      fetchGate: async () => ({ open: false, allowed: true }),
      fetchMyDancerEdit: async () => { calls.push('fetch'); return makeProfile({ first_name: 'Ana', based_city_id: CITY_LONDON.id }); },
      saveMyDancerProfile: async () => { calls.push('save'); return makeProfile(); },
      fetchPublicExtras: async () => null,
    });
    await saveMyDancerProfile({});
    expect(calls).not.toContain('save');
    setFakeBackend(null);
  });
  it('an explicit undefined value is not a change', () => {
    const p = makeProfile({ first_name: 'Ana' });
    // Keys, not toEqual: toEqual treats { first_name: undefined } as {} and could never fail here.
    expect(Object.keys(diffDelta(p, { first_name: undefined }))).toEqual([]);
  });
});

describe('S3: "Saved" is in no dancer-app copy', () => {
  it('no source string or JSX text is the word Saved', () => {
    const hits: string[] = [];
    const walk = (dir: string) => {
      for (const f of readdirSync(dir)) {
        const p = path.join(dir, f);
        if (statSync(p).isDirectory()) { if (f !== '__tests__') walk(p); continue; }
        if (!/\.(ts|tsx)$/.test(f)) continue;
        readFileSync(p, 'utf8').split('\n').forEach((l, i) => {
          // Comments may name the banned word; code may not.
          if (/^\s*(\*|\/\/|\/\*)/.test(l)) return;
          if (/['"`>]\s*Saved\b/.test(l)) hits.push(`${path.relative(ROOT, p)}:${i + 1}`);
        });
      }
    };
    walk(path.join(ROOT, 'src/modules/dancer-app'));
    expect(hits).toEqual([]);
  });
});

describe('S2: one band table for Onboarding and Edit', () => {
  it('every band stores a year that reads back as the same band, in both screens', async () => {
    const { YEAR_BANDS, bandForYear, yearForBand } = await loadNextStep();
    const { EXPERIENCE_BANDS, startedYearForBand } = await import('@/modules/dancer-app/screens/onboarding/model');
    expect(EXPERIENCE_BANDS).toBe(YEAR_BANDS);
    const now = new Date(2026, 5, 1);
    for (const b of YEAR_BANDS) {
      expect(bandForYear(yearForBand(b.id, 2026), 2026)).toBe(b.id);
      expect(startedYearForBand(b.id, now)).toBe(yearForBand(b.id, 2026));
    }
  });
});

describe('S12 / S11: the Edit pure helpers', () => {
  const countries = [{ code: 'ES', name: 'Spain' }, { code: 'CL', name: 'Chile' }] as never;
  it.each([['Spain', 'ES'], ['spain', 'ES'], ['ES', 'ES'], ['', ''], ['Atlantis', 'Atlantis']])('pick %j -> %j', async (pick, code) => {
    const { nationalityCodeForPick } = await import('@/modules/dancer-app/screens/edit/editModel');
    expect(nationalityCodeForPick(pick, countries)).toBe(code);
  });
  it('every prod favourite_styles value (survey 2026-10-15) gives exactly one chip', async () => {
    const { styleChipOptions } = await import('@/modules/dancer-app/screens/edit/editModel');
    const { FAVORITE_STYLE_OPTIONS } = await import('@/components/profile/dancerConstants');
    const PROD = ['Bachata Sensual', 'Bachata Influence', 'Bachata Fusion', 'Zouk', 'Brazilian Zouk', 'Kizomba', 'Tarraxo', 'Urban Kiz', 'Bachata'];
    const chips = styleChipOptions(FAVORITE_STYLE_OPTIONS, PROD, PROD.map((s) => s.toLowerCase()));
    for (const v of PROD) expect(chips.filter((c) => c.toLowerCase() === v.toLowerCase()), v).toHaveLength(1);
  });
});
