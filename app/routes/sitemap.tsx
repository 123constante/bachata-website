import { supabase } from "@/integrations/supabase/client";
import { flags } from "@/lib/featureFlags";
import { edgeCacheControl } from "../detailLoader";
import { resolvePublicName, type PublicNameSource } from "@/lib/publicName";
import { NOT_DEACTIVATED } from "@/lib/notDeactivatedFilter";

// Live /sitemap.xml resource route (loader-only, no component) - replaces the
// dead build-time scripts/generate-sitemap.mjs, which `react-router build`
// never ran (only the unused build:no-prerender script did), so the committed
// public/sitemap.xml went stale the day the RR7 migration landed. Serving it
// from a loader keeps it fresh on every edge-cache expiry (1h TTL below vs the
// 24h cron-coupled redeploy), and a Supabase blip now 500s (Google keeps its
// previous copy and retries) instead of shipping a silently empty sitemap the
// way the old generator's swallow-to-[] fetchers did.
//
// Pattern: app/routes/api.ics.calendar.tsx (Response + explicit headers).

const BASE_URL = "https://www.bachatacalendar.co.uk";

// Generated DB types lag the live schema (events.slug etc. - same pre-existing
// cast issue as app/routes/event.tsx's entity-resolve), so the fetchers below
// go through an untyped handle and shape their own rows.
//
// The query-builder methods called below are MIRRORED in the mock in
// tests/sitemapEdgeTtl.test.ts (its ALLOWED set). Adding one here without
// adding it there makes that spec throw; it will name the method for you.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

type StaticRoute = { path: string; changefreq: string; priority: string };

const STATIC_ROUTES: StaticRoute[] = [
  { path: "/",                                 changefreq: "daily",   priority: "1.0" },
  { path: "/parties",                          changefreq: "daily",   priority: "0.9" },
  { path: "/classes",                          changefreq: "daily",   priority: "0.9" },
  { path: "/tonight",                          changefreq: "daily",   priority: "0.8" },
  { path: "/festivals",                        changefreq: "weekly",  priority: "0.8" },
  { path: "/venues",                           changefreq: "weekly",  priority: "0.7" },
  { path: "/djs",                              changefreq: "weekly",  priority: "0.6" },
  { path: "/dancers",                          changefreq: "weekly",  priority: "0.6" },
  { path: "/discounts",                        changefreq: "weekly",  priority: "0.5" },
  { path: "/practice-partners",                changefreq: "weekly",  priority: "0.5" },
  { path: "/choreography",                     changefreq: "weekly",  priority: "0.5" },
  { path: "/videographers",                    changefreq: "weekly",  priority: "0.5" },
  { path: "/cities",                           changefreq: "monthly", priority: "0.5" },
  { path: "/london-bachata-guide",             changefreq: "monthly", priority: "0.9" },
  { path: "/learn-bachata-london",             changefreq: "monthly", priority: "0.9" },
  { path: "/bachata-parties-london",           changefreq: "weekly",  priority: "0.8" },
  { path: "/bachata-london-sensual-parties",   changefreq: "weekly",  priority: "0.7" },
  { path: "/bachata-london-dominican-parties", changefreq: "weekly",  priority: "0.7" },
  { path: "/faq",                              changefreq: "monthly", priority: "0.8" },
  { path: "/bachata-london-monday",            changefreq: "weekly",  priority: "0.8" },
  { path: "/bachata-london-tuesday",           changefreq: "weekly",  priority: "0.8" },
  { path: "/bachata-london-wednesday",         changefreq: "weekly",  priority: "0.8" },
  { path: "/bachata-london-thursday",          changefreq: "weekly",  priority: "0.8" },
  { path: "/bachata-london-friday",            changefreq: "weekly",  priority: "0.9" },
  { path: "/bachata-london-saturday",          changefreq: "weekly",  priority: "0.9" },
  { path: "/bachata-london-sunday",            changefreq: "weekly",  priority: "0.8" },
];

function escapeXml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

type UrlRow = { loc: string; lastmod?: string | null; changefreq?: string; priority?: string };

