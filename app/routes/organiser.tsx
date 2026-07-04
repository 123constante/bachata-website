import { type ReactNode } from "react";
import ComingSoonGate from "@/components/ComingSoonGate";
import { PageTransition } from "@/components/PageTransition";
import { flags } from "@/lib/featureFlags";
import OrganiserProfile from "@/pages/OrganiserProfile";
import type { Route } from "./+types/organiser";

// SPIKE — the gated detail route. Proves ComingSoonGate SSRs correctly in both
// states, and that the noindex is emitted at the SSR document level via meta()
// (the gate's own noindex is a useEffect, which never runs on the server — so a
// server-rendered locked page would otherwise ship indexable). When the flag is
// OFF the raw SSR HTML must contain robots noindex.
export const meta: Route.MetaFunction = () => {
  if (flags.organiserDetail) {
    return [{ title: "Organiser — Bachata Calendar" }];
  }
  return [
    { title: "Coming soon — Organiser — Bachata Calendar" },
    { name: "robots", content: "noindex,nofollow" },
  ];
};

// SSR-visible entrance (D2 — see app/routes/event.tsx for the rationale).
let clientNavigated = false;
function InitialVisiblePageTransition({ children }: { children: ReactNode }) {
  // Module-scoped flag survives the key-remount; false at hydration so the
  // SSR markup matches. Only client navigations play the entrance fade.
  const animate = clientNavigated;
  if (typeof window !== "undefined") clientNavigated = true;
  if (!animate) {
    return <div style={{ width: "100%", minHeight: "100vh" }}>{children}</div>;
  }
  return <PageTransition>{children}</PageTransition>;
}

export default function OrganiserRoute() {
  return (
    <ComingSoonGate
      enabled={flags.organiserDetail}
      title="Organiser"
      section="organiser_detail"
    >
      <InitialVisiblePageTransition>
        <OrganiserProfile />
      </InitialVisiblePageTransition>
    </ComingSoonGate>
  );
}
