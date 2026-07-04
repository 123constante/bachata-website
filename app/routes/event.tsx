import { useEffect, useState, type ReactNode } from "react";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { createQueryClient } from "@/App";
import { supabase } from "@/integrations/supabase/client";
import { eventPageQueryKey, parseEventPageSnapshot } from "@/modules/event-page/useEventPageQuery";
import type { EventPageSnapshot } from "@/modules/event-page/types";
import { PageTransition } from "@/components/PageTransition";
import EventPage from "@/pages/EventPage";
import type { Route } from "./+types/event";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// SPIKE — the /event/:id server loader. Folds the client-side slug→uuid resolve
// (useEntitySlugOrId) + snapshot fetch (useEventPageQuery) onto the server, then
// dehydrates the React Query cache so the client hydrates without refetching.
// Both queryFns MIRROR the hooks byte-for-byte (same keys, same parser) so the
// cache entries are identical. Phase 3 extracts these into a shared fetcher; the
// spike duplicates them to keep the change surface small.
export async function loader({ params, request }: Route.LoaderArgs) {
  const routeParam = params.id;
  const isUuid = UUID_RE.test(routeParam);
  const qc = createQueryClient();

  // 1. Resolve slug → uuid (mirrors useEntitySlugOrId, idColumn 'id').
  const resolved = await qc.fetchQuery({
    queryKey: ["entity-resolve", "events", "id", routeParam],
    queryFn: async () => {
      const whereCol = isUuid ? "id" : "slug";
      const { data: row, error } = await supabase
        .from("events")
        .select("id, slug")
        .eq(whereCol, routeParam)
        .maybeSingle();
      if (error || !row) return null;
      const r = row as Record<string, unknown>;
      return { id: (r.id as string | null) ?? null, slug: (r.slug as string | null) ?? null };
    },
    staleTime: 5 * 60 * 1000,
  });

  const eventId = resolved?.id ?? (isUuid ? routeParam : null);
  const slug = resolved?.slug ?? (isUuid ? null : routeParam);

  if (!eventId) {
    // Unresolvable param → 404. Phase 3 adds the noindex-404 HTML that
    // middleware.ts currently emits for bots; the spike proves the status path.
    throw new Response("Event not found", { status: 404 });
  }

  const url = new URL(request.url);
  const rawOcc = url.searchParams.get("occurrenceId");
  const occurrenceId = rawOcc && UUID_RE.test(rawOcc) ? rawOcc : null;

  // 2. Prefetch the snapshot (mirrors useEventPageQuery).
  await qc.prefetchQuery({
    queryKey: eventPageQueryKey(eventId, occurrenceId),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("event_view_p5" as never, {
        p_target: {
          series_id: eventId,
          ...(occurrenceId ? { occurrence_id: occurrenceId } : {}),
        },
        p_viewer: { role: "anon", shape: "snapshot_compat" },
      } as never);
      if (error) throw new Error((error as { message?: string }).message ?? JSON.stringify(error));
      return parseEventPageSnapshot(data);
    },
    staleTime: 1000 * 30,
  });

  const snap = qc.getQueryData(eventPageQueryKey(eventId, occurrenceId)) as EventPageSnapshot | null;

  return {
    dehydratedState: dehydrate(qc),
    title: snap?.event?.name ?? null,
    description: snap?.event?.description ?? null,
    slug,
  };
}

// Route-level SEO — replaces useSeo's document.head effect for this route type.
export const meta: Route.MetaFunction = ({ data }) => {
  const name = data?.title;
  if (!name) return [{ title: "Event — Bachata Calendar" }];
  const description =
    data?.description ?? "Bachata event details, line-up and tickets on Bachata Calendar.";
  return [
    { title: `${name} — Bachata Calendar` },
    { name: "description", content: description },
    { property: "og:type", content: "article" },
    { property: "og:title", content: name },
    { property: "og:description", content: description },
  ];
};

// D2 — SSR-visible entrance. PageTransition's motion.div serializes opacity:0 +
// translate/blur into SSR HTML (invisible until hydration). This wrapper renders
// the plain (visible) tree on the initial document load / hydration, and only
// plays the entrance fade on subsequent CLIENT navigations. `clientNavigated`
// is module-scoped so it survives the key-remount and is false at hydration
// (matches the SSR markup → no hydration mismatch).
let clientNavigated = false;
function InitialVisiblePageTransition({ children }: { children: ReactNode }) {
  const [animate] = useState(() => clientNavigated);
  useEffect(() => {
    clientNavigated = true;
  }, []);
  if (!animate) {
    return <div style={{ width: "100%", minHeight: "100vh" }}>{children}</div>;
  }
  return <PageTransition>{children}</PageTransition>;
}

export default function EventRoute({ loaderData, params }: Route.ComponentProps) {
  return (
    <HydrationBoundary state={loaderData.dehydratedState}>
      {/* key={params.id} reproduces today's full-remount on /event/a → /event/b
          (AnimatedRoutes keyed <Routes> on location.pathname) so param-only
          navigations reset per-event component state (e.g. BentoPage popovers). */}
      <InitialVisiblePageTransition key={params.id}>
        <EventPage />
      </InitialVisiblePageTransition>
    </HydrationBoundary>
  );
}
