// @vitest-environment jsdom
// Site structure S3c-2: /for-organisers page.
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, cleanup } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { readFileSync } from 'node:fs';

const flagState = vi.hoisted(() => ({ organiserTicketing: true, rafflesPage: true }));

vi.mock('@/lib/featureFlags', () => ({ flags: flagState }));
vi.mock('@/components/layout/GlobalLayout', () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }));

import ForOrganisers from '@/pages/ForOrganisers';
import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';
import { buildSignInHref } from '@/lib/authRouting';
import { APP_PATHS } from '../app/lib/eventRootForward';

const renderPage = () =>
  render(
    <MemoryRouter>
      <ForOrganisers />
    </MemoryRouter>,
  );

afterEach(cleanup);

describe('ForOrganisers', () => {
  it('both flags on: h1, 4 buttons, right destinations', () => {
    flagState.organiserTicketing = true;
    flagState.rafflesPage = true;
    const { container } = renderPage();
    expect(container.querySelector('h1')?.textContent).toBe('For organisers');
    const links = Array.from(container.querySelectorAll('a'));
    expect(links).toHaveLength(4);
    const wa = links.find((a) => a.textContent === 'Message us on WhatsApp')!;
    expect(wa.getAttribute('href')).toBe(WHATSAPP_GET_LISTED_URL);
    expect(wa.getAttribute('target')).toBe('_blank');
    expect(links.find((a) => a.textContent === 'See raffles')!.getAttribute('href')).toBe('/raffles');
    const signIn = buildSignInHref('/account');
    for (const label of ['Sign in', 'Sign in to sell tickets']) {
      const href = links.find((a) => a.textContent === label)!.getAttribute('href')!;
      expect(href.startsWith(signIn.split('?')[0])).toBe(true);
    }
  });

  it('both flags off: only cards a and b', () => {
    flagState.organiserTicketing = false;
    flagState.rafflesPage = false;
    const { container } = renderPage();
    expect(container.querySelectorAll('a')).toHaveLength(2);
    expect(container.querySelector('a[href="/raffles"]')).toBeNull();
    expect(container.textContent).not.toContain('Sell tickets');
  });

  it('is a known site segment and a registered route', () => {
    expect(APP_PATHS.has('for-organisers')).toBe(true);
    expect(readFileSync('app/routes.ts', 'utf8')).toContain('routes/for-organisers.tsx');
  });
});
