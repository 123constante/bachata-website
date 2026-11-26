import { describe, it, expect, vi, beforeEach } from "vitest";

const maybeSingle = vi.fn();
const rpc = vi.fn(() => ({ maybeSingle }));
const fbMaybeSingle = vi.fn();
const eq = vi.fn(() => ({ maybeSingle: fbMaybeSingle }));
const select = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ select }));
vi.mock("@/integrations/supabase/getSupabase", () => ({ getSupabase: async () => ({ rpc, from }) }));

import { resolvePublicOrganiserRef } from "./resolvePublicOrganiserRef";

describe("resolvePublicOrganiserRef", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    fbMaybeSingle.mockReset();
    rpc.mockClear();
    from.mockClear();
    eq.mockClear();
  });

  it("maps a row and calls the RPC with p_param", async () => {
    maybeSingle.mockResolvedValue({ data: { id: "o1", slug: "bpmdancestudios" }, error: null });
    expect(await resolvePublicOrganiserRef("bpm-dance-studios", "throw")).toEqual({
      id: "o1",
      slug: "bpmdancestudios",
    });
    expect(rpc).toHaveBeenCalledWith("resolve_public_organiser_ref_v1", {
      p_param: "bpm-dance-studios",
    });
    expect(from).not.toHaveBeenCalled();
  });

  it("returns null when no row", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: null });
    expect(await resolvePublicOrganiserRef("x", "throw")).toBeNull();
  });

  it("throws on error with 'throw'", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    await expect(resolvePublicOrganiserRef("x", "throw")).rejects.toThrow("boom");
    expect(from).not.toHaveBeenCalled();
  });

  it("returns null on error with 'swallow'", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect(await resolvePublicOrganiserRef("x", "swallow")).toBeNull();
  });

  it("falls back to the direct slug lookup while the RPC is missing (PGRST202)", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "not found" } });
    fbMaybeSingle.mockResolvedValue({ data: { id: "o1", slug: "bpm-dance-studios" }, error: null });
    expect(await resolvePublicOrganiserRef("bpm-dance-studios", "throw")).toEqual({
      id: "o1",
      slug: "bpm-dance-studios",
    });
    expect(from).toHaveBeenCalledWith("organiser_profiles");
    expect(eq).toHaveBeenCalledWith("slug", "bpm-dance-studios");
  });

  it("falls back by id for a uuid param (42883)", async () => {
    const uuid = "11111111-2222-3333-4444-555555555555";
    maybeSingle.mockResolvedValue({ data: null, error: { code: "42883", message: "undefined" } });
    fbMaybeSingle.mockResolvedValue({ data: { id: uuid, slug: "bpm-dance-studios" }, error: null });
    expect(await resolvePublicOrganiserRef(uuid, "throw")).toEqual({ id: uuid, slug: "bpm-dance-studios" });
    expect(eq).toHaveBeenCalledWith("id", uuid);
  });

  it("fallback error still throws with 'throw'", async () => {
    maybeSingle.mockResolvedValue({ data: null, error: { code: "PGRST202", message: "x" } });
    fbMaybeSingle.mockResolvedValue({ data: null, error: { message: "blip" } });
    await expect(resolvePublicOrganiserRef("x", "throw")).rejects.toThrow("blip");
  });
});
