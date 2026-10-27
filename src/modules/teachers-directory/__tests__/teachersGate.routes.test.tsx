// @vitest-environment jsdom
/**
 * S1 (critique of PR #1049): the teachers directory's flag gate, pinned on the
 * REAL route table. With flags.teachersDirectory OFF, both /teachers and
 * /city/:slug/teachers must render the ComingSoonGate placeholder and never the
 * directory. Before this file, removing teachersGate(...) from the new route
 * left every test green.
 *
 * The page modules are stubbed with the directory's own heading test id, so an
 * ungated route renders that heading and this spec reds.
 */
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/lib/featureFlags', async (importOriginal) => {
  const real = await importOriginal<typeof import('@/lib/featureFlags')>();
  return { ...real, flags: { ...real.flags, teachersDirectory: false } };
});
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/hooks/useNoindexMeta', () => ({ useNoindexMeta: () => undefined }));
vi.mock('@/components/layout/GlobalLayout', () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('@/components/ListingRequestForm', () => ({ default: () => <form data-testid="listing-request-form" /> }));
vi.mock('@/pages/Teachers', () => ({ default: () => <h2 data-testid="teachers-city-heading">Bachata Teachers in London</h2> }));
vi.mock('@/modules/teachers-directory/TeachersCityRedirect', () => ({
  default: () => <h2 data-testid="teachers-city-heading">redirected</h2>,
}));

import { AnimatedRoutes } from '@/components/AnimatedRoutes';

afterEach(cleanup);

describe('teachers directory with the flag OFF', () => {
  it.each(['/teachers', '/city/london-gb/teachers'])('%s renders the coming-soon gate, not the directory', async (path) => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={[path]}>
          <AnimatedRoutes />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect((await screen.findByRole('heading', { level: 1 })).textContent).toMatch(/Coming soon/);
    expect(screen.getByTestId('listing-request-form')).toBeTruthy();
    // Give a lazily loaded, ungated page the chance to appear before asserting absence.
    await new Promise((r) => setTimeout(r, 50));
    await waitFor(() => expect(screen.queryByTestId('teachers-city-heading')).toBeNull());
  });
});
