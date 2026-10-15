// @vitest-environment jsdom
/**
 * /privacy and /terms: each renders its heading, the footer links to both, both
 * are reachable as client paths, and every [OWNER: ...] placeholder is one the
 * handover/PR lists (the count is pinned so a new one cannot slip in unlisted).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));
vi.mock('@/lib/seo', async (orig) => ({ ...(await orig<object>()), useSeo: () => undefined }));

import Privacy from '@/pages/Privacy';
import Terms from '@/pages/Terms';
import { FooterLinks } from '@/lib/contactLinks';
import { PRIVACY_VERSION, TERMS_VERSION } from '@/lib/legalVersions';

afterEach(cleanup);
const wrap = (ui: ReactNode) => render(<MemoryRouter>{ui}</MemoryRouter>);
const read = (p: string) => readFileSync(path.resolve(__dirname, '../../..', p), 'utf8');

describe('legal pages', () => {
  it('Privacy renders its heading and Last updated from the constant', () => {
    wrap(<Privacy />);
    expect(screen.getByRole('heading', { level: 1, name: /privacy/i })).toBeTruthy();
    expect(screen.getByText(new RegExp(`Last updated ${PRIVACY_VERSION}`))).toBeTruthy();
  });
  it('Terms renders its heading and Last updated from the constant', () => {
    wrap(<Terms />);
    expect(screen.getByRole('heading', { level: 1, name: /terms/i })).toBeTruthy();
    expect(screen.getByText(new RegExp(`Last updated ${TERMS_VERSION}`))).toBeTruthy();
  });
  it('versions match the accept_terms_v1 format', () => {
    for (const v of [TERMS_VERSION, PRIVACY_VERSION]) expect(v).toMatch(/^[0-9A-Za-z._-]{1,32}$/);
  });
  it('the footer links to both pages', () => {
    wrap(<FooterLinks />);
    expect(screen.getByRole('link', { name: 'Privacy' }).getAttribute('href')).toBe('/privacy');
    expect(screen.getByRole('link', { name: 'Terms' }).getAttribute('href')).toBe('/terms');
  });
  it('both are client catchall paths and routed', () => {
    const paths = read('src/components/catchallClientPaths.ts');
    const routes = read('src/components/AnimatedRoutes.tsx');
    for (const p of ['/privacy', '/terms']) {
      expect(paths).toContain(`'${p}'`);
      expect(routes).toContain(`path="${p}"`);
    }
  });
  it('owner placeholders: exactly the pinned count (listed in the PR body)', () => {
    const found = ['src/pages/Privacy.tsx', 'src/pages/Terms.tsx', 'src/pages/legal/LegalShell.tsx']
      .map((f) => (read(f).match(/\[OWNER:/g) ?? []).length)
      .reduce((a, b) => a + b, 0);
    expect(found).toBe(3);
  });
});
