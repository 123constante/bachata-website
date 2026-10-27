import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flags } from '@/lib/featureFlags';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { TICKETS_BASE } from '../paths';

/* Flag OFF = no visible change: organiserTicketing defaults off and is the gate of the ONLY ticketing route. */
const routes = readFileSync('src/components/AnimatedRoutes.tsx', 'utf8').replace(/\r\n/g, '\n');
const flagsSrc = readFileSync('src/lib/featureFlags.ts', 'utf8');

describe('organiserTicketing flag', () => {
  it('defaults off (env unset in tests, like an unset Vercel env)', () => {
    expect(import.meta.env.VITE_ENABLE_ORGANISER_TICKETING).toBeUndefined();
    expect(flags.organiserTicketing).toBe(false);
  });
  it('is its own env var, read as === "true"', () => {
    expect(flagsSrc).toMatch(/organiserTicketing:\s+import\.meta\.env\.VITE_ENABLE_ORGANISER_TICKETING === 'true'/);
  });
  it('the only ticketing route is inside `flags.organiserTicketing && flags.organiserSelfServe ? ... : null`', () => {
    expect([...routes.matchAll(/\/account\/tickets/g)]).toHaveLength(1);
    expect(routes).toMatch(
      /\{flags\.organiserTicketing && flags\.organiserSelfServe \? \(\n\s+<Route path="\/account\/tickets\/\*" element=\{<OrganiserTicketsArea \/>\} \/>\n\s+\) : null\}/,
    );
    expect(routes.match(/import\("@\/modules\/organiser\/tickets\//g)).toHaveLength(1);
    expect(routes).not.toMatch(/^import .*organiser\/tickets/m);
  });
  it('the route literal is TICKETS_BASE and the catchall list knows it', () => {
    expect(routes.includes(`path="${TICKETS_BASE}/*"`)).toBe(true);
    expect(CATCHALL_CLIENT_PATHS).toContain(`${TICKETS_BASE}/*`);
  });
});
