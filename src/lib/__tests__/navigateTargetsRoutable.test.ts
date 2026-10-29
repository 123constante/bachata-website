import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRoutable, routePatterns } from './routeTable';
import { ACCOUNT_HOME_PATH, DANCER_HOME_PATH, MY_ATTENDANCE_PATH, ORGANISER_HOME_PATH } from '@/lib/accountRouting';
import { FINISH_PROFILE_PATH, finishProfileHref } from '@/lib/profileCompletion';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';

// Every literal navigation target in src/ must be a route that exists. The
// self-serve retirement (2026-09-12) unrouted /onboarding, /profile and the
// create-/edit- pages, and the sign-in callback kept sending people to
// /onboarding -- a 404 straight after a successful sign-in.
//
// Template literals count too: `${...}` becomes one placeholder segment, so
// `/event/${id}` is checked as /event/x. A `${...}` glued INSIDE a path segment
// (`/bachata-london-${day}`) passes when some LITERAL route fits it
// (/bachata-london-monday), so `/create-${role}-profile` still fails.
//
// Links count as well as navigate() (2026-10-11, dancer home): <Link to="/x">,
// to={`/x`}, href="/x" and GlobalLayout's backHref="/x".

const SRC = path.resolve(__dirname, '../..');

// Targets that were already unroutable when this guard landed, nearly all in
// pages and dashboards that are themselves no longer routed. A RATCHET: a new
// entry fails, and an entry that disappears must be deleted from here.
// The three sign-in files (AuthCallback, AuthGuard, ProfileEntryRouter) are
// deliberately absent, so they can never be added back by accident.
const KNOWN_UNROUTABLE = new Set([
  'src/components/profile/DJDashboard.tsx -> /create-event',
  'src/components/profile/DJDashboard.tsx -> /profile',
  'src/components/profile/DancerDashboard.tsx -> /create-dancers-profile',
  'src/components/profile/OrganiserDashboard.tsx -> /create-event',
  'src/components/profile/OrganiserDashboard.tsx -> /event/x/edit',
  'src/components/profile/TeacherDashboard.tsx -> /create-event',
  'src/components/profile/TeacherDashboard.tsx -> /profile',
  'src/components/profile/VendorDashboard.tsx -> /dashboard/vendor',
  'src/components/profile/VendorDashboard.tsx -> /edit-profile',
  'src/components/profile/VendorDashboard.tsx -> /profile?role=x',
  'src/components/profile/VideographerDashboard.tsx -> /create-videographer-profile',
  'src/components/profile/VideographerDashboard.tsx -> /profile',
  'src/pages/CreateVideographerProfile.tsx -> /profile',
  'src/pages/CreateVideographerProfile.tsx -> /profile?role=videographer',
  'src/pages/Dancers.tsx -> /create-dancers-profile',
  'src/pages/Dancers.tsx -> /photographers',
  'src/pages/EditProfile.tsx -> /create-dancers-profile',
  'src/pages/EditProfile.tsx -> /profile',
  'src/pages/Onboarding.tsx -> /create-x-profile',
  'src/pages/Onboarding.tsx -> /profile',
  'src/pages/PracticePartners.tsx -> /create-dancers-profile',
  'src/pages/Profile.tsx -> /profile?role=x',
  'src/pages/VendorDashboardPage.tsx -> /profile?role=vendor',
  // Found when links joined the scan (2026-10-11); out of the dancer-home PR's
  // scope (listed in its body). Fix the link, then delete the entry.
  'src/components/PartnersMarquee.tsx -> /partners',
]);

const SIGN_IN_FILES = [
  'src/pages/AuthCallback.tsx',
  'src/components/auth/AuthGuard.tsx',
  'src/components/profile/ProfileEntryRouter.tsx',
];

