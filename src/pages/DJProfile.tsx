import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useLocation, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft, Share2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs, renderBreadcrumbListJsonLd } from '@/lib/breadcrumbs';
import { useEntitySlugOrId, useCanonicalReplaceState, SITE_ORIGIN } from '@/lib/seo';
import { useEmbeddedProfile } from '@/lib/embeddedProfile';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { londonTodayKey } from '@/lib/londonDate';
import { resolvePublicName } from '@/lib/publicName';
import { AlsoRoles } from '@/modules/person-page/AlsoRoles';
import { flags } from '@/lib/featureFlags';
import { DjRolePage } from '@/components/dj/DjRolePage';
import { djRoleFields } from '@/components/dj/djRoleModel';
import { HUB, WALL, WALL_FADE } from '@/modules/person-page/wall/tokens';
import { SHARE_MESSAGES, shareDancerPage, type ShareOutcome } from '@/modules/dancer-app/public-page/model';
import { splitInstagramWebsite } from '@/components/dj/djContacts';
import { djInkTheme, useDjPageFonts } from '@/components/dj/djPageTheme';
import {
  DjHero,
  DjContactPanel,
  DjListen,
  DjGenresEq,
  DjUpcoming,
  DjPlayedAt,
  DjGallery,
  DjTextCard,
  DjGuestbookStub,
  type DjGig,
} from '@/components/dj/DjTiles';
import { PersonFrame } from '@/modules/person-page/frame';
import { DjWorld, djWorldView } from '@/modules/person-page/worlds/dj';
import { WORLD } from '@/modules/person-page/worlds/tokens';
import { usePersonSnapshot } from '@/modules/person-page/usePersonRoles';

type DJRow = {
  id: string;
  display_name: string | null;
  dj_name: string | null;
  first_name: string | null;
  surname: string | null;
  photo_url: string | string[] | null;
  cover_url: string | null;
  bio: string | null;
  genres: string[] | null;
  nationality: string | null;
  nationality_code?: string | null;
  city_id: string | null;
  city_name: string | null;
  city_slug: string | null;
  person_entity_id: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  soundcloud: string | null;
  mixcloud: string | null;
  pricing: string | null;
  // Prod 2026-10-22: faq is `[]` for 21 of 40 DJs, not a string. The W2-C page reads every field through
  // djRoleFields; this type stays as today's page reads it.
  faq: string | null;
  gallery_urls: string[] | null;
  languages: string[] | null;
  achievements: string[] | null;
  // Not currently surfaced by get_public_dj_v1; optional so the contact panel
  // lights up automatically once the RPC exposes phone (queued follow-up).
  phone?: string | null;
  upcoming_events: unknown;
};

const firstPhoto = (raw: string | string[] | null): string | null => {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.find(Boolean) ?? null;
  return raw.trim() || null;
};

const dateKey = (iso: string | null): string | null => {
  if (!iso) return null;
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(iso);
  return m ? m[1] : null;
};

const GOLD = '#E7BE6E';

const DjShare = ({ title, path }: { title: string; path: string }) => {
  const [outcome, setOutcome] = useState<ShareOutcome | null>(null);
  const url = typeof window === 'undefined' ? path : `${window.location.origin}${path}`;
  const onShare = async () => {
    const nav = typeof navigator === 'undefined' ? undefined : navigator;
    setOutcome(await shareDancerPage(
      {
        share: nav?.share ? (d) => nav.share(d) : undefined,
        writeText: nav?.clipboard?.writeText ? (t) => nav.clipboard.writeText(t) : undefined,
      },
      title,
      url,
    ));
  };
  const message = outcome ? SHARE_MESSAGES[outcome] : null;
  return (
    <div className="flex flex-col items-end gap-1">
      <div className="flex items-center gap-2">
        {message ? <span role="status" aria-live="polite" className="text-[13px]" style={{ color: GOLD }}>{message}</span> : null}
        <button type="button" onClick={() => void onShare()} className="inline-flex items-center gap-2 px-2 text-[15px] font-bold" style={{ minHeight: 44, color: GOLD }} data-testid="dj-share">
          <Share2 className="h-4 w-4" aria-hidden /> Share
        </button>
      </div>
      {/* 'manual' = no share sheet, no clipboard: the copy above points at this link. */}
      {outcome === 'manual' ? (
        <input
          readOnly
          value={url}
          aria-label="Link to this page"
          onFocus={(e) => e.currentTarget.select()}
          className="w-[260px] max-w-full rounded-[10px] px-2 text-[14px]"
          style={{ minHeight: 44, background: 'rgba(246,241,234,0.06)', color: 'var(--dj-cream)' }}
          data-testid="dj-share-link"
        />
      ) : null}
    </div>
  );
};

