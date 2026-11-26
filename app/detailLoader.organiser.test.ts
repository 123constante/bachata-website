import { describe, it, expect, vi, beforeEach } from "vitest";
import { QueryClient } from "@tanstack/react-query";

const resolvePublicOrganiserRef = vi.fn();
vi.mock("@/lib/seo/resolvePublicOrganiserRef", () => ({ resolvePublicOrganiserRef }));
vi.mock("@/lib/seo/resolvePublicEventRef", () => ({ resolvePublicEventRef: vi.fn() }));
vi.mock("@/integrations/supabase/getSupabase", () => ({ getSupabase: async () => ({}) }));

const UUID = "c81746db-945b-47af-bdca-501886e105e0";

// Mirrors app/routes/organiser.tsx: resolve -> 404 -> canonical redirect.
async function run(param: string, search = "") {
  const { resolveEntityInLoader, throwDetailNotFound, redirectToCanonicalSlug } = await import(
    "./detailLoader"
  );
  const request = new Request(`https://www.bachatacalendar.co.uk/organisers/${param}${search}`);
  try {
    const ref = await resolveEntityInLoader(new QueryClient(), "organiser_profiles", param);
    if (!ref.id) throwDetailNotFound("Organiser");
    redirectToCanonicalSlug(ref, param, request, "/organisers");
    return { ref };
  } catch (thrown) {
    return { thrown: thrown as Response | Error };
  }
}

// Resolver-error rethrow is covered in src/lib/seo/resolvePublicOrganiserRef.test.ts
// (a rejected fetchQuery surfaces as an unhandled rejection under vitest here).
describe("organiser loader: canonical slug redirect", () => {
  beforeEach(() => resolvePublicOrganiserRef.mockReset());

  it("old slug 301s to the current slug", async () => {
    resolvePublicOrganiserRef.mockResolvedValue({ id: "o1", slug: "bpmdancestudios" });
    const { thrown } = await run("bpm-dance-studios");
    const res = thrown as Response;
    expect(res.status).toBe(301);
    expect(res.headers.get("Location")).toBe("/organisers/bpmdancestudios");
    expect(resolvePublicOrganiserRef).toHaveBeenCalledWith("bpm-dance-studios", "throw");
  });

  it("keeps the query string", async () => {
    resolvePublicOrganiserRef.mockResolvedValue({ id: "o1", slug: "bpmdancestudios" });
    const { thrown } = await run("bpm-dance-studios", "?ref=ig");
    expect((thrown as Response).headers.get("Location")).toBe(
      "/organisers/bpmdancestudios?ref=ig",
    );
  });

  it("uuid 301s to the slug", async () => {
    resolvePublicOrganiserRef.mockResolvedValue({ id: UUID, slug: "bpmdancestudios" });
    const { thrown } = await run(UUID);
    expect((thrown as Response).status).toBe(301);
    expect((thrown as Response).headers.get("Location")).toBe("/organisers/bpmdancestudios");
  });

  it("current slug does not redirect", async () => {
    resolvePublicOrganiserRef.mockResolvedValue({ id: "o1", slug: "bpmdancestudios" });
    const out = await run("bpmdancestudios");
    expect(out.thrown).toBeUndefined();
    expect(out.ref?.id).toBe("o1");
  });

  it("unresolvable slug is a 404 with noindex", async () => {
    resolvePublicOrganiserRef.mockResolvedValue(null);
    const { thrown } = await run("nobody-here");
    expect((thrown as Response).status).toBe(404);
    expect((thrown as Response).headers.get("X-Robots-Tag")).toBe("noindex");
  });
});
