import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flags } from '@/lib/featureFlags';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { THANKS_PATH } from '../ticketCheckoutModel';

/* Flag OFF = no visible change: publicTicketing defaults off and gates the only block and the only route. */
const routes = readFileSync('src/components/AnimatedRoutes.tsx', 'utf8').replace(/\r\n/g, '\n');
const bento = readFileSync('src/modules/event-page/bento/BentoPage.tsx', 'utf8').replace(/\r\n/g, '\n');
const flagsSrc = readFileSync('src/lib/featureFlags.ts', 'utf8');

describe('publicTicketing flag', () => {
  it('defaults off (env unset in tests, like an unset Vercel env)', () => {
    expect(import.meta.env.VITE_ENABLE_PUBLIC_TICKETING).toBeUndefined();
    expect(flags.publicTicketing).toBe(false);
  });
  it('is its own env var, read as === "true"', () => {
    expect(flagsSrc).toMatch(/publicTicketing:\s+import\.meta\.env\.VITE_ENABLE_PUBLIC_TICKETING === 'true'/);
  });
  it('the only route is inside `flags.publicTicketing ? ... : null` and lazy', () => {
    expect([...routes.matchAll(/\/tickets\/thanks/g)]).toHaveLength(1);
    expect(routes).toMatch(/\{flags\.publicTicketing \? \(\n\s+<Route path="\/tickets\/thanks" element=\{<TicketThanksPage \/>\} \/>\n\s+\) : null\}/);
    expect(routes).not.toMatch(/^import .*modules\/tickets/m);
    expect(routes.includes(`path="${THANKS_PATH}"`)).toBe(true);
    expect(CATCHALL_CLIENT_PATHS).toContain(THANKS_PATH);
  });
  it('the event page mounts the block only behind the flag, from a lazy chunk', () => {
    expect(bento).not.toMatch(/^import .*modules\/tickets/m);
    expect(bento.match(/import\('@\/modules\/tickets\//g)).toHaveLength(1);
    expect(bento.match(/<TicketsBlock\s/g)).toHaveLength(1);
    expect(bento).toMatch(/\{flags\.publicTicketing && state === 'ready' && eventId && !over && !occurrence\?\.isCancelled && !pageModel\.page\.isPaused && \(/);
  });
  it('no Stripe secret anywhere in the module', () => {
    const src = ['ticketCheckoutApi.ts', 'ticketCheckoutModel.ts', 'TicketsBlock.tsx', 'TicketThanksPage.tsx', 'legalCopy.ts']
      .map((f) => readFileSync(`src/modules/tickets/${f}`, 'utf8')).join('\n');
    expect(src).not.toMatch(/sk_(test|live)_|rk_(test|live)_|STRIPE_SECRET/);
  });
});
