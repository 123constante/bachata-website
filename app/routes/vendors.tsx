import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute } from "@/lib/seo";
import VendorDetail from "@/pages/VendorDetail";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { throwDetailNotFound } from "../detailLoader";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/vendors";

// /vendors/:id — the id is a direct UUID (no slug resolution). VendorDetail
// fetches via useEffect (not React Query), so there's nothing to dehydrate:
// the loader is META-ONLY. It fetches the vendor once to build the SSR meta()
// (VendorDetail re-fetches the same RPC client-side). 404+noindex on a bad id.
export async function loader({ params }: Route.LoaderArgs) {
  const { data, error } = await supabase.rpc("get_public_vendor_detail_v1", { p_id: params.id });
  if (error) throwDetailNotFound("Vendor");
  const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
  if (!row) throwDetailNotFound("Vendor");

  return {
    // Fallback matches VendorDetail's SEO: a live vendor with a blank
    // business_name stays indexable under a 'Vendor' name.
    entityName: (row.business_name as string | null) || "Vendor",
    entitySlug: params.id,
    ogImage: (row.avatar_url as string | null) ?? undefined,
  };
}

export const meta: Route.MetaFunction = ({ data }) =>
  seoInputToMeta(
    buildSeoForRoute("vendor.detail", {
      entityName: data?.entityName,
      entitySlug: data?.entitySlug,
      ogImage: data?.ogImage,
    }),
  );

export default function VendorRoute({ params }: Route.ComponentProps) {
  return (
    <InitialVisiblePageTransition key={params.id}>
      <VendorDetail />
    </InitialVisiblePageTransition>
  );
}
