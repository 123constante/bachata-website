import { describe, expect, it, vi } from 'vitest';

// festivalEventQuery imports the Supabase client at module load; the sniff is
// pure, so stub the client rather than need env vars or a network.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));

import { sniffIsFestival } from '@/modules/event-page/festivalEventQuery';

type Snap = Parameters<typeof sniffIsFestival>[0];
type Detail = Parameters<typeof sniffIsFestival>[1];

const snap = (format: string | null, type: string | null = null): Snap =>
  ({ event: { format, type } }) as unknown as Snap;

const detail = (days: string[], passes: unknown[] = []): Detail =>
  ({ schedule: days.map((day) => ({ day })), passes }) as unknown as Detail;

const ENTRY_PASS = { name: 'Entry', price: 12, currency: 'GBP' };

describe('sniffIsFestival', () => {
  // Lever 2 walk B1: D8 default_passes on a weekly class turned its public page
  // into "Festival not found".
  it('a priced weekly class is NOT a festival', () => {
    expect(sniffIsFestival(snap('class', 'class'), detail(['2026-10-06'], [ENTRY_PASS]))).toBe(false);
  });

  it('a priced weekly class with no schedule rows is NOT a festival', () => {
    expect(sniffIsFestival(snap('class'), detail([], [ENTRY_PASS]))).toBe(false);
  });

  it('a priced party is NOT a festival', () => {
    expect(sniffIsFestival(snap('party', 'party'), detail([], [ENTRY_PASS]))).toBe(false);
  });

  it('passes alone never make a null-format event a festival', () => {
    expect(sniffIsFestival(snap(null), detail(['2026-10-06'], [ENTRY_PASS]))).toBe(false);
  });

  it("format === 'festival' is a festival whatever the detail says", () => {
    expect(sniffIsFestival(snap('festival'), null)).toBe(true);
    expect(sniffIsFestival(snap('festival'), detail([]))).toBe(true);
    expect(sniffIsFestival(snap('festival'), detail(['2026-11-01'], [ENTRY_PASS]))).toBe(true);
  });

  it('a null-format legacy row with a multi-day schedule still routes to the festival hub', () => {
    expect(sniffIsFestival(snap(null), detail(['2026-11-01', '2026-11-02']))).toBe(true);
  });

  it('a null-format single-day schedule is not a festival', () => {
    expect(sniffIsFestival(snap(null), detail(['2026-11-01', '2026-11-01']))).toBe(false);
  });

  it('a non-festival format with a multi-day schedule is not a festival (FestivalDetail cannot render it)', () => {
    expect(sniffIsFestival(snap('class'), detail(['2026-11-01', '2026-11-02']))).toBe(false);
  });

  it('no snapshot and no detail is not a festival', () => {
    expect(sniffIsFestival(null, null)).toBe(false);
    expect(sniffIsFestival(undefined, undefined)).toBe(false);
  });
});
