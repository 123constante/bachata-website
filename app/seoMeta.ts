import type { SeoInput } from "@/lib/seo";
import { SITE_NAME, SITE_ORIGIN, DEFAULT_OG_IMAGE } from "@/lib/seo";

// Converts a buildSeoForRoute() SeoInput into a React Router meta() descriptor
// array, emitting the SAME tag set useSeo() applies client-side (title+suffix,
// description, canonical link, og:*, twitter:*, robots). Static listing/home
// routes call this from meta() so the SSR/prerendered document ships complete,
// per-page SEO instead of inheriting root.tsx's site-wide defaults.
//
// NOTE: those routes still mount useSeo() (in the page component) which re-applies
// the same values post-hydration + animates the title. Values match, so no SEO
// harm; reconciling the two (suppress useSeo on SSR'd routes) is Phase-3 slice S4.
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

  // Mirror useSeo: declare dimensions only for the known default card.
  if (ogImage === DEFAULT_OG_IMAGE) {
    tags.push(
      { property: "og:image:width", content: "1200" },
      { property: "og:image:height", content: "630" },
      { property: "og:image:type", content: "image/jpeg" },
    );
  }

  if (input.noindex) {
    tags.push({ name: "robots", content: "noindex,nofollow" });
  }

  return tags;
}
