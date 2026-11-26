// /raffle/win/:token -- framework route whose ONLY job is the WhatsApp/link
// preview card (golden "You won!" ticket). The page itself is exactly what the
// catchall renders for this path: same hydration gate + AnimatedRoutes, so the
// claim flow and its transition are unchanged after hydration.
//
// No loader, deliberately: the token must never reach the server output, and
// the shell stays edge-cacheable (see catchall.tsx for the full reasoning).
// No token appears in any meta value either.
import { SITE_ORIGIN } from "@/lib/seo";
import CatchAll from "./catchall";
import { staticShellCacheHeaders } from "../detailLoader";
import type { Route } from "./+types/raffle-win";

// Same load-bearing eager auth client import as the catchall (auth routes share
// the shell; keeps Supabase client construction in the first-load graph).
import "@/integrations/supabase/eagerAuthClient";

export function headers() {
  return staticShellCacheHeaders();
}

const TITLE = "You won a free night!";
const DESCRIPTION =
  "Pick your free night at a bachata event. From Ricky at Bachata Calendar.";

export const meta: Route.MetaFunction = () => [
  { title: TITLE },
  { name: "description", content: DESCRIPTION },
  { property: "og:title", content: TITLE },
  { property: "og:description", content: DESCRIPTION },
  { property: "og:image", content: `${SITE_ORIGIN}/og-raffle-win.jpg` },
  { property: "og:image:width", content: "1200" },
  { property: "og:image:height", content: "630" },
  { property: "og:type", content: "website" },
  { name: "twitter:card", content: "summary_large_image" },
  { name: "robots", content: "noindex, nofollow" },
];

export default CatchAll;
