// @vitest-environment jsdom
/** Team fixes: rows stay distinguishable at 390px (no truncation), one visible confirmation. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const api = vi.hoisted(() => ({ home: vi.fn(), incoming: vi.fn(), remove: vi.fn(), resolve: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {} } }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: { id: 'u1', email: 'bachatacommunity.leeds@x.com' }, signOut: vi.fn() }) }));
vi.mock('@/modules/organiser/shared/selfServeApi', async () => ({
  ...(await vi.importActual<object>('@/modules/organiser/shared/selfServeApi')),
  fetchOrganiserHome: api.home,
  fetchIncomingAccessRequests: api.incoming,
  removeOrganiserMember: api.remove,
  resolveAccessRequest: api.resolve,
}));

import TeamPage from '../index';

const LEEDS = 'bachatacommunity.leeds@x.com';
const LONDON = 'bachatacommunity.london@x.com';
const ASKER = 'bachatacommunity.liverpool@x.com';
const TEAM = [
  { user_id: 'u1', member_role: 'owner', is_primary: true, is_self: true, email: LEEDS, display_name: null },
  { user_id: 'u2', member_role: 'owner', is_primary: false, is_self: false, email: LONDON, display_name: null },
];
const ORG = { id: 'org-1', name: 'Ritmo', slug: 'ritmo', avatar_url: null, city_id: null, lifecycle_status: 'live', role: 'owner', latest_decision: null, series: [], team: TEAM };
const REQ = { requestId: 'r1', userId: 'u9', requesterEmail: ASKER, message: null, createdAt: '2026-10-01T10:00:00Z' };

function mount() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={['/account/o/team']}>
        <Routes>
          <Route path="/account/o/team" element={<TeamPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/** Every element whose own text includes `text`, minus screen-reader-only ones. */
const visibleNodesWith = (root: HTMLElement, text: string) =>
  Array.from(root.querySelectorAll<HTMLElement>('*')).filter(
    (el) => Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').includes(text)) && !el.closest('.sr-only'),
  );

beforeEach(() => {
  api.home.mockReset().mockResolvedValue({ today: '2026-10-07', organisers: [ORG] });
  api.incoming.mockReset().mockResolvedValue([REQ]);
  api.resolve.mockReset();
});
afterEach(cleanup);

describe('team rows at 390px', () => {
  it.each([[LEEDS], [LONDON]])('shows %s in full, wrapping instead of truncating', async (email) => {
    mount();
    await screen.findAllByTestId('team-member');
    const nodes = visibleNodesWith(document.body, email);
    expect(nodes.length).toBeGreaterThan(0);
    for (const el of nodes) {
      expect(el.textContent).toContain(email);
      // No ellipsis cut on the email itself or on any wrapper inside its row.
      let cur: HTMLElement | null = el;
      while (cur && cur.getAttribute('data-testid') !== 'team-member') {
        expect(cur.className).not.toMatch(/(^|\s)(truncate|text-ellipsis|line-clamp-\d)(\s|$)/);
        cur = cur.parentElement;
      }
    }
  });

  it('a request row also shows the whole email without truncation', async () => {
    mount();
    await screen.findByTestId('access-request');
    const [el] = visibleNodesWith(screen.getByTestId('access-request'), ASKER);
    expect(el).toBeTruthy();
    expect(el.className).not.toMatch(/(^|\s)truncate(\s|$)/);
  });
});

describe('one confirmation', () => {
  it.each([
    ['grant', `${ASKER} can now edit Ritmo\u2019s events as a manager.`],
    ['decline', `Declined. ${ASKER} can ask again later.`],
  ])('the %s confirmation shows once, and is announced from that same element', async (kind, words) => {
    api.resolve.mockResolvedValue({ requestId: 'r1', decision: kind, memberRole: null });
    mount();
    if (kind === 'grant') {
      fireEvent.click(await screen.findByTestId('request-grant'));
      fireEvent.click(screen.getByTestId('request-grant-confirm-yes'));
    } else {
      fireEvent.click(await screen.findByTestId('request-decline'));
    }
    await waitFor(() => expect(screen.getByTestId('team-confirmation').textContent).toBe(words));
    // Exactly one node in the whole page carries the words (no sr-only twin, no second note).
    const all = Array.from(document.body.querySelectorAll('*')).filter((el) =>
      Array.from(el.childNodes).some((n) => n.nodeType === 3 && (n.textContent ?? '').includes(words)));
    expect(all).toHaveLength(1);
    expect(screen.getByTestId('team-confirmation').getAttribute('role')).toBe('status');
  });
});
