// @vitest-environment node
/**
 * /api/ics/calendar must not silently truncate. get_public_events_list_v2
 * clamps p_limit to 100 server-side (LEAST(..., 100)) no matter what the
 * caller asks for, and the loader used to ask once for 200 and stop -- the
 * live 90-day window holds 423 events, so subscribers got the first 100 and
 * no truncation marker anywhere in the feed. This drives the real loader
 * against a mocked RPC that enforces the same 100-row clamp, so a regression
 * to a single un-paged call is caught by the VEVENT count, not by re-deriving
 * the RPC's own limit logic.
 *
 * Also covers two adjacent P6 fixes bundled into the same route: X-WR-CALNAME
 * must not be derived from `events[0]` when the feed is unfiltered (an
 * arbitrary sort-order pick), and X-WR-TIMEZONE must not hardcode a single
 * city's zone.
 */
import { describe, it, expect, vi } from 'vitest';

const PAGE_LIMIT = 100;

const rpc = vi.hoisted(() => ({
  calls: [] as { limit: number; offset: number }[],
  totalRows: 0,
  neverExhausts: false,
}));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: async (_name: string, args: Record<string, unknown>) => {
      const limit = args.p_limit as number;
      const offset = args.p_offset as number;
      rpc.calls.push({ limit, offset });
      if (rpc.neverExhausts) {
        // A pathological RPC that always returns a full page -- proves the
        // loader's own PAGE_CAP terminates it rather than looping forever.
        return { data: makeRows(limit, offset), error: null };
      }
      const remaining = Math.max(0, rpc.totalRows - offset);
      const rows = makeRows(Math.min(limit, remaining), offset);
      return { data: rows, error: null };
    },
  },
}));

function makeRows(count: number, offset: number) {
  return Array.from({ length: count }, (_, i) => ({
    category: 'social',
    city_name: 'London',
    city_slug: 'london-gb',
    city_timezone: 'Europe/London',
    cover_image_url: null,
    ends_at: null,
    event_id: `event-${offset + i}`,
    format: 'party',
    is_recurring: false,
    name: `Social ${offset + i}`,
    occurrence_date: '2026-09-10',
    occurrence_id: `occ-${offset + i}`,
    organiser_id: null,
    organiser_name: null,
    starts_at: '2026-09-10T19:30:00+00:00',
    type: 'party',
    venue_address: null,
    venue_id: null,
    venue_name: null,
  }));
}

const runLoader = async (url: string) => {
  const { loader } = await import('../app/routes/api.ics.calendar');
  return loader({ request: new Request(url) } as never);
};

const vcount = (body: string) => (body.match(/BEGIN:VEVENT/g) ?? []).length;

describe('/api/ics/calendar pages past the RPC 100-row clamp', () => {
  it('collects all rows across a window bigger than one page (423, matching the live incident)', async () => {
    rpc.calls = [];
    rpc.totalRows = 423;
    rpc.neverExhausts = false;

    const res = await runLoader('https://example.test/api/ics/calendar');
    const body = await res.text();

    expect(vcount(body)).toBe(423);
    // ceil(423 / 100) = 5 calls, each asking for the clamp-respecting page size.
    expect(rpc.calls).toEqual([
      { limit: PAGE_LIMIT, offset: 0 },
      { limit: PAGE_LIMIT, offset: 100 },
      { limit: PAGE_LIMIT, offset: 200 },
      { limit: PAGE_LIMIT, offset: 300 },
      { limit: PAGE_LIMIT, offset: 400 },
    ]);
  });

  it('stops after one call when the window fits in a single page', async () => {
    rpc.calls = [];
    rpc.totalRows = 40;
    rpc.neverExhausts = false;

    const res = await runLoader('https://example.test/api/ics/calendar');
    const body = await res.text();

    expect(vcount(body)).toBe(40);
    expect(rpc.calls).toHaveLength(1);
  });

  it('is bounded by PAGE_CAP against an RPC that never returns a short page', async () => {
    rpc.calls = [];
    rpc.neverExhausts = true;

    const res = await runLoader('https://example.test/api/ics/calendar');
    await res.text();

    expect(rpc.calls).toHaveLength(20);
  });
});

describe('/api/ics/calendar X-WR-CALNAME and X-WR-TIMEZONE', () => {
  it('does not name the unfiltered feed after an arbitrary first row', async () => {
    rpc.calls = [];
    rpc.totalRows = 3;
    rpc.neverExhausts = false;

    const res = await runLoader('https://example.test/api/ics/calendar');
    const body = await res.text();

    expect(body).toContain('X-WR-CALNAME:Bachata Calendar\r\n');
  });

  it('names a city-filtered feed from that city', async () => {
    rpc.calls = [];
    rpc.totalRows = 3;
    rpc.neverExhausts = false;

    const res = await runLoader('https://example.test/api/ics/calendar?city_slug=london-gb');
    const body = await res.text();

    expect(body).toMatch(/X-WR-CALNAME:Bachata Calendar.*London/);
  });

  it('still names a city-filtered feed from the requested slug when that city currently has zero matching events', async () => {
    rpc.calls = [];
    rpc.totalRows = 0;
    rpc.neverExhausts = false;

    const res = await runLoader('https://example.test/api/ics/calendar?city_slug=cambridge-uk');
    const body = await res.text();

    expect(body).toMatch(/X-WR-CALNAME:Bachata Calendar.*Cambridge/);
  });

  it('does not claim a single city zone for a feed that can span timezones', async () => {
    rpc.calls = [];
    rpc.totalRows = 1;
    rpc.neverExhausts = false;

    const res = await runLoader('https://example.test/api/ics/calendar');
    const body = await res.text();

    expect(body).toContain('X-WR-TIMEZONE:UTC');
    expect(body).not.toContain('X-WR-TIMEZONE:Europe/London');
  });
});
