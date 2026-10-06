// @vitest-environment jsdom
/** P1-2: while a draft can be sent, the home leads with ONE next-step card and demotes "New event". */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: vi.fn() } }));

import { OrganiserHome } from '../components/OrganiserHome';
import type { HomeOrganiser } from '../selfServeApi';

const organiser = (lifecycle_status: string) =>
  ({ id: 'o1', name: 'Casa Bachata', slug: 'casa', role: 'owner', lifecycle_status, series: [], latest_decision: null }) as unknown as HomeOrganiser;

const mount = (status: string) =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <OrganiserHome organiser={organiser(status)} today="2026-10-05" onSentForReview={() => {}} />
      </MemoryRouter>
    </QueryClientProvider>,
  );

afterEach(cleanup);

describe('OrganiserHome next-step card', () => {
  it('shows the card with a pill primary Send for review and an outline New event for a draft', () => {
    mount('draft');
    expect(screen.getByTestId('next-step-card').textContent).toContain('Next: send Casa Bachata for review.');
    const send = screen.getByTestId('send-for-review');
    expect(send.className).toContain('rounded-full');
    expect(send.className).toContain('min-h-[44px]');
    expect(screen.getByTestId('new-event').className).toContain('border');
  });

  it('shows no card for a live organiser, and New event stays primary', () => {
    mount('live');
    expect(screen.queryByTestId('next-step-card')).toBeNull();
    expect(screen.queryByTestId('send-for-review')).toBeNull();
    expect(screen.getByTestId('new-event').className).toContain('bg-primary');
  });
});