// navigate('/x'), navigate("/x"), navigate(`/x`), <Navigate to="/x" ...>
const TARGET = /(?:\bnavigate\(\s*|<Navigate\s+to=\{?\s*)(['"`])(\/[^'"`]*)\1/g;
// <Link to="/x">, to={`/x`}, href="/x", backHref="/x" (not "//host": off-site).
const LINK = /(?<![\w.])(?:to|href|backHref)=\{?\s*(['"`])(\/(?!\/)[^'"`]*)\1/g;

const PLACEHOLDER = /\$\{[^}]*\}/g;
/** How a target is reported: each `${...}` as `x`. */
const shown = (raw: string) => raw.replace(PLACEHOLDER, 'x');

function rawTargets(source: string, opts: { links?: boolean } = {}): string[] {
  const found = [...source.matchAll(TARGET)].map((m) => m[2]);
  if (opts.links) found.push(...[...source.matchAll(LINK)].map((m) => m[2]));
  return found;
}

export function navigateTargets(source: string, opts: { links?: boolean } = {}): string[] {
  return rawTargets(source, opts).map(shown);
}

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/**
 * Would a template target render a page? `x` stands in for each placeholder, so
 * a whole-segment one matches any :param. One glued inside a PATH segment also
 * passes when a literal route fits it. Placeholders after ? or # never decide.
 */
export function routableTemplate(raw: string, patterns: string[] = routePatterns()): boolean {
  if (isRoutable(shown(raw), patterns)) return true;
  const cut = raw.search(/[?#]/);
  const pathPart = cut === -1 ? raw : raw.slice(0, cut);
  const glued = [...pathPart.matchAll(PLACEHOLDER)].some((m) => {
    const after = pathPart[m.index + m[0].length];
    return pathPart[m.index - 1] !== '/' || (after !== undefined && after !== '/');
  });
  if (!glued) return false;
  const fits = new RegExp(`^${pathPart.split(PLACEHOLDER).map(escapeRe).join('[^/]+')}$`);
  return patterns.some((p) => !/[:*]/.test(p) && fits.test(p));
}

const collect = (dir: string): string[] =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === '__tests__' ? [] : collect(full);
    if (!/\.(ts|tsx)$/.test(e.name) || /\.(test|spec)\.tsx?$/.test(e.name) || e.name.endsWith('.d.ts')) return [];
    return [full];
  });

const rel = (file: string) => path.relative(path.resolve(SRC, '..'), file).split(path.sep).join('/');

function violations(): string[] {
  const patterns = routePatterns();
  return collect(SRC).flatMap((file) =>
    rawTargets(readFileSync(file, 'utf8'), { links: true })
      .filter((raw) => !routableTemplate(raw, patterns))
      .map((raw) => `${rel(file)} -> ${shown(raw)}`),
  );
}

describe('route table', () => {
  it('reads both route sources', () => {
    const patterns = routePatterns();
    expect(patterns).toContain('/auth');
    expect(patterns).toContain('/event/:id');
    expect(patterns).toContain('/');
  });

  it('knows a retired route is not routable', () => {
    expect(isRoutable('/onboarding?authFallback=profile')).toBe(false);
    expect(isRoutable('/profile')).toBe(false);
  });

  it('knows live routes are routable, optional segments included', () => {
    expect(isRoutable('/')).toBe(true);
    expect(isRoutable('/account')).toBe(true);
    expect(isRoutable('/account/team')).toBe(true);
    expect(isRoutable('/account/team/abc')).toBe(true);
    expect(isRoutable('/auth?mode=signin&returnTo=%2Faccount')).toBe(true);
  });
});

describe('navigate targets', () => {
  it('extracts every literal form, templates included', () => {
    expect(navigateTargets("navigate('/a'); navigate(\"/b\", { replace: true }); navigate(`/c/${id}?q=1`); <Navigate to=\"/d\" replace />"))
      .toEqual(['/a', '/b', '/c/x?q=1', '/d']);
  });

  it('the sign-in files only ever navigate to routes that exist', () => {
    for (const file of SIGN_IN_FILES) {
      const source = readFileSync(path.resolve(SRC, '..', file), 'utf8');
      const targets = navigateTargets(source);
      expect(targets.length, file).toBeGreaterThan(0);
      for (const target of targets) {
        expect(isRoutable(target), `${file} -> ${target}`).toBe(true);
      }
      expect(source, file).not.toMatch(/['"`]\/onboarding\b/);
    }
  });

  it('no file in src/ adds a navigation to a route that does not exist', () => {
    const found = violations();
    const added = found.filter((v) => !KNOWN_UNROUTABLE.has(v));
    expect(added).toEqual([]);
  });

  it('the known-unroutable list holds no entry that is already fixed', () => {
    const found = new Set(violations());
    const stale = [...KNOWN_UNROUTABLE].filter((v) => !found.has(v));
    expect(stale).toEqual([]);
  });
});

describe('link targets', () => {
  it('extracts Link, href and backHref forms (not off-site //host, not obj.to=)', () => {
    expect(
      navigateTargets(
        '<Link to="/a">; <Link to={`/b/${id}`}>; <a href="/c?x=1">; backHref="/d"; href="//cdn.example/x"; to={`/london-${day}`}; foo.to="/no"',
        { links: true },
      ),
    ).toEqual(['/a', '/b/x', '/c?x=1', '/d', '/london-x']);
  });

  it.each([
    ['/event/${id}', true],
    ['/event/${id}?occ=${occ}#${anchor}', true],
    ['/bachata-london-${day}', true],
    ['/create-${role}-profile', false],
    ['/gone?x=${v}', false],
    ['/gone#${a}', false],
    ['/profile?role=${role}', false],
  ])('template %s routable: %s', (raw, want) => {
    expect(routableTemplate(raw)).toBe(want);
  });
});

// The shared path constants every account link is built from. Table-driven: a
// constant that stops matching a route fails here by name.
describe.each([
  ['ACCOUNT_HOME_PATH', ACCOUNT_HOME_PATH],
  ['MY_ATTENDANCE_PATH', MY_ATTENDANCE_PATH],
  ['DANCER_HOME_PATH', DANCER_HOME_PATH],
  ['ORGANISER_HOME_PATH', ORGANISER_HOME_PATH],
  ['FINISH_PROFILE_PATH', FINISH_PROFILE_PATH],
  ["finishProfileHref('/account')", finishProfileHref(ACCOUNT_HOME_PATH)],
  ["finishProfileHref('/event/e1#level-rating')", finishProfileHref('/event/e1#level-rating')],
  ...Object.entries(ORG_PATHS).map(([k, v]) => [`ORG_PATHS.${k}`, typeof v === 'function' ? (v as (...a: string[]) => string)('s1', 'o1') : v] as [string, string]),
])('%s', (_name, target) => {
  it(`${target} is a route`, () => {
    expect(isRoutable(target)).toBe(true);
  });
});
