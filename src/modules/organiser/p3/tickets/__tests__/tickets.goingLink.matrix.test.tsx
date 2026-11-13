// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen } from '@testing-library/react';
import { externalTicketLine, goingCountLine } from '../../../tickets/ticketModel';
import { SHAPES, type, type Shape } from './fixtures';
import { dataMock, load, q, show } from './harness';

/*
 * Organiser area v2 slice 2, CONTINUATION 1: the free event's Going count (6.4-r05, T4 / Q16) and the
 * external ticket link line (6.4-r09, X5), screen x role (owner, manager, legacy contributor row A1)
 * x shape. Plus r04 (zero state, the two paused types) and the counts-only orders read (r02).
 * Both lines are counts and words only: no amount for any role. The pound sign is matched by escape.
 */

vi.mock('@/lib/londonDate', async (orig) => ({ ...(await orig<typeof import('@/lib/londonDate')>()), londonTodayKey: () => '2026-10-27' }));
vi.mock('../data', (orig) => dataMock(orig as never));
vi.mock('../../../tickets/ticketsApi', async (orig) => ({ ...(await orig<typeof import('../../../tickets/ticketsApi')>()), setTicketStatus: vi.fn(), upsertTicketType: vi.fn(), refundOrder: vi.fn() }));

import { TicketsEntry } from '../TicketsEntry';

afterEach(cleanup);

const POUND = /£/;
const ROLES = ['owner', 'manager', 'contributor'] as const;
// Prod 2026-11-10: event_attendance 7 rows. Nights as get_my_series_going_v1 gives them.
const NIGHTS_7 = [
  { is_cancelled: false, going_count: 4 },
  { is_cancelled: false, going_count: 3 },
  { is_cancelled: true, going_count: 9 },
];
const LINK = 'https://www.example-tickets.test/e/123?utm=x';
const freeType = type('t-free', { pricePence: 0, status: 'on_sale' });
const pausedPaid = type('t-paid', { pricePence: 1000, status: 'paused' });

interface Case {
  name: string;
  shape: Omit<Shape, 'role'>;
  going: typeof NIGHTS_7 | null;
  link: string | null;
  goingLine: boolean;
  externalLine: boolean;
}
const CASES: Case[] = [
  { name: 'free event with RSVPs, no types (r05)', shape: SHAPES.bare, going: NIGHTS_7, link: null, goingLine: true, externalLine: false },
  { name: 'free event with RSVPs, a free type (r05)', shape: { ...SHAPES.bare, types: [freeType] }, going: NIGHTS_7, link: null, goingLine: true, externalLine: false },
  { name: 'paid type and RSVPs: sales speak, no Going line', shape: { ...SHAPES.bare, types: [pausedPaid] }, going: NIGHTS_7, link: null, goingLine: false, externalLine: false },
  { name: 'free event, nobody going yet', shape: SHAPES.bare, going: [{ is_cancelled: false, going_count: 0 }], link: null, goingLine: false, externalLine: false },
  { name: 'Going not read yet', shape: SHAPES.bare, going: null, link: null, goingLine: false, externalLine: false },
  { name: 'ticket link, no types (r09)', shape: SHAPES.bare, going: null, link: LINK, goingLine: false, externalLine: true },
  { name: 'ticket link and a type: types sell here, no line', shape: { ...SHAPES.bare, types: [pausedPaid] }, going: null, link: LINK, goingLine: false, externalLine: false },
  { name: 'ticket link, no types, RSVPs: both lines', shape: SHAPES.bare, going: NIGHTS_7, link: LINK, goingLine: true, externalLine: true },
  { name: 'zero state, no link, no RSVPs (r04)', shape: SHAPES.bare, going: [], link: null, goingLine: false, externalLine: false },
  { name: 'the two paused prod types (r04)', shape: SHAPES.survey, going: NIGHTS_7, link: null, goingLine: false, externalLine: false },
];

const open = (c: Case, role: string) => {
  load({ ...c.shape, role } as Shape);
  q.going = c.going;
  q.ticketLink = c.link;
  show(<TicketsEntry seriesId="ser-1" />);
  fireEvent.click(screen.getByTestId('tix-row'));
};

describe.each(ROLES)('Tickets Going and external link, %s', (role) => {
  it.each(CASES)('$name', (c) => {
    open(c, role);
    const going = screen.queryByTestId('tix-going-count');
    const ext = screen.queryByTestId('tix-external-link');
    expect(going?.textContent ?? null).toBe(c.goingLine ? goingCountLine(c.going, c.shape.types) : null);
    expect(ext?.textContent ?? null).toBe(c.externalLine ? externalTicketLine(c.link, c.shape.types) : null);
    if (going) expect(going.textContent).not.toMatch(POUND);
    if (ext) {
      expect(ext.textContent).not.toMatch(POUND);
      // X5: no payment controls on that event's Tickets view.
      expect(screen.queryByTestId('tix-return-banner')).toBeNull();
      expect(screen.getByTestId('tix-list-view').textContent).not.toMatch(/payments connected/i);
    }
    if (c.shape.types.length === 0) expect(screen.getByTestId('tix-types-empty')).toBeTruthy();
  });
  it('orders read asks for money only for the owner (r02)', () => {
    open(CASES[0], role);
    expect(q.ordersMoney).toBe(role === 'owner');
  });
});

describe('Going and link lines (model)', () => {
  it('counts only nights that still happen', () => {
    expect(goingCountLine(NIGHTS_7, [])).toBe('7 going across 2 nights. Free event: no money is taken here.');
    expect(goingCountLine([{ is_cancelled: false, going_count: 1 }], [])).toBe('1 going across 1 night. Free event: no money is taken here.');
    expect(goingCountLine([{ is_cancelled: true, going_count: 5 }], [])).toBeNull();
  });
  it('names the link host, never the whole URL', () => {
    const line = externalTicketLine(LINK, []) ?? '';
    expect(line).toContain('example-tickets.test');
    expect(line).not.toContain('utm');
    expect(externalTicketLine('not a url', [])).toContain('your own ticket link');
    expect(externalTicketLine(null, [])).toBeNull();
  });
});
