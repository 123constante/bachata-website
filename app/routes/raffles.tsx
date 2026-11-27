import { buildSeoForRoute } from "@/lib/seo";
import { flags } from "@/lib/featureFlags";
import Raffles from "@/pages/Raffles";
import { redirect } from "react-router";
import type { MetaFunction } from "react-router";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { seoInputToMeta } from "../seoMeta";

// Framework route for /raffles (site structure S5b), behind VITE_ENABLE_SITE_HEADS_SSR.
// Server head = the same buildSeoForRoute('raffles') the page's useSeo uses.
export const meta: MetaFunction = () => seoInputToMeta(buildSeoForRoute("raffles"));

// Flag off: same as the client <Navigate to="/" replace /> in AnimatedRoutes.
export function loader() {
  if (!flags.rafflesPage) return redirect("/", 302);
  return null;
}

export default function RafflesRoute() {
  return (
    <InitialVisiblePageTransition>
      <Raffles />
    </InitialVisiblePageTransition>
  );
}
