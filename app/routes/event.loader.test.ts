import { describe, it, expect, vi, beforeEach } from "vitest";

// /event/:id must not render a series the public page gate hides. The gate is
// resolve_public_event_ref_v1 (prod: lifecycle in live|ended), which returns
// null for archived, draft and pending_review; the loader must turn that into a
// 4xx with noindex, by slug AND by uuid, and never fetch the event body:
// 410 Gone for a taken-down (archived) series, 404 for the rest.
// (2026-10-08 takedown re-walk: the archived party's page was still served.)

const resolvePublicEventRef = vi.fn();
const rpc = vi.fn();
const hiddenEventLifecycle = vi.fn();
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef }));
vi.mock("../lib/hiddenEventLookup", () => ({ hiddenEventLifecycle }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { rpc } }));
vi.mock("@/pages/EventPage", () => ({ default: () => null }));
vi.mock("@/modules/event-page/useFestivalDetailQuery", () => ({
  festivalDetailQueryKey: (id: string) => ["festival-detail", id],
  fetchFestivalDetail: vi.fn(async () => null),
}));
vi.mock("../detailLoader", () => ({
  cacheHeaders: () => ({}),
  resolveOgCardImage: async () => "og",
  taggedData: (d: unknown) => d,
}));

const SLUG = "zz-test-delete-me-party2";
const ID = "c81746db-945b-47af-bdca-501886e105e0";

async function run(param: string) {
  const { loader } = await import("./event");
  const request = new Request(`https://www.bachatacalendar.co.uk/event/${param}`);
  try {
    return { result: await loader({ params: { id: param }, request } as never) };
  } catch (thrown) {
    return { thrown };
  }
}

describe("event loader: hidden series 404/410", () => {
  beforeEach(() => {
    resolvePublicEventRef.mockReset();
    hiddenEventLifecycle.mockReset().mockResolvedValue(null);
    rpc.mockReset();
  });

  it.each([
    [SLUG, "archived", 410],
    [ID, "archived", 410],
    [SLUG, "draft", 404],
    [ID, "pending_review", 404],
    [SLUG, null, 404],
  ])("resolver null for %s (lifecycle %s) -> %i noindex, no event fetch", async (param, lifecycle, status) => {
    resolvePublicEventRef.mockResolvedValue(null);
    hiddenEventLifecycle.mockResolvedValue(lifecycle);
    const { thrown } = await run(param);
    expect(thrown).toBeInstanceOf(Response);
    const res = thrown as Response;
    expect(res.status).toBe(status);
    expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
    expect(rpc).not.toHaveBeenCalled();
  });

  it("transient resolver error -> NOT a 404 (no deindex on a blip)", async () => {
    resolvePublicEventRef.mockRejectedValue(new Error("db blip"));
    const { thrown } = await run(SLUG);
    expect(thrown instanceof Response && thrown.status === 404).toBe(false);
  });

  it("public series by uuid -> 301 to its slug", async () => {
    resolvePublicEventRef.mockResolvedValue({ id: ID, slug: SLUG });
    const { thrown } = await run(ID);
    expect((thrown as Response).status).toBe(301);
    expect((thrown as Response).headers.get("Location")).toBe(`/event/${SLUG}`);
  });
});
