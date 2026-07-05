import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { SITE_ORIGIN } from "@/lib/seo";
import OrganiserProfile from "@/pages/OrganiserProfile";
import type { Route } from "./+types/organiser";

// The gated detail route. When the flag is OFF, ComingSoonGate renders the
// placeholder and meta() emits noindex in the raw SSR HTML (the gate's own
// noindex is a client-only useEffect that never runs on the server). When ON,
// emit a per-page canonical so the SSR document doesn't inherit root.tsx's
// homepage canonical. Bot UAs are served the OG card by middleware.ts (its
// /organisers matcher is restored).
export const meta: Route.MetaFunction = ({ params }) => {
  const canonical = params.id ? `${SITE_ORIGIN}/organisers/${params.id}` : SITE_ORIGIN;
  if (!flags.organiserDetail) {
    return [
      { title: "Coming soon — Organiser — Bachata Calendar" },
      { name: "robots", content: "noindex,nofollow" },
    ];
  }
  return [
    { title: "Organiser — Bachata Calendar" },
    { tagName: "link", rel: "canonical", href: canonical },
  ];
};

export default function OrganiserRoute({ params }: Route.ComponentProps) {
  return (
    <ComingSoonGate
      enabled={flags.organiserDetail}
      title="Organiser"
      section="organiser_detail"
    >
      {/* key={params.id} resets per-organiser state on param-only navigation. */}
      <InitialVisiblePageTransition key={params.id}>
        <OrganiserProfile />
      </InitialVisiblePageTransition>
    </ComingSoonGate>
  );
}
