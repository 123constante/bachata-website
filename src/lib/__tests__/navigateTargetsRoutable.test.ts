import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isRoutable, routePatterns } from './routeTable';

// Every literal navigation target in src/ must be a route that exists. The
// self-serve retirement (2026-09-12) unrouted /onboarding, /profile and the
// create-/edit- pages, and the sign-in callback kept sending people to
// /onboarding -- a 404 straight after a successful sign-in.
//
// Template literals count too: `${...}` becomes one placeholder segment, so
// `/event/${id}` is checked as /event/x.

const SRC = path.resolve(__dirname, '../..');

// Targets that were already unroutable when this guard landed, nearly all in
// pages and dashboards that are themselves no longer routed. A RATCHET: a new
// entry fails, and an entry that disappears must be deleted from here.
// The three sign-in files (AuthCallback, AuthGuard, ProfileEntryRouter) are
// deliberately absent, so they can never be added back by accident.
const KNOWN_UNROUTABLE = new Set([
  'src/components/auth/AuthStepper.tsx -> /profile',
  'src/components/auth/ProfileEntryFlow.tsx -> /profile',
  'src/components/profile/DJDashboard.tsx -> /create-event',
  'src/components/profile/DJDashboard.tsx -> /profile',
  'src/components/profile/DancerDashboard.tsx -> /create-dancers-profile',
  'src/components/profile/OrganiserDashboard.tsx -> /create-event',
  'src/components/profile/OrganiserDashboard.tsx -> /create-organiser-profile',
  'src/components/profile/OrganiserDashboard.tsx -> /event/x/edit',
  'src/components/profile/TeacherDashboard.tsx -> /create-event',
  'src/components/profile/TeacherDashboard.tsx -> /profile',
  'src/components/profile/VendorDashboard.tsx -> /dashboard/vendor',
  'src/components/profile/VendorDashboard.tsx -> /edit-profile',
  'src/components/profile/VendorDashboard.tsx -> /profile?role=x',
  'src/components/profile/VideographerDashboard.tsx -> /create-videographer-profile',
  'src/components/profile/VideographerDashboard.tsx -> /profile',
  'src/pages/CreateVideographerProfile.tsx -> /profile',
  'src/pages/Dancers.tsx -> /create-dancers-profile',
  'src/pages/Dancers.tsx -> /photographers',
  'src/pages/EditProfile.tsx -> /create-dancers-profile',
  'src/pages/EditProfile.tsx -> /profile',
  'src/pages/Onboarding.tsx -> /create-x-profile',
  'src/pages/Onboarding.tsx -> /profile',
  'src/pages/PracticePartners.tsx -> /create-dancers-profile',
  'src/pages/Profile.tsx -> /profile?role=x',
]);

const SIGN_IN_FILES = [
  'src/pages/AuthCallback.tsx',
  'src/components/auth/AuthGuard.tsx',
  'src/components/profile/ProfileEntryRouter.tsx',
];

// navigate('/x'), navigate("/x"), navigate(`/x`), <Navigate to="/x" ...>
const TARGET = /(?:\bnavigate\(\s*|<Navigate\s+to=\{?\s*)(['"`])(\/[^'"`]*)\1/g;

export function navigateTargets(source: string): string[] {
  return [...source.matchAll(TARGET)].map((m) => m[2].replace(/\$\{[^}]*\}/g, 'x'));
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
    navigateTargets(readFileSync(file, 'utf8'))
      .filter((target) => !isRoutable(target, patterns))
      .map((target) => `${rel(file)} -> ${target}`),
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
