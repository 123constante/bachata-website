import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";

// /event/:id page states x SEO outputs, over EVERY lifecycle shape the prod
// survey of 2026-10-08 found (counts in the `prod` column; read-only, counts
// only). Owner decisions, final:
//   (a) PAUSED with a past public date: 200, indexable, in sitemap, visible
//       "On hiatus", JSON-LD with NO Event node (see eventPageSeoPolicy for why
//       not EventPostponed).
//   (b) ARCHIVED (taken down): 410 Gone + noindex, by slug AND uuid. Restoring
//       makes the resolver answer again, and the page is a 200 again.
//   (c) a cancelled date on a live series: 200, indexed, EventCancelled.
//   (d) ENDED: 200, indexed, no offers, links to the organiser's current events.
// Expected values are LITERALS here, never derived from the policy under test.

const resolvePublicEventRef = vi.fn();
const hiddenEventLifecycle = vi.fn();
const rpc = vi.fn();
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

const ORIGIN = "https://www.bachatacalendar.co.uk";
const ID = "c81746db-945b-47af-bdca-501886e105e0";
const TICKETS = [{ url: "https://tickets.example/x", name: "Entry", price: 10, currency: "GBP" }];

type Shape = {
  name: string;
  prod: number;
  lifecycle: "live" | "ended" | "paused" | "archived" | "draft" | "pending_review" | null;
  recurring: boolean;
  dates: "future" | "past+future" | "past-only" | "none";
  param: string;
  /** What resolve_public_event_ref_v1 returns (prod SQL: live|ended, or paused WITH a past public date). */
  resolves: boolean;
  headlineCancelled?: boolean;
  tickets?: typeof TICKETS | null;
  nullFields?: boolean;
  expect: {
    status: 200 | 404 | 410;
    canonical: string | null;
    indexable: boolean;
    inSitemap: boolean;
    jsonLdType: "Event" | null;
    eventStatus: "EventScheduled" | "EventCancelled" | null;
    offers: boolean;
    visible: string | null;
  };
};

const ok = (slug: string, e: Partial<Shape["expect"]>): Shape["expect"] => ({
  status: 200,
  canonical: `${ORIGIN}/event/${slug}`,
  indexable: true,
  inSitemap: true,
  jsonLdType: "Event",
  eventStatus: "EventScheduled",
  offers: true,
  visible: null,
  ...e,
});
const hidden = (status: 404 | 410): Shape["expect"] => ({
  status,
  canonical: null,
  indexable: false,
  inSitemap: false,
  jsonLdType: null,
  eventStatus: null,
  offers: false,
  visible: null,
});

