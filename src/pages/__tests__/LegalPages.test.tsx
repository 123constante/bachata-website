// @vitest-environment jsdom
/**
 * /privacy and /terms: each renders its heading, the footer links to both, both
 * are reachable as client paths, and no owner placeholder remains and the contact block
 * shows the operator name and the support mailto.
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
const PLACEHOLDER = '[OWN' + 'ER:';
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
  it('no owner placeholder is left in the legal sources', () => {
    for (const f of ['src/pages/Privacy.tsx', 'src/pages/Terms.tsx', 'src/pages/legal/LegalShell.tsx']) {
      expect(read(f)).not.toContain(PLACEHOLDER);
    }
  });
  it.each([['Privacy', Privacy], ['Terms', Terms]])('%s renders the operator name and mailto, no placeholder', (_n, Page) => {
    const { container } = wrap(<Page />);
    expect(container.textContent).not.toContain(PLACEHOLDER);
    expect(container.textContent).toContain('Bachata Calendar');
    expect(container.textContent).not.toMatch(/postal address/i);
    const mail = container.querySelector('a[href="mailto:support@bachatacalendar.co.uk"]');
    expect(mail).toBeTruthy();
  });
  it('Privacy states the owner deletion decision: hidden at once, 30 days to restore, kept, erasure on request', () => {
    const { container } = wrap(<Privacy />);
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('30 days');
    expect(text).toContain('hidden from everyone at once');
    expect(text).toContain('Art. 17');
    expect(text).toContain('ask us to erase your data permanently at the contact address below');
    expect(text).not.toMatch(/(delet|eras)\w*[^.]{0,40}immediately/i);
    expect(text).not.toMatch(/immediately[^.]{0,40}(delet|eras)/i);
    expect(text).not.toMatch(/erased for good/i);
    expect(text).not.toMatch(/grace period/i);
  });
  it('Terms does not promise erasure on delete', () => {
    const { container } = wrap(<Terms />);
    const text = (container.textContent ?? '').replace(/\s+/g, ' ');
    expect(text).toContain('30 days');
    expect(text).not.toMatch(/immediately/i);
  });
});
