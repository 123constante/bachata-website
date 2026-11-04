import { describe, it, expect } from 'vitest';
import { existsSync } from 'node:fs';
// @ts-expect-error -- plain .mjs script, no types
import { MAP, WALKS, plan, collect, main, notCoveredLine } from '../scripts/auto-walk-manifest.mjs';
// @ts-expect-error -- plain .mjs script, no types
import { UI_PATH_RE } from '../scripts/check-pr-phone-qa.mjs';

type Walk = { spec: string; config: string; project: string };
type Entry = { file: string; state: string; picture: string; sizes: string[] };
type Manifest = { covered: Entry[]; notCovered: string[]; ui: string[]; reason: string };

// UI file -> the walk keys that shoot it. One row per screen class; every row is
// a file a real PR touched (git log), so the table tracks the mapping people rely on.
const TABLE: [string, string[]][] = [
  ['src/modules/organiser/p3/door/DoorScreen.tsx', ['p3-door']],
  ['src/modules/organiser/p3/door/door.css', ['p3-door']],
  ['src/modules/organiser/p3/onboarding/OnboardingFlow.tsx', ['p3-onboarding', 'p3-golive']],
  ['src/modules/organiser/p3/onboarding/GateSheet.tsx', ['p3-gate-sheet']],
  ['src/modules/organiser/p3/onboarding/GateHost.tsx', ['p3-gate-sheet']],
  ['src/modules/organiser/p3/screens/RepeatSheet.tsx', ['p3-repeat']],
  ['src/modules/organiser/p3/screens/HistoryScreen.tsx', ['p3-history']],
  ['src/modules/organiser/p3/screens/HomeScreen.tsx', ['p3-shell']],
  ['src/modules/organiser/p3/shell/P3Shell.tsx', ['p3-shell']],
  ['src/modules/organiser/p3/theme/p3.css', ['p3-shell']],
  ['src/modules/admin-organisers/FrontDoorPage.tsx', ['front-door']],
  ['src/modules/admin-organisers/NeedsYou.tsx', ['front-door']],
  ['src/modules/admin-organisers/join/JoinScreens.tsx', ['invite-join']],
  ['src/modules/organiser/wizard/ProfileWizard.tsx', ['invite-w2-walk']],
  ['src/modules/organiser/home/onboarding/golive/GoLiveFlow.tsx', ['invite-w2-golive']],
  ['src/modules/organiser/events/OneEvent.tsx', ['invite-w2-walk']],
  ['src/modules/organiser/edit-in-place/ContactSheet.tsx', ['organiser-contact-sheet']],
  ['src/modules/organiser/edit-in-place/TeamSheet.tsx', ['organiser-team-picker']],
];

// UI files with NO driven state that takes a picture today (handover lists the classes).
const UNCOVERED = [
  'src/modules/organiser/p3/screens/AllDatesScreen.tsx', // P3 All dates: no walk shoots it
  'src/modules/organiser/p3/screens/DateFieldSheets.tsx', // only a static-markup geometry spec
  'src/modules/organiser/dates/DateSheet.tsx', // legacy dates: organiser-date.spec takes no picture
  'src/pages/Parties.tsx',
  'src/index.css',
  'public/favicon.ico',
  'index.html',
];

const pngs = (byDir: Record<string, string[]>) => (dir: string) => byDir[dir] ?? [];

