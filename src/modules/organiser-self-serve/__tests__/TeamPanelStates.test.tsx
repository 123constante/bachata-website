// @vitest-environment jsdom
/** TeamPanel: focus stays on the question and its answer, and offline is not "no requests". */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider, onlineManager } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

const api = vi.hoisted(() => ({ incoming: vi.fn(), remove: vi.fn(), resolve: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchIncomingAccessRequests: api.incoming,
  removeOrganiserMember: api.remove,
  resolveAccessRequest: api.resolve,
}));

import { TeamPanel } from '../components/TeamPanel';
import type { HomeOrganiser } from '@/modules/organiser/shared/selfServeApi';

const ORG: HomeOrganiser = {
  id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [],
  team: [
    { user_id: 'u1', member_role: 'owner', is_primary: true, is_self: true, email: 'me@x.example', display_name: 'Diego' },
    { user_id: 'u2', member_role: 'manager', is_primary: false, is_self: false, email: 'ana@x.example', display_name: 'Ana' },
  ],
};

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter><TeamPanel organiser={ORG} /></MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  api.incoming.mockReset().mockResolvedValue([]);
  api.remove.mockReset();
  api.resolve.mockReset();
});
afterEach(() => {
  cleanup();
  onlineManager.setOnline(true);
});

describe('remove confirmation focus', () => {
  it('moves focus to the safe answer, and back to Remove after "No, keep them"', async () => {
    mount();
    fireEvent.click(screen.getByTestId('member-remove'));
    const no = screen.getByTestId('member-confirm-no');
    expect(no.textContent).toBe('No, keep them');
    expect(screen.getByTestId('member-confirm-yes').textContent).toContain('Yes, remove');
    expect(document.activeElement).toBe(no);
    fireEvent.click(no);
    expect(document.activeElement).toBe(screen.getByTestId('member-remove'));
  });

  it('focuses the confirmation once the removal lands', async () => {
    api.remove.mockResolvedValue({ selfRemoved: false });
    mount();
    fireEvent.click(screen.getByTestId('member-remove'));
    fireEvent.click(screen.getByTestId('member-confirm-yes'));
    const done = await screen.findByTestId('team-confirmation');
    expect(done.textContent).toContain('Ana no longer has access.');
    await waitFor(() => expect(document.activeElement).toBe(done));
  });
});

describe('access requests', () => {
  it('"Add as manager" asks first, names the person and what a manager can do, and only then grants', async () => {
    api.incoming.mockResolvedValue([{ requestId: 'r1', userId: 'u9', requesterEmail: 'bo@x.example', message: null, createdAt: '2026-10-01T10:00:00Z' }]);
    api.resolve.mockResolvedValue({});
    mount();
    fireEvent.click(await screen.findByTestId('request-grant'));
    expect(api.resolve).not.toHaveBeenCalled();
    const ask = screen.getByTestId('request-grant-confirm').textContent ?? '';
    expect(ask).toContain('Add bo@x.example as a manager?');
    expect(ask).toContain('edit all of Ritmo');
    expect(ask).toContain('cannot add or remove people');
    // "No" backs out without granting and brings the button back.
    fireEvent.click(screen.getByTestId('request-grant-no'));
    expect(api.resolve).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('request-grant'));
    fireEvent.click(screen.getByTestId('request-grant-yes'));
    await waitFor(() => expect(api.resolve).toHaveBeenCalledWith('r1', 'grant'));
  });

  it('offline says so instead of "no one is asking"', async () => {
    onlineManager.setOnline(false);
    mount();
    expect((await screen.findByTestId('requests-offline')).textContent).toContain('offline');
    expect(screen.queryByTestId('requests-empty')).toBeNull();
  });

  it('a failed read says what to do next', async () => {
    api.incoming.mockRejectedValue(new Error('boom'));
    mount();
    await waitFor(() => expect(document.body.textContent).toContain('Check your connection, then try again.'));
  });
});
