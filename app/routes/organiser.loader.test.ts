import { describe, it, expect, vi, beforeEach } from "vitest";

// S1 (E4): a failed organiser feed must never reach served HTML as a false
// empty state. Before this, every feed fetcher swallowed an RPC error to `[]`,
// the loader dehydrated that `[]` as a SUCCESS and cache-tagged the response,
// so one blip during SSR rendered "No nights listed yet" for an organiser with
// 200 events. Now: the failed feed is NOT dehydrated (the client refetches it)
// and the response carries NO cache tag (cacheHeaders -> max-age=0,
// must-revalidate, no edge cache). The real feed fetchers run here; only supabase.rpc is faked.

const rpc = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/pages/OrganiserProfile", () => ({ default: () => null }));
vi.mock("@/lib/featureFlags", async (orig) => {
  const real = await orig<typeof import("@/lib/featureFlags")>();
  return { ...real, flags: { ...real.flags, organiserDetail: true } };
});
vi.mock("@/modules/profile/organiserPublicProfile", async (orig) => ({
  ...(await orig<typeof import("@/modules/profile/organiserPublicProfile")>()),
  fetchOrganiserEntity: vi.fn(async () => ({ id: ORG_ID, name: "Org", bio: null, avatar_url: null, cities: null })),
}));
vi.mock("../detailLoader", async (orig) => ({
  ...(await orig<typeof import("../detailLoader")>()),
  resolveEntityInLoader: vi.fn(async () => ({ id: ORG_ID, slug: "org" })),
}));

const ORG_ID = "11111111-2222-4333-8444-555555555555";
type Feed = "events" | "future" | "past";
const ROW = { id: "ev-1", event_id: "ev-1", name: "Friday Social" };

function fakeRpc(failing: Set<Feed>) {
  rpc.mockImplementation(async (fn: string, args?: Record<string, unknown>) => {
    if (fn !== "get_organiser_public_events_v1" && fn !== "get_organiser_calendar_events_v1") {
      return { data: null, error: null };
    }
    const feed: Feed =
      fn === "get_organiser_public_events_v1" ? "events" : args?.p_include_past ? "past" : "future";
    if (failing.has(feed)) return { data: null, error: { message: `boom ${feed}` } };
    return { data: [ROW], error: null };
  });
}

// F2: import the route once at module level (after the mocks and `rpc` exist),
// so the cold import cost is not paid under the first test's 5 s timeout.
const { loader } = await import("./organiser");

async function run() {
  const request = new Request(`https://www.bachatacalendar.co.uk/organisers/org`);
  const out = (await loader({ params: { id: "org" }, request } as never)) as unknown;
  // taggedData returns react-router's data() wrapper; an untagged return is the bare payload.
  const wrapped = out as { data?: unknown; init?: { headers?: Record<string, string> } };
  const payload = (wrapped && typeof wrapped === "object" && "init" in wrapped ? wrapped.data : out) as {
    dehydratedState: { queries: Array<{ queryKey: unknown[]; state: { status: string; data: unknown } }> };
  };
  const headers = new Headers(("init" in (wrapped ?? {}) ? wrapped.init?.headers : undefined) ?? {});
  return { payload, headers };
}

const KEY: Record<Feed, string> = {
  events: "organiser-events",
  future: "organiser-occ-events",
  past: "organiser-occ-events-past",
};

describe("organiser loader: a failed feed is never dehydrated or cached", () => {
  beforeEach(() => rpc.mockReset());

  it("all feeds ok -> every feed dehydrated, response cache-tagged", async () => {
    fakeRpc(new Set());
    const { payload, headers } = await run();
    const keys = payload.dehydratedState.queries.map((q) => q.queryKey[0]);
    for (const f of Object.values(KEY)) expect(keys).toContain(f);
    expect(headers.get("Vercel-Cache-Tag")).toBeTruthy();
  });

  it.each<Feed[]>([["events"], ["future"], ["past"], ["future", "past"]])(
    "%s failing -> not dehydrated (no [] success), no cache tag, other feeds still dehydrated",
    async (...failing) => {
      fakeRpc(new Set(failing));
      const { payload, headers } = await run();
      const byKey = new Map(payload.dehydratedState.queries.map((q) => [q.queryKey[0], q]));
      for (const f of failing) {
        const q = byKey.get(KEY[f]);
        // Absent, or at the very least never a success holding [].
        expect(q?.state.status === "success", `${f} must not dehydrate as success`).toBe(false);
      }
      for (const f of (Object.keys(KEY) as Feed[]).filter((x) => !failing.includes(x))) {
        expect(byKey.get(KEY[f])?.state.status).toBe("success");
      }
      expect(headers.get("Vercel-Cache-Tag")).toBeNull();
    },
  );
});