function urlEntry({ loc, lastmod, changefreq, priority }: UrlRow): string {
  const parts = [`  <url>\n    <loc>${escapeXml(loc)}</loc>`];
  if (lastmod) parts.push(`    <lastmod>${lastmod}</lastmod>`);
  if (changefreq) parts.push(`    <changefreq>${changefreq}</changefreq>`);
  if (priority) parts.push(`    <priority>${priority}</priority>`);
  parts.push("  </url>");
  return parts.join("\n");
}

function toDate(ts: string | null | undefined): string | null {
  if (!ts) return null;
  return new Date(ts).toISOString().split("T")[0];
}

type ProfileRow = { id: string; slug: string | null; updated_at: string | null };

// Every fetcher THROWS on error - a failed source must 500 the whole sitemap,
// never silently drop a section (Search Console reads a shrunken sitemap as
// "those URLs are gone").

// events: lifecycle_status = 'published', up to 2000 most recently updated.
async function fetchEvents(): Promise<UrlRow[]> {
  const { data, error } = await db
    .from("events")
    .select("id, slug, updated_at")
    .eq("lifecycle_status", "published")
    .order("updated_at", { ascending: false })
    .limit(2000);
  if (error) throw error;
  return ((data ?? []) as ProfileRow[]).map((e) => ({
    loc: `${BASE_URL}/event/${e.slug || e.id}`,
    lastmod: toDate(e.updated_at),
    changefreq: "daily",
    priority: "0.8",
  }));
}

// venues: any non-draft venue (matches public.venue_is_public()).
async function fetchVenues(): Promise<UrlRow[]> {
  const { data, error } = await db
    .from("venues")
    .select("id, slug, created_at")
    .neq("publish_state", "draft")
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as Array<{ id: string; slug: string | null; created_at: string | null }>).map(
    (v) => ({
      loc: `${BASE_URL}/venue-entity/${v.slug || v.id}`,
      lastmod: toDate(v.created_at),
      changefreq: "weekly",
      priority: "0.7",
    }),
  );
}

// dancer_profiles: feed /dancers/:id (public) and /teachers/:id (flag-gated).
//
// The name columns are selected so a profile with NO resolvable name can be left
// out. Those pages are not broken -- they render, and they deliberately emit
// noindex (app/routes/dancers.tsx, via resolvePublicName) -- but a sitemap is a
// request to index, so submitting one is a straight contradiction that Google
// reports as "Submitted URL marked noindex". 2 of 138 rows today.
//
// Must match app/routes/dancers.tsx's own visibility gate exactly (added
// alongside this filter) -- same reasoning as the organiser fetch below: a
// mismatch either submits a URL the route 404s, or silently drops one it still
// serves. 0 rows are is_active = false today, so this is a latent mismatch
// being closed, not a live one being repaired.
// Returns the name columns too, not a bare ProfileRow: /teachers URLs are derived
// from these same rows but resolve their name from a NARROWER basis (below), and
// that comparison needs the fields to survive the return type.
async function fetchDancerProfiles(): Promise<Array<ProfileRow & PublicNameSource>> {
  const { data, error } = await db
    .from("dancer_profiles")
    .select("id, slug, updated_at, display_name, first_name, surname")
    .not(...NOT_DEACTIVATED)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as Array<ProfileRow & PublicNameSource>).filter(
    (d) => resolvePublicName(d) !== null,
  );
}

// teacher_profiles: which dancer_profiles ids also have a teacher role.
async function fetchTeacherProfileIds(): Promise<Set<string>> {
  const { data, error } = await db.from("teacher_profiles").select("id").limit(500);
  if (error) throw error;
  return new Set(((data ?? []) as Array<{ id: string }>).map((t) => t.id));
}

// organiser_profiles: /organisers/:id pages.
async function fetchOrganiserProfiles(): Promise<UrlRow[]> {
  const { data, error } = await db
    .from("organiser_profiles")
    .select("id, slug, updated_at, name")
    // Must match app/routes/organiser.tsx's own visibility gate exactly. That
    // loader 404s a row this filter would otherwise submit, which Google reports
    // as "Submitted URL not found (404)". 0 rows are is_active = false today, so
    // this is a latent mismatch being closed, not a live one being repaired.
    .not(...NOT_DEACTIVATED)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return ((data ?? []) as Array<ProfileRow & PublicNameSource>)
    .filter((o) => resolvePublicName(o) !== null)
    .map((o) => ({
    loc: `${BASE_URL}/organisers/${o.slug || o.id}`,
    lastmod: toDate(o.updated_at),
    changefreq: "weekly",
    priority: "0.7",
  }));
}