const DJProfile = () => {
  useDjPageFonts();
  const { id: routeParam } = useParams<{ id: string }>();
  const resolved = useEntitySlugOrId(routeParam, 'dancer_profiles');
  const id = resolved.id ?? undefined;
  useCanonicalReplaceState({
    arrivedViaUuid: resolved.arrivedViaUuid,
    slug: resolved.slug,
    buildPath: (s) => `/djs/${s}`,
  });
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const embedded = useEmbeddedProfile();
  // People arc S3: the DJ world on the shared frame (flags.personWorlds), never inside a /people/:id tab.
  const worlds = flags.personWorlds && !embedded;
  const person = usePersonSnapshot(worlds ? id : undefined);

  const { data: dj, isLoading, error } = useQuery({
    queryKey: ['dj-profile', id],
    queryFn: async () => {
      if (!id) throw new Error('DJ ID is required');
      const { data, error } = await supabase.rpc('get_public_dj_v1', { p_dj_id: id });
      if (error) throw error;
      if (!data) throw new Error('DJ not found');
      return data as unknown as DJRow;
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // The event-timeline query is NOT dehydrated by the SSR loader (loader only
  // prefetches get_public_dj_v1). Firing it during hydration produces a setState
  // mid-hydration (React #422 -> #418). Gate it on `mounted` so the server and
  // first client render are identical, then it fetches client-side.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const { data: appearances, isFetched: appearancesFetched, isError: appearancesFailed, refetch: refetchAppearances } = useProfileProgramAppearances('dj', mounted ? id : undefined, 1000);

  // `dj.display_name` is NOT trustworthy as a name: get_public_dj_v1 builds it
  // as COALESCE(dj_name, first+surname, dp.id::text), so for a profile whose
  // name lives only in dancer_profiles.display_name the RPC hands back the row's
  // UUID -- which then rendered as this page's <h1> and <title> in production.
  // resolvePublicName rejects an id-shaped candidate; the RPC's own COALESCE is
  // fixed separately (admin repo migration), and this guard stands regardless so
  // the id can never reach the page again.
  const resolvedName = dj ? resolvePublicName(dj) : null;
  const displayName = resolvedName ?? 'DJ';

  // No useSeo() here: DJProfile renders only under app/routes/djs.tsx, which wraps
  // in InitialVisiblePageTransition and so sets RouteOwnsHeadContext -- useSeo
  // returns before touching the head. That route's loader + meta() own it, and run
  // resolvePublicName over the same row, so the UUID-as-name guard above holds on
  // the served HTML too. Which useSeo calls are inert and which are live is a
  // census, not a rule of thumb -- see BentoPage.tsx (arc W22).

  const djBreadcrumbs = buildBreadcrumbs('dj.detail', {
    entityName: resolvedName ?? undefined,
    isLoading,
  });

  // Split the timeline into future (upcoming) and past (played-at) buckets.
  const { upcoming, past, isLive } = useMemo(() => {
    const today = londonTodayKey();
    const items = (appearances ?? []).filter((a) => a.event_id);
    const up: DjGig[] = [];
    const pastGigs: DjGig[] = [];
    let live = false;
    for (const a of items) {
      const gig: DjGig = {
        eventId: a.event_id,
        name: a.event_name,
        startTime: a.event_start_time,
        location: a.event_location,
      };
      const k = dateKey(a.event_start_time);
      if (k && k >= today) {
        up.push(gig);
        if (k === today) live = true;
      } else {
        pastGigs.push(gig);
      }
    }
    // upcoming: soonest first; past: most recent first (timeline is already desc)
    up.sort((x, y) => (x.startTime ?? '').localeCompare(y.startTime ?? ''));
    return { upcoming: up, past: pastGigs, isLive: live };
  }, [appearances]);

  if (isLoading && worlds) {
    // The DJ ground and the frame's boxes, so the page arrives without a jump.
    return (
      <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" showSubheader={false} gradientPalette="dj">
        {/* No own ground: the 'dj' page ground runs under the world and below it (no seam above the footer). */}
        <div className="px-3 pb-6 pt-2" data-testid="dj-world-loading">
          <div className="mx-auto w-full max-w-xl space-y-3">
            <Skeleton className="h-11 w-full rounded-[12px]" style={{ background: WORLD.dj.section.background }} />
            <Skeleton className="h-80 w-full rounded-[22px]" style={{ background: WORLD.dj.section.background }} />
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (isLoading && flags.personHub && !embedded) {
    // W2-C: the placeholder paints the warm ground the page arrives on (no dark-to-warm flash).
    return (
      <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" showSubheader={false} gradientPalette="wall">
        <div style={{ ...WALL_FADE, minHeight: HUB.groundMinHeight }} className="px-3 pt-2">
          <div className="mx-auto w-full max-w-xl space-y-3">
            <Skeleton className="h-11 w-48 rounded-[12px]" style={{ background: WALL.card }} />
            <Skeleton className="h-72 w-full rounded-[24px]" style={{ background: WALL.card }} />
            <Skeleton className="h-40 w-full rounded-[14px]" style={{ background: WALL.card }} />
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (isLoading) {
    return (
      <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" gradientPalette="dj">
        <div style={{ ...(djInkTheme as React.CSSProperties), background: 'var(--dj-bg)', fontFamily: 'var(--dj-body)' }} className="min-h-screen pb-24">
          <div className="mx-auto w-full max-w-6xl space-y-4 px-3 pt-4 sm:px-5 md:px-8">
            <Skeleton className="h-52 w-full rounded-[22px]" style={{ background: 'rgba(246,241,234,0.06)' }} />
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <Skeleton className="h-40 rounded-[22px]" style={{ background: 'rgba(246,241,234,0.06)' }} />
              <Skeleton className="h-40 rounded-[22px]" style={{ background: 'rgba(246,241,234,0.06)' }} />
            </div>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (error || !dj) {
    return (
      <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" gradientPalette="dj">
        <div style={{ ...(djInkTheme as React.CSSProperties), background: 'var(--dj-bg)', color: 'var(--dj-cream)' }} className="flex min-h-[60vh] items-center justify-center px-4">
          <div className="text-center">
            <p className="mb-6" style={{ color: 'rgba(246,241,234,0.6)' }}>This DJ profile doesn&rsquo;t exist or has been removed.</p>
            <Button onClick={() => navigate('/djs')} variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to DJs
            </Button>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // showSubheader={false} drops PageBreadcrumb, which is what normally emits the
  // BreadcrumbList JSON-LD, so emit it here (same canonical origin). Embedded as a
  // /people/:id tab, the person page owns the head and the breadcrumbs.
  const sharePath = resolved.slug ? `/djs/${resolved.slug}` : `/djs/${routeParam ?? dj.id}`;
  const breadcrumbJsonLd = embedded
    ? null
    : renderBreadcrumbListJsonLd({ crumbs: djBreadcrumbs, origin: SITE_ORIGIN, currentUrl: SITE_ORIGIN + sharePath });

  // People arc S3 (flags.personWorlds ON): PersonFrame (Back, Share, role tabs) and the DJ world.
  // Flag OFF, and in a /people/:id tab, everything below is unchanged.
  if (worlds) {
    const f = djRoleFields(dj as unknown as Record<string, unknown>);
    const view = djWorldView({
      row: dj,
      cityName: f.cityName,
      nationalityCode: f.nationalityCode,
      links: f.links,
      upcoming,
      past,
      roles: person.snapshot?.roles ?? [],
      rolesAnswered: person.answered,
      pathname,
    });
    return (
      <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" showSubheader={false} gradientPalette="dj">
        {breadcrumbJsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
        ) : null}
        <div className="px-3 pb-6 pt-2" style={{ color: WORLD.dj.ink }}>
          <div className="mx-auto w-full max-w-xl">
            <PersonFrame
              backHref="/djs"
              shareTitle={`${view.big} on Bachata Calendar`}
              roles={person.snapshot?.roles ?? []}
              current="dj"
              slug={resolved.slug}
              rolesPending={!person.answered}
            >
              <DjWorld
                view={view}
                photo={f.photoUrl}
                bio={f.bio}
                dates={appearancesFailed ? 'failed' : appearancesFetched ? 'ready' : 'loading'}
                onRetry={() => void refetchAppearances()}
              />
            </PersonFrame>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // W2-C (flags.personHub ON): the D-C page on the hub's warm ground, with the Back row + role
  // switcher. Flag OFF, and in a /people/:id tab, the page below is unchanged.
  if (flags.personHub && !embedded) {
    // Every field through ONE boundary (djRoleFields): the RPC hands back arrays where the type says
    // string (faq), so this page never reads `dj.*` text raw. It sits above today's reads, which assume strings.
    const f = djRoleFields(dj as unknown as Record<string, unknown>);
    // The warm `wall` ground under the page too: its bottom fade otherwise lands on the site's graphite
    // default (measured: rgb(30,20,16) -> rgb(14,18,21) below Share, docs/design/w2c-build.md).
    return (
      <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" showSubheader={false} gradientPalette="wall">
        {breadcrumbJsonLd ? (
          <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
        ) : null}
        <DjRolePage
          id={id}
          slug={resolved.slug}
          name={displayName}
          photoUrl={f.photoUrl}
          nationalityCode={f.nationalityCode}
          cityName={f.cityName}
          bio={f.bio}
          isLive={isLive}
          upcoming={upcoming}
          datesLoading={!appearancesFetched}
          datesFailed={appearancesFailed}
          gallery={f.gallery}
          links={f.links}
          faq={f.faq}
          pricing={f.pricing}
          share={<DjShare title={`${displayName} on Bachata Calendar`} path={sharePath} />}
        />
      </GlobalLayout>
    );
  }

  const genres = Array.isArray(dj.genres) ? dj.genres.filter(Boolean) : [];
  const gallery = Array.isArray(dj.gallery_urls) ? dj.gallery_urls.filter(Boolean) : [];
  const photoUrl = firstPhoto(dj.photo_url);
  const totalGigs = (appearances ?? []).filter((a) => a.event_id).length;

  const { instagram: igLink, website: webLink } = splitInstagramWebsite(dj.instagram, dj.website);
  const hasContact = !!(igLink || webLink || dj.soundcloud || dj.mixcloud || dj.facebook || dj.phone);
  const hasListen = !!(dj.soundcloud || dj.mixcloud);

  return (
    <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" showSubheader={false} gradientPalette="dj">
      {breadcrumbJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: breadcrumbJsonLd }} />
      ) : null}
      <div
        className="min-h-screen pb-24"
        style={{ ...(djInkTheme as React.CSSProperties), background: 'var(--dj-bg)', color: 'var(--dj-cream)', fontFamily: 'var(--dj-body)' }}
      >
        <div className="mx-auto w-full max-w-6xl px-3 pt-3 sm:px-5 md:px-8">
          <div className="flex items-center justify-between" style={{ minHeight: 44 }} data-testid="dj-head">
            <Link to="/djs" className="inline-flex items-center gap-2 px-1 text-[15px] font-bold" style={{ minHeight: 44, color: GOLD }} data-testid="dj-back">
              <ArrowLeft className="h-4 w-4" aria-hidden /> Back
            </Link>
            <DjShare title={`${displayName} on Bachata Calendar`} path={sharePath} />
          </div>
          <AlsoRoles current="dj" id={id} slug={resolved.slug} className="pt-1" />
        </div>
        <div className="dj-bento mx-auto w-full max-w-6xl px-3 pt-4 sm:px-5 md:px-8 md:pt-6">
          <section className="dj-hero">
            <DjHero
              name={displayName}
              photoUrl={photoUrl}
              cityName={dj.city_name}
              nationality={dj.nationality}
              nationalityCode={dj.nationality_code}
              bio={dj.bio}
              isLive={isLive}
              stats={{ gigs: totalGigs || null, upcoming: upcoming.length || null, genres: genres.length || null }}
            />
          </section>

          {hasContact ? (
            <section className="dj-contact">
              <DjContactPanel
                name={displayName}
                instagram={igLink}
                website={webLink}
                soundcloud={dj.soundcloud}
                mixcloud={dj.mixcloud}
                facebook={dj.facebook}
                phone={dj.phone}
              />
            </section>
          ) : null}

          {hasListen ? (
            <section className="dj-listen">
              <DjListen soundcloud={dj.soundcloud} mixcloud={dj.mixcloud} />
            </section>
          ) : null}

          {genres.length > 0 ? (
            <section className="dj-genres">
              <DjGenresEq genres={genres} />
            </section>
          ) : null}

          {upcoming.length > 0 ? (
            <section className="dj-upcoming">
              <DjUpcoming gigs={upcoming} />
            </section>
          ) : null}

          {past.length > 0 ? (
            <section className="dj-playedat">
              <DjPlayedAt gigs={past} totalCount={past.length} />
            </section>
          ) : null}

          {gallery.length > 0 ? (
            <section className="dj-gallery">
              <DjGallery urls={gallery} name={displayName} />
            </section>
          ) : null}

          {dj.faq ? (
            <section className="dj-text">
              <DjTextCard title="FAQ" body={dj.faq} />
            </section>
          ) : null}

          {dj.pricing ? (
            <section className="dj-text">
              <DjTextCard title="Pricing" body={dj.pricing} />
            </section>
          ) : null}

          <section className="dj-guestbook">
            <DjGuestbookStub />
          </section>
        </div>

        <style>{`
          .dj-bento { display: grid; grid-template-columns: 1fr; gap: 16px; }
          @media (min-width: 1024px) {
            .dj-bento { grid-template-columns: repeat(12, minmax(0, 1fr)); align-items: start; grid-auto-flow: row dense; }
            .dj-hero      { grid-column: span 8; }
            .dj-contact   { grid-column: span 4; }
            .dj-listen    { grid-column: span 8; }
            .dj-genres    { grid-column: span 4; }
            .dj-upcoming  { grid-column: span 8; }
            .dj-playedat  { grid-column: span 4; }
            .dj-gallery   { grid-column: span 8; }
            .dj-text      { grid-column: span 4; }
            .dj-guestbook { grid-column: span 12; }
          }
          @keyframes dj-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
          @keyframes dj-float { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-7px); } }
          @keyframes dj-pulse { 0%,100% { opacity: 0.45; } 50% { opacity: 1; } }
          @keyframes dj-eqbar { 0%,100% { transform: scaleY(0.9); } 50% { transform: scaleY(1.06); } }
          @media (prefers-reduced-motion: reduce) {
            .dj-bento *, .dj-bento *::before, .dj-bento *::after { animation: none !important; }
          }
        `}</style>
      </div>
    </GlobalLayout>
  );
};

export default DJProfile;
