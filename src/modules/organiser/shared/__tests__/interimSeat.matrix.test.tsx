// @vitest-environment jsdom
/**
 * Interim-seat labels: seat_kind x screen (Team add, own-row label, You tickets row), one mapping.
 * Asserts no text points at a missing control, the replaced control says why, and an untouched
 * screen sends no command (no rpc, no share, no clipboard write until the button is pressed).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a), auth: {} } }));
vi.mock('@/lib/featureFlags', () => ({ flags: { organiserTicketing: true } }));
vi.mock('../../p3/tickets/GetPaid', () => ({ GetPaidRow: () => <a data-testid="get-paid-row">Get paid</a>, GetPaidScreen: () => null }));

import { parseOwnership, parseSeatKind } from '../ownership';
import { INTERIM_LABEL, LINK_COPIED, SHARE_JOIN_LINE, SHARE_JOIN_LINK, TICKETS_INTERIM_LINE, ownRowLabel, teamAddOffer, ticketsRow } from '../teamRules';
import { ShareJoinLink, publicPageUrl } from '../../team/ShareJoinLink';
import { YouTicketsRow } from '../../p3/shell/youTickets';

afterEach(() => { cleanup(); rpc.mockReset(); vi.unstubAllGlobals(); });

const BASE = { is_managed: false, i_own_it: false, my_role: null };
const SHAPES = [
  { seat: 'owner', parsed: 'owner', interim: false },
  { seat: 'manager', parsed: 'manager', interim: false },
  { seat: 'interim', parsed: 'interim', interim: true },
  { seat: 'contributor', parsed: 'contributor', interim: false },
  { seat: null, parsed: null, interim: false },
  { seat: 'junk', parsed: null, interim: false },
] as const;

describe('seat_kind parsing', () => {
  it.each(SHAPES)('seat_kind %j -> %j', ({ seat, parsed }) => {
    expect(parseOwnership({ ...BASE, seat_kind: seat })?.seat_kind).toBe(parsed);
  });
  it('a missing key (signed out, no role) never throws', () => {
    expect(parseOwnership(BASE)?.seat_kind).toBeNull();
    expect(parseSeatKind(undefined)).toBeNull();
    expect(parseSeatKind(42)).toBeNull();
  });
});

describe.each(SHAPES)('seat_kind $seat', ({ seat, interim }) => {
  const s = seat === 'junk' ? null : seat;
  it('Team add: interim shares a link, everyone else keeps the existing gate', () => {
    const o = teamAddOffer(s, 'manager', []);
    expect(o.kind).toBe(interim ? 'share' : 'add');
    expect(o.gate.ok).toBe(true);
    if (!interim) expect(teamAddOffer(s, 'contributor', []).gate.ok).toBe(false);
  });
  it('own-row label: only the caller’s own interim row changes', () => {
    expect(ownRowLabel(s, true)).toBe(interim ? INTERIM_LABEL : null);
    expect(ownRowLabel(s, false)).toBeNull();
  });
  it('You tickets row', () => {
    expect(ticketsRow(s)).toBe(interim ? 'line' : 'row');
    render(<YouTicketsRow seatKind={s} />);
    expect(!!screen.queryByTestId('get-paid-row')).toBe(!interim);
    expect(!!screen.queryByText(TICKETS_INTERIM_LINE)).toBe(interim);
    expect(rpc).not.toHaveBeenCalled();
  });
});

describe('Share a join link', () => {
  it('sends nothing until pressed; the line names Ask to join, which the page has', () => {
    const write = vi.fn(); vi.stubGlobal('navigator', { clipboard: { writeText: write } });
    render(<ShareJoinLink organiserId="o1" organiserName="Org" announce={vi.fn()} />);
    expect(screen.getByText(SHARE_JOIN_LINE).textContent).toContain('Ask to join');
    expect(screen.getByRole('button', { name: new RegExp(SHARE_JOIN_LINK) })).toBeTruthy();
    expect(write).not.toHaveBeenCalled(); expect(rpc).not.toHaveBeenCalled();
  });
  it('copies the public page URL and confirms', async () => {
    const write = vi.fn().mockResolvedValue(undefined); vi.stubGlobal('navigator', { clipboard: { writeText: write } });
    const announce = vi.fn();
    render(<ShareJoinLink organiserId="o1" organiserName="Org" announce={announce} />);
    fireEvent.click(screen.getByTestId('team-share-join-link'));
    await waitFor(() => expect(announce).toHaveBeenCalledWith(LINK_COPIED));
    expect(write).toHaveBeenCalledWith(publicPageUrl(window.location.origin, 'o1'));
    expect(rpc).not.toHaveBeenCalled();
  });
});
