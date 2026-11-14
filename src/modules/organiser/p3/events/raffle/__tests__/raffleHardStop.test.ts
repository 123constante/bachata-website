import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/* HARD STOP: opening or closing a raffle is never an automation path. The write RPC is named in ONE api file and
   that function is imported by ONE component (the sheet whose button follows a confirmation). The flag is off by default. */
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(join(d, e.name))) : [join(d, e.name)]));

describe('organiser raffle hard stop', () => {
  const files = [...walk('src'), ...walk('scripts')].filter((f) => /\.(tsx?|mjs|js)$/.test(f) && !f.includes('__tests__') && !f.endsWith('.test.ts') && f !== 'src/types/supabase.ts');
  it('the write RPC is named only in raffleApi.ts', () => {
    expect(files.filter((f) => /['"]organiser_raffle_night_set_v1['"]/.test(readFileSync(f, 'utf8')))).toEqual([join('src', 'modules', 'organiser', 'p3', 'events', 'raffle', 'raffleApi.ts')]);
  });
  it('setRaffleNight is imported only by RaffleSheet.tsx, and only called from its confirmation handler', () => {
    const users = files.filter((f) => readFileSync(f, 'utf8').includes('setRaffleNight'));
    expect(users.map((f) => f.split('/').pop()).sort()).toEqual(['RaffleSheet.tsx', 'raffleApi.ts']);
    const sheet = readFileSync(users.find((f) => f.endsWith('RaffleSheet.tsx'))!, 'utf8');
    expect(sheet.match(/setRaffleNight\(/g)).toHaveLength(1);
    expect(sheet).not.toMatch(/useEffect/);
  });
  it('the live flag defaults off', () => {
    expect(readFileSync('src/lib/featureFlags.ts', 'utf8')).toMatch(/organiserRaffleLive:\s+import\.meta\.env\.VITE_ENABLE_ORGANISER_RAFFLE_LIVE === 'true'/);
  });
});
