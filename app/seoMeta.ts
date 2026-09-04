import type { SeoInput } from "@/lib/seo";
import { SITE_NAME, SITE_ORIGIN, DEFAULT_OG_IMAGE } from "@/lib/seo";

// Converts a buildSeoForRoute() SeoInput into a React Router meta() descriptor
// array, emitting the SAME tag set useSeo() applies client-side (title+suffix,
// description, canonical link, og:*, twitter:*, robots). Static listing/home
// routes call this from meta() so the SSR/prerendered document ships complete,
// per-page SEO instead of inheriting root.tsx's site-wide defaults.
//
// NOTE: a page component on such a route may still MOUNT useSeo(), but on THAT route
// it no longer RUNS. Slice S4 shipped in 1fcca09 (2026-07-05): useSeo returns on
// RouteOwnsHeadContext, which InitialVisiblePageTransition provides on every
// framework route that renders a page -- EXCEPT routes/catchall.tsx, which is a
// framework route that deliberately does not wrap, and where useSeo is still the
// sole head manager. Do not read this note as "useSeo is dead": three components
// (Index, Parties, Classes) are mounted BOTH ways and are live on the catchall's
// /city/:slug/* URLs. See the census in BentoPage.tsx before deleting one.
// This note used to say those calls "re-apply the same values post-hydration" and
// that S4 was still pending -- stale from the day S4 landed, and half the reason
// arc W17 was filed as a client-side overwrite of an ended og:description that
// never happened. A call site cannot be judged without the context it reads.
export function seoInputToMeta(input: SeoInput): Array<Record<string, string>> {
  const title = input.title.includes(SITE_NAME) ? input.title : `${input.title} | ${SITE_NAME}`;
  const canonical = input.canonical ?? SITE_ORIGIN;
  const ogImage = input.ogImage ?? DEFAULT_OG_IMAGE;
  const ogType = input.ogType ?? "website";

  const tags: Array<Record<string, string>> = [
    { title },
    { name: "description", content: input.description },
    { tagName: "link", rel: "canonical", href: canonical },
    { property: "og:title", content: title },
    { property: "og:description", content: input.description },
    { property: "og:url", content: canonical },
    { property: "og:image", content: ogImage },
    { property: "og:type", content: ogType },
    { name: "twitter:card", content: "summary_large_image" },
    { name: "twitter:title", content: title },
    { name: "twitter:description", content: input.description },
    { name: "twitter:image", content: ogImage },
  ];

  // Every og:image this app serves is a normalized 1200x630 JPEG — the default
  // card, an R2-baked event/festival card, and the live /api/og/card render
  // (kind=image letterboxes entity covers to the same frame; see app/lib/
  // ogCardRender CARD_W/CARD_H and api.og.card's image/jpeg response). Declare
  // the dimensions + type for ALL of them, not just the default: WhatsApp and
  // other crawlers use og:image:width/height to lay out the link preview, and
  // omitting them on the dynamic-card path degraded the preview on the most-
  // shared surface (events/festivals).
  tags.push(
    { property: "og:image:width", content: "1200" },
    { property: "og:image:height", content: "630" },
    { property: "og:image:type", content: "image/jpeg" },
  );

  if (input.noindex) {
    tags.push({ name: "robots", content: "noindex,nofollow" });
  }

  return tags;
}
