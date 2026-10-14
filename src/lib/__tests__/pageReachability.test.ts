import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

// A page nobody can reach is a feature that does not exist. #746 put the
// "hide my surname" switch on src/pages/EditProfile.tsx, which no route renders
// (retired 2026-09-12): the switch shipped, its tests passed, and no person
// could turn it on. This walks the real import graph from the places a page can
// be mounted -- the declarative route tree and the framework routes -- and fails
// when a page, or a control from the account arc, is not on it.
//
// Test files are NOT edges: a page only a test imports is still unreachable.

const ROOT = path.resolve(__dirname, '../../..');

/** Where the app is mounted from: the catchall route tree, the framework root and every framework route module. */
const rootsOf = (files: string[]): string[] => [
  'src/components/AnimatedRoutes.tsx',
  'app/root.tsx',
  ...files.filter((f) => f.startsWith('app/routes/')),
];

const isTest = (f: string) => /\.(test|spec)\.tsx?$/.test(f) || f.includes('/__tests__/');

// import x from 'a' / export ... from 'a' / import 'a' / import('a')
const IMPORT = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)(['"])([^'"\n]+)\1/g;
export const importsOf = (source: string): string[] => [...source.matchAll(IMPORT)].map((m) => m[2]);

/** An import specifier to a repo-relative file in `files`, or null (a package, or a file we do not have). */
export function resolveImport(from: string, spec: string, has: (f: string) => boolean): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`;
  else if (spec.startsWith('.')) base = path.posix.normalize(path.posix.join(path.posix.dirname(from), spec));
  else return null;
  for (const candidate of [base, `${base}.tsx`, `${base}.ts`, `${base}/index.tsx`, `${base}/index.ts`]) {
    if (has(candidate)) return candidate;
  }
  return null;
}

/** Every file reachable from `roots` along non-test imports. `files` maps repo-relative path -> source. */
export function reachableFiles(files: Record<string, string>, roots: string[]): Set<string> {
  const has = (f: string) => Object.prototype.hasOwnProperty.call(files, f) && !isTest(f);
  const seen = new Set<string>();
  const queue = roots.filter(has);
  while (queue.length) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    for (const spec of importsOf(files[file])) {
      const next = resolveImport(file, spec, has);
      if (next && !seen.has(next)) queue.push(next);
    }
  }
  return seen;
}

const collect = (dir: string): string[] =>
  readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap((e) => {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) return collect(rel);
    return /\.(ts|tsx)$/.test(e.name) && !e.name.endsWith('.d.ts') ? [rel] : [];
  });

const realFiles = (): Record<string, string> =>
  Object.fromEntries([...collect('src'), ...collect('app')].filter((f) => !isTest(f)).map((f) => [f, readFileSync(path.join(ROOT, f), 'utf8')]));

/** What must be reachable: every page, plus the controls the account arc added. */
export const subjectsOf = (files: string[]): string[] =>
  files.filter(
    (f) =>
      !isTest(f) &&
      ((f.startsWith('src/pages/') && f.endsWith('.tsx')) ||
      f.startsWith('src/components/account/') ||
      f === 'src/components/profile/HideSurnameSwitch.tsx'),
  );

// Pages that were already unreachable when this guard landed (2026-10-14).
// A RATCHET, like KNOWN_UNROUTABLE in navigateTargetsRoutable.test.ts: a new
// entry fails, and an entry that becomes reachable (or is deleted) must come off
// this list. Not deleted here: the owner decides what each one becomes.
const KNOWN_UNREACHABLE: Record<string, string> = {
  'src/pages/CreateVideographerProfile.tsx': 'create-profile page retired 2026-09-12; no route or link',
  'src/pages/DashboardPatternsDemo.tsx': 'design demo; no route',
  'src/pages/Debug.tsx': 'debug page; no route',
  'src/pages/EditProfile.tsx': 'edit-profile retired 2026-09-12; its surname switch now lives on the dancer home',
  'src/pages/Onboarding.tsx': 'onboarding retired 2026-09-12; sign-in now goes to /finish-profile',
  'src/pages/PublicProfile.tsx': 'no route or link',
  'src/pages/Profile.tsx': 'profile dashboards retired 2026-09-12; no route',
  'src/pages/PromoCodes.tsx': 'no route',
  'src/pages/VendorDashboardPage.tsx': 'no route',
  'src/pages/VendorPortal.tsx': 'no route',
};

const unreachable = (files: Record<string, string>): string[] => {
  const seen = reachableFiles(files, rootsOf(Object.keys(files)));
  return subjectsOf(Object.keys(files)).filter((f) => !seen.has(f)).sort();
};

describe('importsOf / resolveImport', () => {
  it('reads every import form, lazy ones included', () => {
    expect(
      importsOf(`import A from "./a"; import { b } from '@/b'; export * from "./c"; import "./d"; const E = lazy(() => import("../e"));`),
    ).toEqual(['./a', '@/b', './c', './d', '../e']);
  });

  it('resolves @/, relative, extensionless and index files; packages are not files', () => {
    const has = (f: string) => ['src/x/a.tsx', 'src/y/index.ts', 'src/z.ts'].includes(f);
    expect(resolveImport('src/q/q.tsx', '@/x/a', has)).toBe('src/x/a.tsx');
    expect(resolveImport('src/q/q.tsx', '../y', has)).toBe('src/y/index.ts');
    expect(resolveImport('src/q/q.tsx', '../z', has)).toBe('src/z.ts');
    expect(resolveImport('src/q/q.tsx', 'react', has)).toBeNull();
    expect(resolveImport('src/q/q.tsx', './missing', has)).toBeNull();
  });
});

describe('reachableFiles', () => {
  const graph = {
    'src/components/AnimatedRoutes.tsx': `const P = lazy(() => import("../pages/Live")); import "@/pages/Hidden"`,
    'src/pages/Live.tsx': `import { Card } from "@/components/account/Card";`,
    'src/components/account/Card.tsx': '',
    'src/pages/Hidden.tsx': '',
    'src/pages/Dead.tsx': `import { Card } from "@/components/account/Card";`,
    'src/pages/Dead2.tsx': `import Dead from "./Dead";`,
    'src/pages/__tests__/Dead.test.tsx': `import Dead from "../Dead";`,
  };

  it('positive: a routed page, and what it renders, are reachable', () => {
    const seen = reachableFiles(graph, ['src/components/AnimatedRoutes.tsx']);
    expect(seen.has('src/pages/Live.tsx')).toBe(true);
    expect(seen.has('src/components/account/Card.tsx')).toBe(true);
    expect(seen.has('src/pages/Hidden.tsx')).toBe(true);
  });

  it('negative: a page only another dead page, or only a test, imports is NOT reachable', () => {
    const seen = reachableFiles(graph, ['src/components/AnimatedRoutes.tsx']);
    expect(seen.has('src/pages/Dead.tsx')).toBe(false);
    expect(seen.has('src/pages/Dead2.tsx')).toBe(false);
    expect(unreachable(graph)).toEqual(['src/pages/Dead.tsx', 'src/pages/Dead2.tsx']);
  });

  it('the EditProfile shape: a control whose only importer is an unrouted page is unreachable', () => {
    const files = {
      'src/components/AnimatedRoutes.tsx': `import "../pages/Account"`,
      'src/pages/Account.tsx': '',
      'src/pages/EditProfile.tsx': `import { HideSurnameSwitch } from "@/components/profile/HideSurnameSwitch";`,
      'src/components/profile/HideSurnameSwitch.tsx': '',
      'src/pages/__tests__/EditProfile.test.tsx': `import EditProfile from "../EditProfile";`,
    };
    expect(unreachable(files)).toEqual(['src/components/profile/HideSurnameSwitch.tsx', 'src/pages/EditProfile.tsx']);
    // ...and one render from a routed screen fixes the control, which is the whole point.
    const fixed = { ...files, 'src/pages/Account.tsx': `import { HideSurnameSwitch } from "@/components/profile/HideSurnameSwitch";` };
    expect(unreachable(fixed)).toEqual(['src/pages/EditProfile.tsx']);
  });
});

describe('the real app', () => {
  const files = realFiles();
  const subjects = subjectsOf(Object.keys(files));
  const found = unreachable(files);

  it('fidelity: the graph sees the edges it should (route tree -> page -> control)', () => {
    const seen = reachableFiles(files, rootsOf(Object.keys(files)));
    expect(seen.has('src/pages/Account.tsx')).toBe(true);
    expect(seen.has('src/pages/AccountSettings.tsx')).toBe(true);
    expect(seen.has('src/components/account/DancerHome.tsx')).toBe(true);
    expect(seen.has('src/components/profile/HideSurnameSwitch.tsx')).toBe(true);
    expect(seen.has('src/components/account/HideSurnameCard.tsx')).toBe(true);
  });

  it('non-vacuity: it checks many subjects, and the detector finds the pages it is known to', () => {
    expect(subjects.length).toBeGreaterThan(30);
    expect(subjects).toContain('src/pages/EditProfile.tsx');
    expect(found).toContain('src/pages/EditProfile.tsx');
    expect(found.length).toBeLessThan(subjects.length);
  });

  it('every account-arc control is reachable (no allowlist for these)', () => {
    expect(found.filter((f) => f.startsWith('src/components/account/') || f.endsWith('HideSurnameSwitch.tsx'))).toEqual([]);
  });

  it('no page is added that nobody can reach', () => {
    expect(found.filter((f) => !(f in KNOWN_UNREACHABLE))).toEqual([]);
  });

  it('the known-unreachable list holds no page that is reachable or gone', () => {
    expect(Object.keys(KNOWN_UNREACHABLE).filter((f) => !found.includes(f))).toEqual([]);
  });
});
