// @vitest-environment jsdom
/**
 * Arc 1 flow 8: creating a page refused with organiser_invite_required shows 8a
 * ("Events are not open to you yet", Ask us to open it); the request goes to
 * request_signup_access_v1 and 8b says "We are checking". Table-driven over the
 * request's outcome, plus a login with no email (no request possible: the
 * support rows, never a dead end).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { useState } from 'react';

const api = vi.hoisted(() => ({ create: vi.fn(), search: vi.fn(), rpc: vi.fn() }));
vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: api.rpc } }));
vi.mock('@/modules/organiser/shared/selfServeApi', () => ({
  createOrganiserProfile: api.create,
  searchClaimableOrganisers: api.search,
}));

import { NewPageFlow } from '../NewPageFlow';
import { CANNOT_CREATE, NOT_SENT, OPEN_REQUESTED, TRY_LATER, openRequestNote, parseOpenRequest } from '../cannotCreate';

const cb = { onCreated: vi.fn(), onAskToJoin: vi.fn(), onFindPage: vi.fn(), onHome: vi.fn() };
const LEEDS = { data: [{ city_id: 'c1', city_name: 'Leeds', city_slug: 'leeds', country_name: 'UK', display_name: 'Leeds, UK' }], error: null };
let openAnswer: { data: unknown; error: unknown } | 'throw' = { data: { ok: true }, error: null };

function Harness({ email }: { email: string | null }) {
  const [step, setStep] = useState<'name' | 'city'>('name');
  const [name, setName] = useState('');
  return <NewPageFlow step={step} onStep={setStep} name={name} onName={setName} email={email} {...cb} />;
}
function mount(email: string | null = 'me@x.example') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Harness email={email} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}
async function refuse() {
  fireEvent.change(screen.getByTestId('onboarding-create-name'), { target: { value: 'Nova  Bachata' } });
  fireEvent.click(screen.getByTestId('onboarding-create-next'));
  fireEvent.change(await screen.findByTestId('onboarding-city-search'), { target: { value: 'Le' } });
  fireEvent.click(await screen.findByTestId('onboarding-city-option'));
  return screen.findByTestId('onboarding-create-refusal');
}
const openCalls = () => api.rpc.mock.calls.filter(([fn]) => fn === 'request_signup_access_v1');

beforeEach(() => {
  Object.values(api).forEach((f) => f.mockReset());
  Object.values(cb).forEach((f) => f.mockReset());
  openAnswer = { data: { ok: true }, error: null };
  api.create.mockRejectedValue({ message: 'organiser_invite_required', code: 'P0001' });
  api.rpc.mockImplementation(async (fn: string) => {
    if (fn !== 'request_signup_access_v1') return LEEDS;
    if (openAnswer === 'throw') throw new Error('net');
    return openAnswer;
  });
});
afterEach(() => {
  cleanup();
  vi.unstubAllEnvs();
});

describe('model', () => {
  it.each([
    [{ ok: true }, 'sent'],
    [{ ok: false, reason: 'rate_limited' }, 'rate_limited'],
    [{ ok: false, reason: 'invalid_email' }, 'failed'],
    [{ ok: false, reason: 'invalid_note' }, 'failed'],
    [null, 'failed'],
    ['nonsense', 'failed'],
  ])('%j -> %s', (data, expected) => {
    expect(parseOpenRequest(data)).toBe(expected);
  });

  it('the note names the page on one line and fits the 300-character limit', () => {
    expect(openRequestNote('  Nova \n Bachata ')).toBe('Wants to create the page Nova Bachata');
    expect(openRequestNote('')).toBe('Wants to create a page');
    expect(openRequestNote('x'.repeat(400))).toHaveLength(300);
  });
});

describe('8a: events are not open to you yet', () => {
  it('says why in two short lines, with ONE ask and a way Home; no retry that cannot work', async () => {
    mount();
    const refusal = await refuse();
    expect(within(refusal).getByTestId('onboarding-create-closed-title').textContent).toBe(CANNOT_CREATE.title);
    expect(refusal.textContent).toContain(CANNOT_CREATE.sub);
    expect(within(refusal).getByTestId('onboarding-create-open-ask').textContent).toBe(CANNOT_CREATE.ask);
    expect(within(refusal).queryByTestId('onboarding-create-retry')).toBeNull();
    expect(within(refusal).getAllByRole('button').map((b) => b.textContent)).toEqual([CANNOT_CREATE.ask, OPEN_REQUESTED.home]);
    expect(api.create).toHaveBeenCalledTimes(1);
  });

  const OUTCOMES: Array<{ name: string; answer: typeof openAnswer; sent: boolean; error: string | null }> = [
    { name: 'ok -> 8b', answer: { data: { ok: true }, error: null }, sent: true, error: null },
    { name: 'rate_limited -> Try again later', answer: { data: { ok: false, reason: 'rate_limited' }, error: null }, sent: false, error: TRY_LATER },
    { name: 'invalid_email -> not sent', answer: { data: { ok: false, reason: 'invalid_email' }, error: null }, sent: false, error: NOT_SENT },
    { name: 'RPC error (not on this database yet) -> not sent', answer: { data: null, error: { message: 'function does not exist' } }, sent: false, error: NOT_SENT },
    { name: 'network -> not sent', answer: 'throw', sent: false, error: NOT_SENT },
  ];

  it.each(OUTCOMES)('Ask us to open it: $name', async ({ answer, sent, error }) => {
    openAnswer = answer;
    mount();
    const refusal = await refuse();
    fireEvent.click(within(refusal).getByTestId('onboarding-create-open-ask'));
    await waitFor(() => expect(openCalls()).toHaveLength(1));
    expect(openCalls()[0][1]).toEqual({ p_email: 'me@x.example', p_note: 'Wants to create the page Nova Bachata' });
    if (sent) {
      expect((await screen.findByTestId('onboarding-create-open-sent')).textContent).toContain(OPEN_REQUESTED.title);
      expect(screen.getByTestId('onboarding-create-open-sent').textContent).toContain(OPEN_REQUESTED.sub);
      expect(screen.queryByTestId('onboarding-create-open-ask')).toBeNull();
      fireEvent.click(screen.getByTestId('onboarding-create-home'));
      expect(cb.onHome).toHaveBeenCalledTimes(1);
    } else {
      expect((await screen.findByTestId('onboarding-create-open-error')).textContent).toBe(error);
      // The ask stays: trying again later is the only thing to do.
      expect(screen.getByTestId('onboarding-create-open-ask')).toBeTruthy();
    }
  });

  it('no email on the login: no request is possible, so the support rows (never a dead link)', async () => {
    vi.stubEnv('VITE_SUPPORT_WHATSAPP', 'https://wa.me/447000000000');
    vi.stubEnv('VITE_SUPPORT_EMAIL', '');
    mount(null);
    const refusal = await refuse();
    expect(within(refusal).getByTestId('onboarding-create-closed-title').textContent).toBe(CANNOT_CREATE.title);
    expect(within(refusal).queryByTestId('onboarding-create-open-ask')).toBeNull();
    expect((within(refusal).getByTestId('onboarding-create-support-whatsapp') as HTMLAnchorElement).getAttribute('href')).toBe('https://wa.me/447000000000');
  });
});
