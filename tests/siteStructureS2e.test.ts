// Site structure arc S2e (docs/arcs/site-structure.md): with homeOneRow on,
// home has no Calendar tab, so /city/:slug/calendar rendered the same list as
// /city/:slug. It now 301s there, and the two dancer deep links stop pointing
// at it.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (f: string) => fs.readFileSync(path.join(root, f), 'utf8');
type Redirect = { source: string; destination: string; permanent?: boolean };
const redirects: Redirect[] = JSON.parse(read('vercel.json')).redirects;

describe('S2e: /city/:slug/calendar forwards to the city home', () => {
  it('/city/:slug/calendar -> /city/:slug (301)', () => {
    const r = redirects.find((x) => x.source === '/city/:slug/calendar');
    expect(r).toBeDefined();
    expect(r!.destination).toBe('/city/:slug');
    expect(r!.permanent).toBe(true);
  });

  it.each(['src/pages/MyAttendance.tsx', 'src/components/profile/DancerDashboard.tsx'])(
    '%s no longer links the calendar tab',
    (f) => expect(read(f)).not.toContain("buildCityPath(citySlug, 'calendar')"),
  );

  it('the dashboard button does not promise a calendar', () => {
    expect(read('src/components/profile/DancerDashboard.tsx')).not.toContain("'Open calendar'");
  });
});
