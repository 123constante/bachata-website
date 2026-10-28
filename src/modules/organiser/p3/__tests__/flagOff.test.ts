import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { flags } from '@/lib/featureFlags';
import { CATCHALL_CLIENT_PATHS } from '@/components/catchallClientPaths';
import { P3_BASE } from '../shell/paths';

/*
 * Flag OFF = no visible change: organiserP3 defaults off, the ONLY P3 route in
 * AnimatedRoutes sits behind it, and the R1 organiser routes are byte-for-byte
 * the same block as on main before P3.
 */
const routes = readFileSync('src/components/AnimatedRoutes.tsx', 'utf8').replace(/\r\n/g, '\n');
const flagsSrc = readFileSync('src/lib/featureFlags.ts', 'utf8');

describe('organiserP3 flag', () => {
  it('defaults off (env unset in tests, like an unset Vercel env)', () => {
    expect(import.meta.env.VITE_ENABLE_ORGANISER_P3).toBeUndefined();
    expect(flags.organiserP3).toBe(false);
  });
  it('is its own env var, read as === "true", and is not parityGate\'s AW1_APPLIED', () => {
    expect(flagsSrc).toMatch(/organiserP3:\s+import\.meta\.env\.VITE_ENABLE_ORGANISER_P3 === 'true'/);
    expect(flagsSrc).not.toMatch(/AW1_APPLIED\s*[:=]/);
    expect(readFileSync('src/modules/organiser/shared/parityGate.ts', 'utf8')).not.toMatch(/organiserP3|ORGANISER_P3/);
  });
});

describe('flag off: old routes unchanged', () => {
  it('the only P3 route is inside `flags.organiserP3 && flags.organiserSelfServe ? ... : null`', () => {
    const hits = [...routes.matchAll(/\/account\/p3/g)];
    expect(hits).toHaveLength(1);
    expect(routes).toMatch(/\{flags\.organiserP3 && flags\.organiserSelfServe \? \(\n\s+<Route path="\/account\/p3\/\*" element=\{<OrganiserP3Area \/>\} \/>\n\s+\) : null\}/);
    expect(routes).toMatch(/const OrganiserP3Area = (?:\/\* @__PURE__ \*\/ )?lazyWithRetry\(\(\) => import\("@\/modules\/organiser\/p3\/shell\/P3Routes"\)\);/);
  });
  it('the route literal is P3_BASE and the catchall list knows it', () => {
    expect(routes.includes(`path="${P3_BASE}/*"`)).toBe(true);
    expect(CATCHALL_CLIENT_PATHS).toContain(`${P3_BASE}/*`);
  });
  it('the R1 organiser area route is untouched', () => {
    expect(routes).toContain(
      [
        '            <Route path="/account/o/*" element={',
        '              flags.organiserSelfServe',
        '                ? <OrganiserArea />',
        '                : <Navigate to="/" replace />',
        '            } />',
      ].join('\n'),
    );
  });
  it('nothing outside modules/organiser/p3 imports the P3 area except the lazy route', () => {
    expect(routes.match(/import\("@\/modules\/organiser\/p3\//g)).toHaveLength(1);
    expect(routes).not.toMatch(/^import .*organiser\/p3/m);
  });
});