export async function loader() {
  let xml: string;
  try {
    const today = new Date().toISOString().split("T")[0];

    const staticRoutes = [...STATIC_ROUTES];
    // Feature-gated directory listings render noindex while off - keep them out
    // of the sitemap until the flag flips, else GSC logs "submitted URL marked
    // noindex". Same source of truth as the app (src/lib/featureFlags.ts).
    if (flags.teachersDirectory) staticRoutes.push({ path: "/teachers", changefreq: "weekly", priority: "0.7" });
    if (flags.organisersDirectory) staticRoutes.push({ path: "/organisers", changefreq: "weekly", priority: "0.7" });

    const [events, venueUrls, dancerRows, organiserUrls, teacherIds] = await Promise.all([
      fetchEvents(),
      flags.venueDetail ? fetchVenues() : Promise.resolve([] as UrlRow[]),
      fetchDancerProfiles(),
      flags.organiserDetail ? fetchOrganiserProfiles() : Promise.resolve([] as UrlRow[]),
      flags.teacherDetail ? fetchTeacherProfileIds() : Promise.resolve(new Set<string>()),
    ]);

    const dancerUrls: UrlRow[] = dancerRows.map((d) => ({
      loc: `${BASE_URL}/dancers/${d.slug || d.id}`,
      lastmod: toDate(d.updated_at),
      changefreq: "weekly",
      priority: "0.6",
    }));
    // The name filter is NARROWER here than for /dancers, and deliberately so.
    // fetchDancerProfiles keeps a row whose only name is display_name, which is
    // right for /dancers/:id -- its loader selects display_name and renders it.
    // app/routes/teachers.tsx cannot: it names the page from
    // get_public_teacher_detail_v1, whose result set has no display_name column
    // (first_name/surname only), so resolvePublicName returns null there and
    // buildSeoForRoute noindexes the page. Submitting such a URL would be the
    // inverse of this branch's bug -- a sitemap entry Google reports as
    // "Submitted URL marked noindex" -- so the sitemap must resolve the teacher
    // name on the SAME basis the teacher route has available.
    //
    // Zero impact today: teacher_profiles has 0 rows (measured 2026-09-02), so
    // teacherIds is empty and no /teachers URL is emitted at all; the flag is off
    // in prod besides. This closes the trap before teachers are seeded, rather
    // than after. If the RPC ever returns display_name, widen this back to plain
    // resolvePublicName(d) and delete this note.
    const teacherUrls: UrlRow[] = dancerRows
      .filter((d) => teacherIds.has(d.id))
      .filter((d) => resolvePublicName({ first_name: d.first_name, surname: d.surname }) !== null)
      .map((d) => ({
        loc: `${BASE_URL}/teachers/${d.slug || d.id}`,
        lastmod: toDate(d.updated_at),
        changefreq: "weekly",
        priority: "0.6",
      }));

    xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...staticRoutes.map((r) =>
        urlEntry({ loc: `${BASE_URL}${r.path}`, lastmod: today, changefreq: r.changefreq, priority: r.priority }),
      ),
      ...[...events, ...venueUrls, ...dancerUrls, ...teacherUrls, ...organiserUrls].map(urlEntry),
      "</urlset>",
    ].join("\n");
  } catch (error) {
    // Log the CAUSE before discarding it. Five fetchers feed this try block, and
    // a bare rethrow tells neither the server log nor Sentry which one failed --
    // so a live /sitemap.xml 500 leaves no record at all, and in tests the
    // failure is an opaque `Response { status: 500 }`.
    console.error("[sitemap] generation failed", error);
    throw new Response("sitemap generation failed", { status: 500 });
  }

  return new Response(xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml",
      // 1h edge TTL; a DB blip inside the window serves the stale copy for up
      // to a day instead of erroring the crawler. Routed through
      // edgeCacheControl() rather than restating its default literal, so a
      // future retune of EDGE_S_MAXAGE/EDGE_SWR cannot leave this route behind
      // silently.
      "Vercel-CDN-Cache-Control": edgeCacheControl(),
    },
  });
}
