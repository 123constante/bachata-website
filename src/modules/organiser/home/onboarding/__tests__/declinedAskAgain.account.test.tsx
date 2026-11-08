// @vitest-environment jsdom
/** /account OnboardingView x declined requests: the dated ask-again line, and the admin's note when there is one. */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@/integrations/supabase/client', () => ({ supabase: { auth: {}, rpc: vi.fn(), from: vi.fn() } }));
vi.mock('@/hooks/useAuth', async () => ({ useAuth: () => ({ user: { id: 'u1', email: 'sam@example.com' } }), ProfileGateContext: (await import('react')).createContext(null) }));

import { OnboardingView } from '../OnboardingView';
import type { MyAccessRequest } from '../../../shared/selfServeApi';

const NOW = new Date('2026-10-30T12:00:00Z');
vi.useFakeTimers({ toFake: ['Date'], now: NOW });
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const R = (id: string, resolved: number, over: Partial<MyAccessRequest> = {}): MyAccessRequest => ({ requestId: `r-${id}`, organiserId: id, organiserName: `Page ${id}`, status: 'declined', createdAt: daysAgo(resolved + 1), resolvedAt: daysAgo(resolved), ...over });
const label = (ms: number) => new Date(ms).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/London' });

function mount(requests: MyAccessRequest[]) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <OnboardingView user={{ id: 'u1', email: 'sam@example.com' } as never} mailboxProven myOrganiserIds={[]} requests={requests} firstRun={false} onChanged={() => undefined} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('/account declined row', () => {
  it.each([0, 15, 29].flatMap((d) => [true, false].map((note) => [d, note] as const)))('answered %i days ago, note %s', (d, note) => {
    mount([R('a', d, note ? { decisionNote: 'We are full' } : {})]);
    const line = screen.getByTestId('declined-ask-again').textContent;
    const from = new Date(Date.parse(daysAgo(d)) + 30 * 86_400_000);
    expect(line).toBe(`You can ask again from ${label(from.getTime())}, or ask to join a different page from Find your page.`);
    const row = screen.getByTestId('onboarding-declined-row').textContent ?? '';
    if (note) expect(row).toContain('Their note: “We are full”');
    else expect(row).not.toMatch(/reason|note/i);
    expect(row).not.toMatch(/reason is not shown/i);
  });
  it('two declined pages: one line per row, each dated', () => {
    mount([R('a', 5), R('b', 2)]);
    const lines = screen.getAllByTestId('declined-ask-again');
    expect(lines).toHaveLength(2);
    lines.forEach((l) => expect(l.textContent).toMatch(/ask again from \w+day \d{1,2} \w+/));
  });
  it('null resolvedAt falls back to createdAt', () => {
    mount([R('a', 3, { resolvedAt: null })]);
    const from = Date.parse(daysAgo(4)) + 30 * 86_400_000;
    expect(screen.getByTestId('declined-ask-again').textContent).toContain(label(from));
  });
});

afterEach(() => { cleanup(); document.body.innerHTML = ''; });
