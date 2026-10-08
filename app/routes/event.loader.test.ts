import { describe, it, expect, vi, beforeEach } from "vitest";

// /event/:id must not render a series the public page gate hides. The gate is
// resolve_public_event_ref_v1 (prod: lifecycle in live|ended), which returns
// null for archived, draft and pending_review; the loader must turn that into a
// 404 with noindex, by slug AND by uuid, and never fetch the event body.
// (2026-10-08 takedown re-walk: the archived party's page was still served.)

const resolvePublicEventRef = vi.fn();
const rpc = vi.fn();
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef }));
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

describe("event loader: hidden series 404", () => {
  beforeEach(() => {
    resolvePublicEventRef.mockReset();
    rpc.mockReset();
  });

  it.each([SLUG, ID])("resolver null (archived/draft/pending_review) for %s -> 404 noindex, no event fetch", async (param) => {
    resolvePublicEventRef.mockResolvedValue(null);
    const { thrown } = await run(param);
    expect(thrown).toBeInstanceOf(Response);
    const res = thrown as Response;
    expect(res.status).toBe(404);
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