const SHAPES: Shape[] = [
  { name: "live single future-only", prod: 6, lifecycle: "live", recurring: false, dates: "future", param: "s-live-1", resolves: true, tickets: TICKETS, expect: ok("s-live-1", {}) },
  { name: "live single past+future", prod: 4, lifecycle: "live", recurring: false, dates: "past+future", param: "s-live-2", resolves: true, tickets: TICKETS, expect: ok("s-live-2", {}) },
  { name: "live single past-only", prod: 8, lifecycle: "live", recurring: false, dates: "past-only", param: "s-live-3", resolves: true, tickets: TICKETS, expect: ok("s-live-3", {}) },
  { name: "live recurring future-only", prod: 1, lifecycle: "live", recurring: true, dates: "future", param: "s-live-4", resolves: true, tickets: TICKETS, expect: ok("s-live-4", {}) },
  { name: "live recurring past+future", prod: 21, lifecycle: "live", recurring: true, dates: "past+future", param: "s-live-5", resolves: true, tickets: TICKETS, expect: ok("s-live-5", {}) },
  { name: "live recurring past-only", prod: 1, lifecycle: "live", recurring: true, dates: "past-only", param: "s-live-6", resolves: true, tickets: null, expect: ok("s-live-6", { offers: false }) },
  { name: "live recurring, headline date cancelled", prod: 18, lifecycle: "live", recurring: true, dates: "past+future", param: "s-live-7", resolves: true, headlineCancelled: true, tickets: TICKETS, expect: ok("s-live-7", { eventStatus: "EventCancelled", visible: "Cancelled" }) },
  { name: "live single, headline date cancelled", prod: 1, lifecycle: "live", recurring: false, dates: "past+future", param: "s-live-8", resolves: true, headlineCancelled: true, tickets: null, expect: ok("s-live-8", { eventStatus: "EventCancelled", offers: false, visible: "Cancelled" }) },
  { name: "live, empty/null venue+organiser+tickets+description", prod: 0, lifecycle: "live", recurring: false, dates: "future", param: "s-live-9", resolves: true, nullFields: true, tickets: null, expect: ok("s-live-9", { offers: false }) },
  { name: "ended single past-only", prod: 13, lifecycle: "ended", recurring: false, dates: "past-only", param: "s-ended-1", resolves: true, tickets: TICKETS, expect: ok("s-ended-1", { offers: false, visible: "organiser door" }) },
  { name: "ended, final date cancelled", prod: 5, lifecycle: "ended", recurring: false, dates: "past-only", param: "s-ended-2", resolves: true, headlineCancelled: true, tickets: TICKETS, expect: ok("s-ended-2", { offers: false, eventStatus: "EventCancelled", visible: "organiser door" }) },
  { name: "ended, still holding future rows + ticket rows", prod: 2, lifecycle: "ended", recurring: false, dates: "past+future", param: "s-ended-3", resolves: true, tickets: TICKETS, expect: ok("s-ended-3", { offers: false, visible: "organiser door" }) },
  { name: "paused recurring with past dates (latino-flava-wednesdays)", prod: 1, lifecycle: "paused", recurring: true, dates: "past+future", param: "latino-flava-wednesdays", resolves: true, tickets: TICKETS, expect: ok("latino-flava-wednesdays", { jsonLdType: null, eventStatus: null, offers: false, visible: "On hiatus" }) },
  { name: "paused with no past public date", prod: 0, lifecycle: "paused", recurring: true, dates: "future", param: "s-paused-2", resolves: false, expect: hidden(404) },
  { name: "archived single by slug", prod: 344, lifecycle: "archived", recurring: false, dates: "past-only", param: "s-archived-1", resolves: false, expect: hidden(410) },
  { name: "archived recurring by slug, future rows", prod: 11, lifecycle: "archived", recurring: true, dates: "past+future", param: "s-archived-2", resolves: false, expect: hidden(410) },
  { name: "archived by uuid (no slug on file)", prod: 608, lifecycle: "archived", recurring: false, dates: "none", param: ID, resolves: false, expect: hidden(410) },
  { name: "draft", prod: 2, lifecycle: "draft", recurring: true, dates: "past+future", param: "s-draft", resolves: false, expect: hidden(404) },
  { name: "pending_review", prod: 0, lifecycle: "pending_review", recurring: false, dates: "future", param: "s-pending", resolves: false, expect: hidden(404) },
  { name: "unknown slug (never existed)", prod: 0, lifecycle: null, recurring: false, dates: "none", param: "no-such-event", resolves: false, expect: hidden(404) },
];

async function runLoader(param: string) {
  const mod = await import("./event");
  const request = new Request(`${ORIGIN}/event/${param}`);
  try {
    return { mod, result: (await mod.loader({ params: { id: param }, request } as never)) as unknown as Record<string, unknown> };
  } catch (thrown) {
    return { mod, thrown };
  }
}

async function jsonLdFor(s: Shape) {
  const { buildEventJsonLd } = await import("@/lib/buildEventJsonLd");
  return buildEventJsonLd({
    name: "Night",
    url: `${ORIGIN}/event/${s.param}`,
    startDate: "2026-09-02T18:00:00.000Z",
    lifecycleStatus: s.lifecycle,
    isCancelled: !!s.headlineCancelled,
    offers: s.tickets ?? null,
    venue: s.nullFields ? null : { name: "Venue", address: "1 St", postcode: "N1", city: "london" },
    organiser: s.nullFields ? null : { name: "Org" },
    description: s.nullFields ? null : "Desc",
  } as never) as Record<string, unknown> | null;
}

