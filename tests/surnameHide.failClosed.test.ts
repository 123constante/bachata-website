import { describe, it, expect, vi, beforeEach } from "vitest";

type Mode = "ok" | "missing" | "network" | "empty" | "partial" | "garbage";
let mode: Mode = "ok";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    rpc: async (fn: string, args: { p_ids: string[] }) => {
      if (fn !== "get_public_dancer_names_v1") throw new Error(`unexpected rpc ${fn}`);
      switch (mode) {
        case "ok":
          // hide switch ON for everyone: masked server side
          return { data: args.p_ids.map((id) => ({ id, surname: null, display_name: "Ana", public_name: "Ana" })), error: null };
        case "missing":
          return { data: null, error: { code: "PGRST202", message: "Could not find the function public.get_public_dancer_names_v1(p_ids) in the schema cache", status: 404 } };
        case "network":
          throw new TypeError("Failed to fetch");
        case "empty":
          return { data: [], error: null };
        case "partial":
          return { data: [{ id: "a", surname: null, display_name: "Ana", public_name: "Ana" }], error: null };
        case "garbage":
          return { data: { not: "an array" }, error: null };
      }
    },
  },
}));

import { withPublicNames, resetPublicNamesWarning, PUBLIC_NAMES_FAILED_CODE } from "@/lib/publicDancerNames";
import { mapDancerPublicProfile, attachPublicDancerName } from "@/modules/profile/dancerPublicProfile";
import { renderPublicName, resolvePublicName } from "@/lib/publicName";
import { buildSeoForRoute } from "@/lib/seo/buildSeoForRoute";

// The raw rows never carry surname/display_name (the selects were stripped).
const rows = [
  { id: "a", first_name: "Ana" },
  { id: "b", first_name: "Ana" },
];

const row = async (id: string) => (await withPublicNames(rows)).find((r) => r.id === id)!;

const SURFACES: Record<string, (id: string) => Promise<string>> = {
  "person page": async (id) => mapDancerPublicProfile((await attachPublicDancerName(rows.find((r) => r.id === id)!)) as never).displayName ?? "",
  "line-up credit": async (id) => renderPublicName(await row(id), "Dancer"),
  "search result / teacher-DJ card (RPC rows, not this helper)": async () => "Ana",
  "sitemap filter": async (id) => ((await withPublicNames(rows)).filter((d) => resolvePublicName(d) !== null).find((d) => d.id === id) ? "Ana" : ""),
  "og/meta title": async (id) => {
    const name = mapDancerPublicProfile((await attachPublicDancerName(rows.find((r) => r.id === id)!)) as never).displayName ?? undefined;
    return buildSeoForRoute("dancer.detail", { entityName: name }).title ?? "";
  },
  "JSON-LD": async (id) => JSON.stringify({ "@type": "Person", name: renderPublicName(await row(id), "Dancer") }),
};

const MODES: Mode[] = ["ok", "missing", "network", "empty", "partial", "garbage"];

describe("get_public_dancer_names_v1 fails closed", () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    resetPublicNamesWarning();
    warn = vi.spyOn(console, "warn").mockImplementation(() => {});
  });

  for (const m of MODES) {
    for (const [surface, run] of Object.entries(SURFACES)) {
      it(`${m} | ${surface}: never throws, no surname, first name shown`, async () => {
        mode = m;
        for (const id of ["a", "b"]) {
          const out = await run(id);
          expect(out).toContain("Ana");
          expect(out).not.toMatch(/Lopez/);
        }
      });
    }
  }

  it("the merged row never carries a raw surname in any mode", async () => {
    for (const m of MODES) {
      mode = m;
      for (const r of await withPublicNames(rows)) expect(r.surname).toBeNull();
    }
  });

  it("logs once, at warn level, with the stable code on failure; silent on success", async () => {
    mode = "missing";
    await withPublicNames(rows);
    await withPublicNames(rows);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain(PUBLIC_NAMES_FAILED_CODE);
    expect(JSON.stringify(warn.mock.calls[0])).toContain("PGRST202");
    warn.mockClear();
    resetPublicNamesWarning();
    mode = "ok";
    await withPublicNames(rows);
    expect(warn).not.toHaveBeenCalled();
  });

  it("partial result: the returned id keeps its masked name, the missing id degrades to first name only", async () => {
    mode = "partial";
    const out = await withPublicNames(rows);
    expect(out.find((r) => r.id === "a")!.public_name).toBe("Ana");
    expect(out.find((r) => r.id === "b")!.public_name).toBeNull();
    expect(resolvePublicName(out.find((r) => r.id === "b")!)).toBe("Ana");
  });
});