describe('auto-walk manifest: UI file -> walks', () => {
  it.each(TABLE)('%s -> %j', (file, keys) => {
    expect(UI_PATH_RE.test(file), 'row must be a UI path').toBe(true);
    const p = plan([file]);
    expect(p.entries).toEqual([{ file, walks: keys }]);
    expect(p.notCovered).toEqual([]);
  });

  it.each(UNCOVERED)('%s is NOT covered, said in the manifest', (file) => {
    const p = plan([file]);
    expect(p.entries).toEqual([]);
    expect(p.notCovered).toEqual([file]);
    const m: Manifest = collect(p, pngs({}), {});
    expect(m.notCovered).toEqual([notCoveredLine(file)]);
    expect(m.notCovered[0]).toBe(`NOT covered: ${file}`);
  });

  it('non-UI files are ignored, and the manifest says why it is empty', () => {
    const p = plan(['scripts/foo.mjs', 'src/lib/x.ts', 'docs/a.md']);
    expect(p.ui).toEqual([]);
    const m: Manifest = collect(p, pngs({}), {});
    expect(m.covered).toEqual([]);
    expect(m.notCovered).toEqual([]);
    expect(m.reason).toMatch(/no UI path changed/);
  });

  it('a mapped walk that produced no picture is NOT covered, never silently empty', () => {
    const file = 'src/modules/organiser/p3/door/DoorScreen.tsx';
    const m: Manifest = collect(plan([file]), pngs({}), {});
    expect(m.covered).toEqual([]);
    expect(m.notCovered).toEqual([notCoveredLine(file, 'p3-door produced no picture')]);
  });

  it('a walk that failed is named with its exit code', () => {
    const file = 'src/modules/organiser/p3/door/DoorScreen.tsx';
    const dir = 'test-results/auto-walk/p3-door';
    const m: Manifest = collect(plan([file]), pngs({ [dir]: [`${dir}/1-ready.png`] }), { 'p3-door': 1 });
    expect(m.notCovered).toEqual([notCoveredLine(file, 'p3-door failed (exit 1)')]);
    expect(m.covered).toHaveLength(1);
  });

  it('pictures become (file, state, picture, sizes) entries at 390x844', () => {
    const file = 'src/modules/organiser/p3/onboarding/OnboardingFlow.tsx';
    const ob = 'test-results/auto-walk/p3-onboarding';
    const gl = 'test-results/auto-walk/p3-golive';
    const m: Manifest = collect(plan([file]), pngs({ [ob]: [`${ob}/welcome.png`], [gl]: [`${gl}/review.png`] }), {});
    expect(m.notCovered).toEqual([]);
    expect(m.covered).toEqual([
      { file, state: 'p3-onboarding/welcome', picture: `${ob}/welcome.png`, sizes: ['390x844'] },
      { file, state: 'p3-golive/review', picture: `${gl}/review.png`, sizes: ['390x844'] },
    ]);
  });

  it('a mixed PR keeps covered and NOT covered apart', () => {
    const p = plan(['src/modules/organiser/p3/door/DoorScreen.tsx', 'src/pages/Parties.tsx', 'README.md']);
    expect(p.ui).toHaveLength(2);
    expect(p.notCovered).toEqual(['src/pages/Parties.tsx']);
  });

  it('every walk names a spec that exists and a known config', () => {
    for (const [key, w] of Object.entries(WALKS as Record<string, Walk>)) {
      expect(existsSync(w.spec), `${key}: ${w.spec}`).toBe(true);
      expect(existsSync(w.config), `${key}: ${w.config}`).toBe(true);
    }
    for (const [, keys] of MAP as [RegExp, string[]][]) for (const k of keys) expect(WALKS[k], k).toBeTruthy();
  });

  it('main: exit 2 without PR_FILES, 0 with them (no --run)', () => {
    const quiet = { log: () => undefined, error: () => undefined };
    expect(main([], {}, quiet, { write: () => undefined })).toBe(2);
    expect(main([], { PR_FILES: '' }, quiet, { write: () => undefined })).toBe(2);
    let written = '';
    expect(main([], { PR_FILES: 'src/pages/Parties.tsx' }, quiet, { write: (s: string) => { written = s; } })).toBe(0);
    expect(JSON.parse(written).notCovered).toEqual(['NOT covered: src/pages/Parties.tsx']);
    expect(main(['--self-test'], {}, quiet)).toBe(0);
  });
});
