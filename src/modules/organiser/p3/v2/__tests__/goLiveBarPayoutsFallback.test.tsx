// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { EventWorkspace } from '../../../events/eventModel';

const check = vi.hoisted(() => ({ value: { data: undefined, isError: false } as { data?: unknown; isError: boolean } }));
const nav = vi.hoisted(() => vi.fn());
vi.mock('react-router-dom', async (orig) => ({ ...((await orig()) as object), useNavigate: () => nav }));
vi.mock('../../../shared/goLiveCheck', async (orig) => ({ ...((await orig()) as object), useGoLiveCheck: () => check.value }));
vi.mock('../../../shared/runCommands', () => ({ eventWorkspaceQueryKey: (id: string) => ['ws', id], useSendOnce: () => vi.fn(), useRunCommands: () => vi.fn() }));
vi.mock('../../screens/Toast', () => ({ useToast: () => ({ run: vi.fn(), show: vi.fn(), node: null }) }));
vi.mock('../../screens/StatusSheet', () => ({ StatusSheet: () => <div data-testid="status-sheet" /> }));
import { GoLiveBar } from '../GoLiveBar';
import { goLiveFixHref } from '../../../shared/goLiveCheck';

const ws = { series: { id: 's1', version: 1, lifecycle_status: 'draft' } } as unknown as EventWorkspace;
const first = (code: string) => {
  check.value = { data: { ready: false, eventMissing: [{ code, section: 'tickets' }], recommended: [], profileRuleApplies: false, profileMissing: [] }, isError: false };
};
const tapFallback = (code: string) => {
  first(code);
  render(<MemoryRouter><GoLiveBar ws={ws} onFix={() => false} /></MemoryRouter>);
  fireEvent.click(screen.getByTestId('golive-fix'));
  return nav.mock.calls[0]?.[0] as string | undefined;
};
afterEach(() => { cleanup(); vi.clearAllMocks(); check.value = { data: undefined, isError: false }; });

describe('GoLiveBar fallback link is code-aware', () => {
  it('ticket_payouts falls back to Get paid, not the ticket-link editor', () => {
    const to = tapFallback('ticket_payouts');
    expect(to).toBe(goLiveFixHref('tickets', 's1', 'ticket_payouts'));
    expect(to).not.toBe(goLiveFixHref('tickets', 's1'));
  });
  it('ticket_link still falls back to the ticket-link editor', () => {
    const to = tapFallback('ticket_link');
    expect(to).toBe(goLiveFixHref('tickets', 's1', 'ticket_link'));
    expect(to).toBe(goLiveFixHref('tickets', 's1'));
  });
});
