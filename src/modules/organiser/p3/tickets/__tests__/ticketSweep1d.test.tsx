// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { askOwner, startView } from '../GetPaid';
import { addWhy } from '../model';
import { PAYOUTS_ASK_OWNER } from '../../../tickets/ticketModel';
import { DraftTicketsCard, DRAFT_HEADING, DRAFT_LINE } from '../../r4/DraftTicketsCard';
import { org } from './fixtures';

vi.mock('../../../events/eventsApi', () => ({ useEventWorkspace: () => ({ data: undefined }) }));
vi.mock('../../../shared/runCommands', () => ({ useSendOnce: () => vi.fn(), useRunCommands: () => vi.fn() }));

describe('Ticket sweep 1d', () => {
  afterEach(cleanup);
  it('draft card: heading, line, Put it live button', () => {
    render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><DraftTicketsCard seriesId="s1" orgId="o1" /></MemoryRouter></QueryClientProvider>);
    expect(screen.getByTestId('r4-tix-draft-card').textContent).toContain(`${DRAFT_HEADING} ${DRAFT_LINE}`);
    expect(screen.getByTestId('r4-tix-put-live').textContent).toBe('Put it live');
  });
  it('manager Get paid: owner-only note, owner name or The owner, no button', () => {
    const base = { manager: true, owner: false, state: 'none', arrival: 'fresh', phase: null, switchedOff: false } as const;
    const v = startView({ ...base, org: org() });
    expect(v.ownerOnly).toBe(true);
    expect(v.note).toBe('The owner connects payments. Tickets stay off sale until then.');
    expect(v.primary).toBeNull();
    expect(askOwner({ ...org(), team: [{ user_id: 'u1', member_role: 'owner', display_name: 'Rafa' }] } as never)).toBe('Rafa connects payments. Tickets stay off sale until then.');
  });
  it('keep-list: owner hub unchanged, live add enabled, manager greyed reason unchanged', () => {
    const v = startView({ manager: true, owner: true, state: 'none', arrival: 'fresh', phase: null, switchedOff: false, org: org() });
    expect(v.ownerOnly).toBeUndefined();
    expect(v.primary?.kind).toBe('connect');
    expect(addWhy('owner', true)).toBeNull();
    expect(PAYOUTS_ASK_OWNER).toBe('Ask the owner to set up payouts.');
  });
});
