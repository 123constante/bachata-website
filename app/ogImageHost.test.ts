import { describe, it, expect, vi, beforeEach } from "vitest";

// resolveOgCardImage reads the baked card through get_og_image_v1; stub the
// client so the test controls exactly which URL the RPC hands back.
const rpc = vi.fn();
vi.mock("@/integrations/supabase/getSupabase", () => ({
  getSupabase: async () => ({ rpc }),
}));

import { resolveOgCardImage, normalizeOgImage } from "./detailLoader";
import { sameHostImage } from "./sameHostImage";

// A real-shaped baked card: admin migration 20261129670000 moved every stored
// og_render.image_url from the r2.dev bucket host onto the media custom domain.
const BAKED_MEDIA =
  "https://media.bachatacalendar.co.uk/events/og/event/01173937-0000-4000-8000-46b1f42d630c.jpg";
const BAKED_R2 =
  "https://pub-07f606224cac4f2596903c44df723644.r2.dev/events/og/event/01173937-0000-4000-8000-46b1f42d630c.jpg";
const WWW = "https://www.bachatacalendar.co.uk";

function ogFor(baked: string | null, requestUrl = `${WWW}/event/el-grande`) {
  rpc.mockResolvedValueOnce({ data: baked, error: null });
  return resolveOgCardImage({
    entityType: "event",
    entityId: "01173937-0000-4000-8000-46b1f42d630c",
    coverUrl: "https://media.bachatacalendar.co.uk/events/covers/x.jpg?v=1",
    request: new Request(requestUrl),
    fallbackImage: `${WWW}/og-image.jpg`,
  });
}

beforeEach(() => rpc.mockReset());

describe("resolveOgCardImage: a baked card stays on the host that stores it", () => {
  it("leaves a media.bachatacalendar.co.uk baked card unchanged", async () => {
    expect(await ogFor(BAKED_MEDIA)).toBe(BAKED_MEDIA);
  });

  it("leaves an r2.dev baked card unchanged (rows not yet moved)", async () => {
    expect(await ogFor(BAKED_R2)).toBe(BAKED_R2);
  });

  it("puts the live /api/og/card fallback on the request host (apex fetch)", async () => {
    const url = await ogFor(null, "https://bachatacalendar.co.uk/event/el-grande");
    expect(new URL(url).host).toBe("bachatacalendar.co.uk");
    expect(new URL(url).pathname).toBe("/api/og/card");
  });
});

describe("normalizeOgImage: the /api/og/card wrapper is a site URL", () => {
  it("is moved onto the request host even when the cover is on the media host", () => {
    const url = normalizeOgImage({
      rawUrl: BAKED_MEDIA,
      request: new Request("https://bachatacalendar.co.uk/venue/x"),
      fallbackImage: `${WWW}/og-image.jpg`,
    });
    expect(new URL(url).host).toBe("bachatacalendar.co.uk");
    expect(new URL(url).searchParams.get("src")).toBe(BAKED_MEDIA);
  });
});

// The same function middleware.ts (Edge) imports -- one definition, so the
// bot-served kinds and the SSR loaders cannot disagree.
describe("sameHostImage", () => {
  const cases: Array<[string, string, string, string]> = [
    ["media host unchanged", BAKED_MEDIA, WWW, BAKED_MEDIA],
    ["media host unchanged on an apex fetch", BAKED_MEDIA, "https://bachatacalendar.co.uk", BAKED_MEDIA],
    ["apex moved to www request host", "https://bachatacalendar.co.uk/x.jpg", WWW, `${WWW}/x.jpg`],
    ["www moved to apex request host", `${WWW}/x.jpg`, "https://bachatacalendar.co.uk", "https://bachatacalendar.co.uk/x.jpg"],
    ["http www upgraded to request protocol", "http://www.bachatacalendar.co.uk/x.jpg", WWW, `${WWW}/x.jpg`],
    ["request host itself (preview deploy) kept", "https://abc.vercel.app/x.jpg", "https://abc.vercel.app", "https://abc.vercel.app/x.jpg"],
    ["site URL moved onto a preview request host", `${WWW}/api/og/card?kind=image`, "https://abc.vercel.app", "https://abc.vercel.app/api/og/card?kind=image"],
    ["relative URL resolved against request host", "/api/og/card?kind=event", WWW, `${WWW}/api/og/card?kind=event`],
    ["third-party host unchanged", "https://flagcdn.com/x.png", WWW, "https://flagcdn.com/x.png"],
    ["look-alike host unchanged", "https://www.bachatacalendar.co.uk.evil.example/x.jpg", WWW, "https://www.bachatacalendar.co.uk.evil.example/x.jpg"],
    ["unknown subdomain unchanged", "https://cdn.bachatacalendar.co.uk/x.jpg", WWW, "https://cdn.bachatacalendar.co.uk/x.jpg"],
  ];
  it.each(cases)("%s", (_label, image, origin, expected) => {
    expect(sameHostImage(image, origin)).toBe(expected);
  });
});
