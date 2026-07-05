import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute } from "@/lib/seo";
import { getPublicName } from "@/lib/name-utils";
import TeacherProfile from "@/pages/TeacherProfile";
import { createQueryClient } from "@/App";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import { resolveEntityInLoader, throwDetailNotFound } from "../detailLoader";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/teachers";

// Gated detail route (flags.teacherDetail — off in prod). When locked, skip the
// fetch and emit noindex (the gate's own noindex is a client-only effect). When
// unlocked, resolve + fetch the teacher for a rich meta(). META-ONLY: unlike
// dancers/djs this does NOT dehydrate the teacher-profile query — TeacherProfile
// maps the RPC row inline (a ~30-line transform), so the page re-fetches
// client-side rather than risk the loader's copy drifting from that map.
export async function loader({ params }: Route.LoaderArgs) {
  if (!flags.teacherDetail) return { locked: true as const };

  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "dancer_profiles", params.id);
  if (!ref.id) throwDetailNotFound("Teacher");

  const { data, error } = await supabase.rpc("get_public_teacher_detail_v1", {
    p_entity_id: ref.id as string,
  });
  if (error) throwDetailNotFound("Teacher");
  const row = ((data ?? []) as Array<Record<string, unknown>>)[0];
  if (!row) throwDetailNotFound("Teacher");

  return {
    locked: false as const,
    entityName: getPublicName(
      { first_name: row.first_name, surname: row.surname, hide_surname: false } as never,
      "Teacher",
    ),
    entitySlug: ref.slug ?? params.id,
    ogImage: (row.photo_url as string | null) ?? undefined,
  };
}

export const meta: Route.MetaFunction = ({ data }) => {
  if (!data || data.locked) {
    return [
      { title: "Coming soon — Teacher — Bachata Calendar" },
      { name: "robots", content: "noindex,nofollow" },
    ];
  }
  return seoInputToMeta(
    buildSeoForRoute("teacher.detail", {
      entityName: data.entityName,
      entitySlug: data.entitySlug,
      ogImage: data.ogImage,
    }),
  );
};

export default function TeacherRoute({ params }: Route.ComponentProps) {
  return (
    <ComingSoonGate enabled={flags.teacherDetail} title="Teacher" section="teacher_detail">
      <InitialVisiblePageTransition key={params.id}>
        <TeacherProfile />
      </InitialVisiblePageTransition>
    </ComingSoonGate>
  );
}
