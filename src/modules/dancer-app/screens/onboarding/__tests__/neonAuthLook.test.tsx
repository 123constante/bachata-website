// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CityNeon, NameNeon, RoleNeon } from '../neon/NeonAuthSteps';
import type { MyDancerEdit } from '../../../api/types';

const rpc = vi.fn();
vi.mock('@/integrations/supabase/client', () => ({ supabase: { rpc: (...a: unknown[]) => rpc(...a) } }));
afterEach(cleanup);

const profile = { first_name: null, display_name: null, based_city_id: null, dance_role: null } as unknown as MyDancerEdit;
const base = { profile, busy: false, error: null };
const wrap = (ui: JSX.Element) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;
const cont = () => screen.getByTestId('onboarding-continue') as HTMLButtonElement;

describe('neon pre-stage keep-list', () => {
  it('name: copy, placeholder, Continue gated, submits trimmed first name', () => {
    const onSubmit = vi.fn();
    render(<NameNeon {...base} onSubmit={onSubmit} />);
    expect(screen.getByRole('heading').textContent).toBe('What do we call you?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Your first name is enough.');
    const input = screen.getByPlaceholderText('First name');
    expect(cont().disabled).toBe(true);
    fireEvent.change(input, { target: { value: ' Ana ' } });
    fireEvent.click(cont());
    expect(onSubmit).toHaveBeenCalledWith({ first_name: 'Ana', display_name: '' });
  });

  it('city: copy, none selected by default, rows with country, footer link, submit id', async () => {
    rpc.mockResolvedValue({ data: [{ city_id: 'c1', city_name: 'Bristol', country_name: 'UK' }], error: null });
    const onSubmit = vi.fn();
    render(wrap(<CityNeon {...base} onSubmit={onSubmit} />));
    expect(screen.getByRole('heading').textContent).toBe('Where do you dance?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Every city is open. Type to search.');
    expect(screen.getByPlaceholderText('Search your city')).toBeTruthy();
    expect(screen.getByText('Not listed? Message us and we add your city')).toBeTruthy();
    expect(cont().disabled).toBe(true);
    const row = await screen.findByTestId('onboarding-city-c1');
    expect(row.textContent).toBe('\u{1F4CD}BristolUK');
    fireEvent.click(row);
    fireEvent.click(cont());
    expect(onSubmit).toHaveBeenCalledWith({ based_city_id: 'c1' });
  });

  it('city: no results shows the no-match footer', async () => {
    rpc.mockResolvedValue({ data: [], error: null });
    render(wrap(<CityNeon {...base} onSubmit={vi.fn()} />));
    fireEvent.change(screen.getByPlaceholderText('Search your city'), { target: { value: 'zzz' } });
    await waitFor(() => expect(screen.getByText('No match. Message us and we add your city')).toBeTruthy(), { timeout: 2000 });
  });

  it('lead/follow: copy, three rows in order, submits stored value', () => {
    const onSubmit = vi.fn();
    render(<RoleNeon {...base} onSubmit={onSubmit} />);
    expect(screen.getByRole('heading').textContent).toBe('Lead, follow, or both?');
    expect(screen.getByTestId('onboarding-sub').textContent).toBe('Helps partners find you.');
    const rows = screen.getAllByRole('radio');
    expect(rows.map((r) => r.textContent)).toEqual(['\u{1F57A}Leader', '\u{1F483}Follower', '\u{1F504}Both']);
    expect(cont().disabled).toBe(true);
    fireEvent.click(rows[2]);
    fireEvent.click(cont());
    expect(onSubmit).toHaveBeenCalledWith({ dance_role: 'Lead and Follow' });
  });
});
