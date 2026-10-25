// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const h = vi.hoisted(() => ({ rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => h.rpc(...a) } }));
vi.mock('@/components/ui/city-picker', () => ({
  CityPicker: ({ onChange, id }: { onChange: (v: string) => void; id?: string }) => <button type="button" id={id} data-testid="city" onClick={() => onChange('city-1')}>city</button>,
}));

import { AddOrganiser } from '../AddOrganiser';
import { FrontDoorList } from '../FrontDoorList';
import { NeedsYou } from '../NeedsYou';

const wrap = (ui: ReactNode) => render(<QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{ui}</QueryClientProvider>);
const ok = (d: unknown) => Promise.resolve({ data: d, error: null });
beforeEach(() => h.rpc.mockReset());
afterEach(cleanup);

const fill = () => {
  fireEvent.change(screen.getByTestId('add-organiser-name'), { target: { value: 'Salsa Co' } });
  fireEvent.change(screen.getByTestId('add-contact-name'), { target: { value: 'Ann Lee' } });
  fireEvent.click(screen.getByTestId('city'));
};

describe('Add organiser', () => {
  it('untouched form sends nothing and says why', () => {
    wrap(<AddOrganiser onOpenList={() => {}} />);
    expect((screen.getByTestId('add-submit') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.submit(screen.getByTestId('add-organiser'));
    expect(h.rpc).not.toHaveBeenCalled();
    expect(screen.getByTestId('add-blocked').textContent).toMatch(/Fill in/);
  });
  it('double submit sends once; created copy shown', async () => {
    h.rpc.mockImplementation(() => ok({ success: true, organiser_id: 'o1', invite_queued: true, run_by_us: false, person_reused: false, warnings: [] }));
    wrap(<AddOrganiser onOpenList={() => {}} />);
    fill();
    fireEvent.change(screen.getByTestId('add-contact-email'), { target: { value: 'a@b.co' } });
    fireEvent.submit(screen.getByTestId('add-organiser'));
    fireEvent.submit(screen.getByTestId('add-organiser'));
    await screen.findByTestId('add-outcome');
    expect(h.rpc).toHaveBeenCalledTimes(1);
    expect(h.rpc.mock.calls[0][1].p_payload).toMatchObject({ contact_email: 'a@b.co', run_by_us: false, city_id: 'city-1' });
    expect(screen.getByTestId('add-outcome').textContent).toMatch(/nothing is sent until you tap Send/);
  });
  it('Run by us clears and disables the email, says why, sends no email', async () => {
    h.rpc.mockImplementation(() => ok({ success: true, organiser_id: 'o1', invite_queued: false, run_by_us: true, warnings: [] }));
    wrap(<AddOrganiser onOpenList={() => {}} />);
    fill();
    fireEvent.change(screen.getByTestId('add-contact-email'), { target: { value: 'a@b.co' } });
    fireEvent.click(screen.getByTestId('add-run-by-us'));
    const email = screen.getByTestId('add-contact-email') as HTMLInputElement;
    expect(email.disabled).toBe(true);
    expect(email.value).toBe('');
    expect(screen.getByTestId('add-rbu-why').textContent).toMatch(/no invite/);
    fireEvent.submit(screen.getByTestId('add-organiser'));
    await screen.findByTestId('add-outcome');
    expect(h.rpc.mock.calls[0][1].p_payload).not.toHaveProperty('contact_email');
  });
  it('coded error lands under its field', async () => {
    h.rpc.mockImplementation(() => ok({ success: false, code: 'EMAIL_INVALID', errors: [{ code: 'EMAIL_INVALID', field: 'contact_email' }] }));
    wrap(<AddOrganiser onOpenList={() => {}} />);
    fill();
    fireEvent.submit(screen.getByTestId('add-organiser'));
    expect((await screen.findByTestId('add-error-contact_email')).textContent).toMatch(/does not look right/);
  });
  it('already exists links to it; network error is a sentence', async () => {
    h.rpc.mockImplementationOnce(() => ok({ success: true, already_exists: true, organiser_id: 'o9', run_by_us: true, invite_queued: false }));
    wrap(<AddOrganiser onOpenList={() => {}} />);
    fill();
    fireEvent.submit(screen.getByTestId('add-organiser'));
    expect((await screen.findByTestId('add-open-organiser')).getAttribute('href')).toBe('/organisers/o9');
    h.rpc.mockImplementationOnce(() => Promise.reject(new Error('net')));
    fireEvent.change(screen.getByTestId('add-organiser-name'), { target: { value: 'Other' } });
    fireEvent.submit(screen.getByTestId('add-organiser'));
    expect((await screen.findByTestId('add-error-form')).textContent).toMatch(/not added/);
  });
});

const item = (o: Record<string, unknown>) => ({ organiser_id: 'o', name: 'Org', city_id: 'c', chip: 'invited', invite_status: 'queued', invite_requested: false, reminder_status: 'none', events_published_count: 0, ...o });

describe('Organisers list', () => {
  it('send ok, double tap once, then error codes in words', async () => {
    let n = 0;
    h.rpc.mockImplementation((fn: string) => {
      if (fn === 'admin_list_organisers_front_door_v1') return ok({ items: [item({ organiser_id: 'a', name: 'Alpha' }), item({ organiser_id: 'b', name: 'Beta', chip: 'joined', invite_status: 'none' })] });
      if (fn === 'admin_send_organiser_invite_v1') { n += 1; return ok(n === 1 ? { success: true, status: 'queued' } : { success: false, code: 'ALREADY_JOINED' }); }
      return ok(null);
    });
    wrap(<FrontDoorList onAdd={() => {}} />);
    await screen.findAllByTestId('fd-row');
    const sends = screen.getAllByTestId('fd-send') as HTMLButtonElement[];
    expect(sends[1].disabled).toBe(true);
    expect(screen.getByTestId('fd-send-reason').textContent).toMatch(/Already joined/);
    fireEvent.click(sends[0]);
    fireEvent.click(sends[0]);
    await waitFor(() => expect(screen.getByTestId('fd-note').textContent).toBe('Invite will go out.'));
    expect(n).toBe(1);
  });
  it('filter chips and empty state with a next step', async () => {
    h.rpc.mockImplementation(() => ok({ items: [item({ chip: 'live' })] }));
    wrap(<FrontDoorList onAdd={() => {}} />);
    await screen.findByTestId('fd-list');
    fireEvent.click(screen.getByTestId('fd-filter-joined'));
    expect(screen.getByTestId('fd-empty').textContent).toMatch(/Add an organiser/);
    expect(screen.queryByText('live')).toBeNull();
  });
  it('run by us toggle calls the rpc with the new value', async () => {
    h.rpc.mockImplementation((fn: string) => fn === 'admin_set_run_by_us_v1' ? ok({ success: true, run_by_us: true, changed: true }) : ok({ items: [item({})] }));
    wrap(<FrontDoorList onAdd={() => {}} />);
    fireEvent.click(await screen.findByTestId('fd-run-by-us'));
    await screen.findByTestId('fd-note');
    expect(h.rpc).toHaveBeenCalledWith('admin_set_run_by_us_v1', { p_organiser_id: 'o', p_value: true });
  });
});

describe('Needs you', () => {
  it('empty state says what to do', async () => {
    h.rpc.mockImplementation(() => ok({ items: [], counts: {} }));
    wrap(<NeedsYou onAdd={() => {}} />);
    expect((await screen.findByTestId('needs-empty')).textContent).toMatch(/Nothing needs you right now.*add an organiser/);
  });
  it('mismatch has Approve/Decline only; coded refusal in words; double tap once', async () => {
    let n = 0;
    h.rpc.mockImplementation((fn: string) => {
      if (fn === 'admin_needs_you_v1') return ok({ items: [
        { id: 'm1', reason: 'email_mismatch_claim', organiser_id: 'o1', label: 'Alpha', detail: 'Ann (a@b.co) signed in', next_actions: ['approve_full', 'decline'] },
        { id: 'q1', reason: 'quiet_30_days', organiser_id: 'o2', label: 'Quiet', detail: null, next_actions: [] },
      ] });
      n += 1;
      return ok({ success: false, code: 'CLAIMANT_IS_ADMIN' });
    });
    wrap(<NeedsYou onAdd={() => {}} />);
    await screen.findAllByTestId('needs-item');
    expect(screen.getAllByTestId('needs-approve')).toHaveLength(1);
    expect(screen.getByTestId('needs-detail').textContent).toMatch(/Ann/);
    fireEvent.click(screen.getByTestId('needs-approve'));
    fireEvent.click(screen.getByTestId('needs-approve'));
    expect((await screen.findByTestId('needs-note')).textContent).toMatch(/already have access/);
    expect(n).toBe(1);
    expect(h.rpc).toHaveBeenCalledWith('admin_resolve_claim_v1', { p_item_id: 'm1', p_decision: 'approve_full' });
  });
});