describe("event page SEO matrix: every prod shape", () => {
  beforeEach(() => {
    resolvePublicEventRef.mockReset();
    hiddenEventLifecycle.mockReset();
    rpc.mockReset().mockResolvedValue({ data: null, error: null });
  });

  it.each(SHAPES.map((s) => [s.name, s] as const))("%s", async (_n, s) => {
    const slug = s.param === ID ? null : s.param;
    resolvePublicEventRef.mockResolvedValue(s.resolves ? { id: ID, slug } : null);
    hiddenEventLifecycle.mockResolvedValue(s.resolves ? null : s.lifecycle);

    // status code + robots + canonical
    const { mod, result, thrown } = await runLoader(s.param);
    if (s.expect.status === 200) {
      expect(thrown).toBeUndefined();
      const meta = mod.meta({ data: { ...result, title: "Night" } } as never) as Record<string, string>[];
      const canonical = meta.find((m) => m.rel === "canonical")?.href ?? null;
      expect(canonical).toBe(s.expect.canonical);
      const robots = meta.find((m) => m.name === "robots")?.content ?? "";
      expect(robots.includes("noindex")).toBe(!s.expect.indexable);
    } else {
      expect(thrown).toBeInstanceOf(Response);
      const res = thrown as Response;
      expect(res.status).toBe(s.expect.status);
      expect(res.headers.get("X-Robots-Tag")).toBe("noindex");
      expect(rpc).not.toHaveBeenCalled();
    }

    // sitemap membership: list_public_event_urls_v1 and the resolver share ONE
    // SQL predicate, so a URL is listed exactly when it resolves.
    const { eventPageSeoPolicy } = await import("@/lib/seo/eventPageSeoPolicy");
    const policy = eventPageSeoPolicy({
      resolves: s.resolves,
      lifecycleStatus: s.lifecycle,
      isCancelled: !!s.headlineCancelled,
    });
    expect(policy.inSitemap).toBe(s.expect.inSitemap);
    expect(policy.status).toBe(s.expect.status);
    expect(policy.indexable).toBe(s.expect.indexable);

    // JSON-LD (only rendered on a 200 page)
    if (s.expect.status === 200) {
      const node = await jsonLdFor(s);
      expect(node?.["@type"] ?? null).toBe(s.expect.jsonLdType);
      expect(node ? String(node.eventStatus).replace("https://schema.org/", "") : null).toBe(s.expect.eventStatus);
      expect(!!node && "offers" in node).toBe(s.expect.offers);
    }

    // visible text
    if (s.expect.status === 200) {
      const { selectLifecycleBanners } = await import("@/modules/event-page/bento/lifecycleBanner");
      const { EventPausedBanner } = await import("@/modules/event-page/bento/EventPausedBanner");
      const banners = selectLifecycleBanners({
        isCancelled: !!s.headlineCancelled,
        isPaused: s.lifecycle === "paused",
        isEnded: s.lifecycle === "ended",
      });
      const html = banners.includes("paused") ? renderToStaticMarkup(createElement(EventPausedBanner)) : "";
      const visible =
        // The door's visible heading is "More from {organiser}" (data-driven);
        // its accessible name is the policy's label, which BentoPage passes.
        s.lifecycle === "ended" && policy.endedDoorLabel === "Still running from this organiser"
          ? "organiser door"
          : banners.includes("paused") && html.includes("On hiatus")
            ? "On hiatus"
            : banners.includes("cancelled")
              ? "Cancelled"
              : null;
      expect(visible).toBe(s.expect.visible);
    }
  });

  it("restoring an archived series: resolver answers again -> 200, no lifecycle lookup", async () => {
    resolvePublicEventRef.mockResolvedValue({ id: ID, slug: "s-archived-1" });
    const { thrown } = await runLoader("s-archived-1");
    expect(thrown).toBeUndefined();
    expect(hiddenEventLifecycle).not.toHaveBeenCalled();
  });

  it("lifecycle lookup failure on a hidden series -> 404 (never 410 on a guess, never 500)", async () => {
    resolvePublicEventRef.mockResolvedValue(null);
    hiddenEventLifecycle.mockRejectedValue(new Error("boom"));
    const { thrown } = await runLoader("s-archived-1");
    expect((thrown as Response).status).toBe(404);
  });
});
