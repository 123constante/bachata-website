// P3-GATE e2e harness: mounts the REAL GateHost -> GateSheet -> Sheet (and the real theme/p3.css) inside the
// dev server's own module graph, so tests/e2e/p3-gate-sheet.spec.ts measures shipped code in the test:e2e gate
// without the organiserP3 flag. Loaded by the spec with a dynamic import() from a page the dev app served
// (its React refresh preamble is already there). Not a spec; never imported by the app.
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { GateHost } from '@/modules/organiser/p3/onboarding/GateHost';
import { useGatedCopy } from '@/modules/organiser/p3/onboarding/gate';
import '@/modules/organiser/p3/theme/p3.css';

const REFUSAL = {
  code: 'P0001',
  message: 'onboarding_incomplete',
  details: JSON.stringify({ missing: ['nationality'], organiser_id: 'a0000000-0000-4000-8000-000000000001' }),
  hint: 'Finish your details',
};

function Refuse() {
  const gated = useGatedCopy();
  return (
    <button type="button" className="p3-btn" data-testid="harness-refuse" onClick={() => gated(REFUSAL, () => 'not a refusal')}>
      Save
    </button>
  );
}

export function mount(theme: 'light' | 'dark'): void {
  document.getElementById('root')?.setAttribute('hidden', '');
  const host = document.createElement('div');
  host.className = 'p3-theme p3-frame';
  host.setAttribute('data-theme', theme);
  document.body.appendChild(host);
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  createRoot(host).render(
    <AuthProvider>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/account/p3/events/x/details']}>
          <header className="p3-top"><h1>Event</h1></header>
          <main className="p3-main">
            {Array.from({ length: 60 }, (_, i) => <p key={i}>row {i}</p>)}
            <Refuse />
          </main>
          <GateHost />
        </MemoryRouter>
      </QueryClientProvider>
    </AuthProvider>,
  );
}
