// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PriceSheet, STRIPE_FIRST } from '../sheets';
import type { CreateDraft } from '../model';

vi.mock('../../screens/Sheet', () => ({ Sheet: ({ title, children }: { title: string; children: React.ReactNode }) => <div aria-label={title}>{children}</div> }));
vi.mock('../../screens/PriceCard', () => ({ PriceCard: () => null }));

const draft = (over: Partial<CreateDraft> = {}) => ({ pay: [], prices: [], ticketUrl: '', ...over }) as unknown as CreateDraft;
const mount = (d: CreateDraft, stripe?: Parameters<typeof PriceSheet>[0]['stripe'], onChange = vi.fn()) =>
  render(<PriceSheet d={d} today="2026-11-23" onChange={onChange} onClose={vi.fn()} stripe={stripe} />);

afterEach(cleanup);

describe('create price sheet, Stripe first', () => {
  it('flag off (no stripe prop): today’s sheet, ticket link chip kept, no card', () => {
    mount(draft());
    expect(screen.getByText('How do dancers pay?')).toBeTruthy();
    expect(screen.getByTestId('p3-new-pay-ticket_link')).toBeTruthy();
    expect(screen.queryByTestId('p3-new-stripe-card')).toBeNull();
  });
  it('not connected: card first, Other ways chips, ticket input hidden until the link is tapped', () => {
    const onChange = vi.fn();
    const onConnect = vi.fn();
    mount(draft(), { connected: false, busy: false, why: null, onConnect }, onChange);
    expect(screen.getByText(STRIPE_FIRST.body)).toBeTruthy();
    expect(screen.getByText(STRIPE_FIRST.other)).toBeTruthy();
    expect(screen.queryByTestId('p3-new-pay-ticket_link')).toBeNull();
    for (const m of ['door', 'bank_transfer', 'cash', 'free']) expect(screen.getByTestId(`p3-new-pay-${m}`)).toBeTruthy();
    expect(screen.queryByTestId('p3-new-ticket')).toBeNull();
    fireEvent.click(screen.getByTestId('p3-new-stripe-connect'));
    expect(onConnect).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('p3-new-own-site'));
    expect(onChange).toHaveBeenCalledWith({ pay: ['ticket_link'] });
    expect(screen.getByTestId('p3-new-ticket')).toBeTruthy();
  });
  it('connect is disabled with its reason when the draft cannot be saved yet', () => {
    mount(draft(), { connected: false, busy: false, why: 'Add a name first.', onConnect: vi.fn() });
    expect((screen.getByTestId('p3-new-stripe-connect') as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByTestId('p3-new-stripe-why').textContent).toBe('Add a name first.');
  });
  it('connected: no Connect button', () => {
    mount(draft(), { connected: true, busy: false, why: null, onConnect: vi.fn() });
    expect(screen.getByText(STRIPE_FIRST.connectedBody)).toBeTruthy();
    expect(screen.queryByTestId('p3-new-stripe-connect')).toBeNull();
  });
});
