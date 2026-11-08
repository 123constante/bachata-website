import { readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { flags } from '@/lib/featureFlags';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { THANKS_PATH } from '../ticketCheckoutModel';
import { MY_TICKETS_PATH } from '../myTicketsModel';

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
  it('my tickets: flag-gated route that sends home while off, lazy, and the QR generator only in its chunk', () => {
    expect([...routes.matchAll(/"\/account\/my-tickets"/g)]).toHaveLength(1);
    expect(routes).toMatch(/<Route path="\/account\/my-tickets" element=\{\n\s+flags\.publicTicketing\n\s+\? <PageTransition><MyTicketsPage \/><\/PageTransition>\n\s+: <Navigate to="\/" replace \/>\n\s+\} \/>/);
    expect(routes).toMatch(/const MyTicketsPage = lazyWithRetry\(\(\) => import\("@\/modules\/tickets\/MyTicketsPage"\)\);/);
    expect(CATCHALL_CLIENT_PATHS).toContain(MY_TICKETS_PATH);
    const importers = execSync('git grep -l "qrcode-generator" -- src', { encoding: 'utf8' }).trim().split('\n').filter((f) => !f.includes('__tests__'));
    expect(importers).toEqual(['src/modules/tickets/qr.ts']);
    const qrImporters = execSync('git grep -lE "from .(\\./|@/modules/tickets/)qr." -- src', { encoding: 'utf8' }).trim().split('\n').filter((f) => !f.includes('__tests__'));
    expect(qrImporters).toEqual(['src/modules/tickets/TicketQrCode.tsx']);
    for (const f of ['MyTicketsPage.tsx', 'OrderQrBlock.tsx']) expect(readFileSync(`src/modules/tickets/${f}`, 'utf8')).toMatch(/from '\.\/TicketQrCode'/);
  });
  it('DancerHome never imports the tickets module; the thank-you page imports the model only (not qr)', () => {
    const dh = readFileSync('src/components/account/DancerHome.tsx', 'utf8');
    expect(dh).not.toMatch(/modules\/tickets/);
    const thanks = readFileSync('src/modules/tickets/TicketThanksPage.tsx', 'utf8');
    expect(thanks).toMatch(/from '\.\/myTicketsModel'/);
    expect(thanks).not.toMatch(/from '\.\/qr'/);
    expect(thanks).not.toMatch(/^import .*OrderQrBlock/m);
    expect(thanks).toMatch(/const OrderQrBlock = lazyWithRetry\(\(\) => import\('\.\/OrderQrBlock'\)\);/);
    const importers = execSync('git grep -l "modules/tickets" -- src/components/account || true', { encoding: 'utf8' }).trim().split('\n').filter((f) => f && !f.includes('__tests__'));
    expect(importers).toEqual([]);
  });
  it('the event page mounts the Tickets page only behind the flag, from a lazy chunk', () => {
    expect(bento).not.toMatch(/^import .*modules\/tickets/m);
    expect(bento.match(/import\('@\/modules\/tickets\//g)).toHaveLength(1);
    expect(bento.match(/<EventTicketsPage\s/g)).toHaveLength(1);
    expect(bento).toMatch(/\{ticketsOpen && flags\.publicTicketing && state === 'ready' && eventId && !over && !occurrence\?\.isCancelled && !pageModel\.page\.isPaused && \(/);
  });
  it('no Stripe secret anywhere in the module', () => {
    const src = ['ticketCheckoutApi.ts', 'ticketCheckoutModel.ts', 'TicketsBlock.tsx', 'TicketThanksPage.tsx', 'legalCopy.ts', 'MyTicketsPage.tsx', 'myTicketsApi.ts', 'myTicketsModel.ts', 'qr.ts', 'TicketQrCode.tsx', 'OrderQrBlock.tsx']
      .map((f) => readFileSync(`src/modules/tickets/${f}`, 'utf8')).join('\n');
    expect(src).not.toMatch(/sk_(test|live)_|rk_(test|live)_|STRIPE_SECRET/);
  });
});
