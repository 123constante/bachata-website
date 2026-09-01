import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import ComingSoonGate from "@/components/ComingSoonGate";
import { flags } from "@/lib/featureFlags";
import { supabase } from "@/integrations/supabase/client";
import { buildSeoForRoute, DEFAULT_OG_IMAGE } from "@/lib/seo";
import { resolvePublicName } from "@/lib/publicName";
import TeacherProfile from "@/pages/TeacherProfile";
import { createQueryClient } from "@/App";
import { InitialVisiblePageTransition } from "../InitialVisiblePageTransition";
import {
  resolveEntityInLoader,
  throwDetailNotFound,
  cacheHeaders,
  taggedData,
  redirectUuidToSlug,
  normalizeOgImage,
} from "../detailLoader";
import { stampTeacher, TEACHERS } from "../cacheTags";
import { seoInputToMeta } from "../seoMeta";
import type { Route } from "./+types/teachers";

// Gated detail route (flags.teacherDetail — off in prod). When locked, skip the
// fetch and emit noindex (the gate's own noindex is a client-only effect). When
// unlocked, resolve + fetch the teacher for a rich meta(). META-ONLY: unlike
// dancers/djs this does NOT dehydrate the teacher-profile query — TeacherProfile
// maps the RPC row inline (a ~30-line transform), so the page re-fetches
// client-side rather than risk the loader's copy drifting from that map.
export async function loader({ params, request }: Route.LoaderArgs) {
  // Locked: flag-derived, identical for every id, busts on the next deploy (the
  // cache key includes the deployment). Cache it with a coarse group tag only.
  if (!flags.teacherDetail) return taggedData({ locked: true as const }, TEACHERS);

  const qc = createQueryClient();
  const ref = await resolveEntityInLoader(qc, "dancer_profiles", params.id);
  if (!ref.id) throwDetailNotFound("Teacher");
  redirectUuidToSlug(ref, request, "/teachers");

  const { data, error } = await supabase.rpc("get_public_teacher_detail_v1", {
    p_entity_id: ref.id as string,
  });
  if (error) throwDetailNotFound("Teacher");
  const row = ((data ?? []) as Array<Record<string, unknown>>)[0];
  if (!row) throwDetailNotFound("Teacher");

  const photo = row.photo_url;
  const rawPhoto = (Array.isArray(photo) ? photo[0] : photo) as string | null | undefined;
  return taggedData(
    {
      locked: false as const,
      // Dehydrate the slug→uuid resolve (done by resolveEntityInLoader) so the
      // client has the id immediately — otherwise TeacherProfile renders with
      // id=undefined during the client-side resolve window and error-logs to
      // Sentry. The teacher-profile data itself still client-fetches (meta-only).
      dehydratedState: dehydrate(qc),
      // resolvePublicName, not getPublicName: mirrors dancers/djs/organiser --
      // returns null rather than "Teacher" so buildSeoForRoute noindexes a
      // nameless teacher instead of indexing a placeholder <title>/<h1>.
      entityName: resolvePublicName({
        first_name: row.first_name as string | null,
        surname: row.surname as string | null,
      }) ?? undefined,
      entitySlug: ref.slug ?? params.id,
      // Phase 5 prep — normalize og:image through /api/og/card?kind=image so
      // WebP/oversized teacher photos render as social cards. Mirrors
      // middleware.ts's fetchTeacherMeta ogNormalizedImage. NOTE: /teachers is
      // STILL on middleware's matcher and VITE_ENABLE_TEACHER_DETAIL is off in
      // prod (this branch reached only when the flag is on), so bots keep getting
      // the middleware card for now; this makes the SSR route ready to drop off
      // the matcher the moment the teacher-detail flag ships.
      ogImage: normalizeOgImage({ rawUrl: rawPhoto, request, fallbackImage: DEFAULT_OG_IMAGE }),
    },
    stampTeacher(ref.id),
  );
}

// Phase 4a ISR — edge-cache + forward the loader's cache tag (see ../detailLoader).
export function headers({ loaderHeaders }: Route.HeadersArgs) {
  return cacheHeaders(loaderHeaders);
}

export const meta: Route.MetaFunction = ({ data }) => {
  if (!data || data.locked) {
    return [
      { title: "Coming soon - Teacher - Bachata Calendar" },
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

export default function TeacherRoute({ loaderData, params }: Route.ComponentProps) {
  const gate = (
    <ComingSoonGate enabled={flags.teacherDetail} title="Teacher" section="teacher_detail">
      <InitialVisiblePageTransition key={params.id}>
        <TeacherProfile />
      </InitialVisiblePageTransition>
    </ComingSoonGate>
  );
  // When locked there's no dehydrated state; render the gate directly.
  return loaderData?.locked ? (
    gate
  ) : (
    <HydrationBoundary state={loaderData.dehydratedState}>{gate}</HydrationBoundary>
  );
}
