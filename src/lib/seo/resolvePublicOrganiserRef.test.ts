import { describe, it, expect, vi, beforeEach } from "vitest";

const maybeSingle = vi.fn();
const rpc = vi.fn(() => ({ maybeSingle }));
vi.mock("@/integrations/supabase/getSupabase", () => ({ getSupabase: async () => ({ rpc }) }));

import { resolvePublicOrganiserRef } from "./resolvePublicOrganiserRef";

describe("resolvePublicOrganiserRef", () => {
  beforeEach(() => {
    maybeSingle.mockReset();
    rpc.mockClear();
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
});
