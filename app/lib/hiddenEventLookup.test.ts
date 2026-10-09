import { describe, it, expect, vi } from "vitest";
import { hiddenEventLifecycle } from "./hiddenEventLookup";

// The /event loader's 404-vs-410 read: the lifecycle of a series the public
// resolver hides, by slug or by uuid, via the service-role key.

const ID = "c81746db-945b-47af-bdca-501886e105e0";
const ENV = { SUPABASE_URL: "https://x.supabase.co/", SUPABASE_SERVICE_ROLE_KEY: "svc" };
const rowsFetch = (rows: unknown[]) => vi.fn(async () => new Response(JSON.stringify(rows)));

describe("hiddenEventLifecycle", () => {
  it("slug: one row -> its lifecycle, filtered by slug", async () => {
    const f = rowsFetch([{ lifecycle_status: "archived" }]);
    await expect(hiddenEventLifecycle("zz-party", ENV, f as unknown as typeof fetch)).resolves.toBe("archived");
    expect((f.mock.calls[0] as unknown as [string])[0]).toBe(
      "https://x.supabase.co/rest/v1/event_series_p5?select=lifecycle_status&slug=eq.zz-party&limit=2",
    );
  });

  it("uuid: filtered by public id (COALESCE(legacy_event_id, id))", async () => {
    const f = rowsFetch([{ lifecycle_status: "draft" }]);
    await expect(hiddenEventLifecycle(ID, ENV, f as unknown as typeof fetch)).resolves.toBe("draft");
    expect((f.mock.calls[0] as unknown as [string])[0]).toContain(
      `or=(legacy_event_id.eq.${ID},and(legacy_event_id.is.null,id.eq.${ID}))`,
    );
  });

  it.each([
    ["no service key", { SUPABASE_URL: "https://x.supabase.co" }, [{ lifecycle_status: "archived" }]],
    ["no row", ENV, []],
    ["ambiguous", ENV, [{ lifecycle_status: "archived" }, { lifecycle_status: "live" }]],
  ])("%s -> null", async (_n, env, rows) => {
    await expect(hiddenEventLifecycle("zz-party", env, rowsFetch(rows) as unknown as typeof fetch)).resolves.toBeNull();
  });

  it.each(["x),id.neq.(", "a&select=*", "has space", "ünïcode"])("param %s never reaches the query string", async (param) => {
    const f = vi.fn();
    await expect(hiddenEventLifecycle(param, ENV, f as unknown as typeof fetch)).resolves.toBeNull();
    expect(f).not.toHaveBeenCalled();
  });

  it("HTTP error throws (the loader turns it into a 404)", async () => {
    const f = vi.fn(async () => new Response("no", { status: 500 }));
    await expect(hiddenEventLifecycle("zz-party", ENV, f as unknown as typeof fetch)).rejects.toThrow("HTTP 500");
  });
});
