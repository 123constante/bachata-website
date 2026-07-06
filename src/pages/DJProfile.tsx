import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo, buildSeoForRoute, useEntitySlugOrId, useCanonicalReplaceState } from '@/lib/seo';
import { useProfileProgramAppearances } from '@/hooks/useProfileProgramAppearances';
import { londonTodayKey } from '@/lib/londonDate';
import { buildFullName } from '@/lib/name-utils';
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
  const { data: appearances } = useProfileProgramAppearances('dj', mounted ? id : undefined, 1000);

  const displayName = dj
    ? (dj.display_name || dj.dj_name || buildFullName(dj.first_name, dj.surname) || 'DJ')
    : 'DJ';

  const _djSeo = buildSeoForRoute('dj.detail', {
    entityName: dj?.display_name ?? dj?.dj_name ?? undefined,
    entitySlug: resolved.slug ?? id ?? undefined,
    ogImage: firstPhoto(dj?.photo_url ?? null) ?? undefined,
    isLoading,
  });
  useSeo(_djSeo);

  const djBreadcrumbs = buildBreadcrumbs('dj.detail', {
    entityName: dj?.display_name ?? dj?.dj_name ?? undefined,
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

  if (isLoading) {
    return (
      <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" showGradientBg={false}>
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
      <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" showGradientBg={false}>
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

  const genres = Array.isArray(dj.genres) ? dj.genres.filter(Boolean) : [];
  const gallery = Array.isArray(dj.gallery_urls) ? dj.gallery_urls.filter(Boolean) : [];
  const photoUrl = firstPhoto(dj.photo_url);
  const totalGigs = (appearances ?? []).filter((a) => a.event_id).length;

  const hasContact = !!(dj.instagram || dj.website || dj.soundcloud || dj.mixcloud || dj.facebook || dj.phone);
  const hasListen = !!(dj.soundcloud || dj.mixcloud);

  return (
    <GlobalLayout breadcrumbs={djBreadcrumbs} backHref="/djs" showGradientBg={false}>
      <div
        className="min-h-screen pb-24"
        style={{ ...(djInkTheme as React.CSSProperties), background: 'var(--dj-bg)', color: 'var(--dj-cream)', fontFamily: 'var(--dj-body)' }}
      >
        <div className="dj-bento mx-auto w-full max-w-6xl px-3 pt-4 sm:px-5 md:px-8 md:pt-6">
          <section className="dj-hero">
            <DjHero
              name={displayName}
              photoUrl={photoUrl}
              cityName={dj.city_name}
              nationality={dj.nationality}
              bio={dj.bio}
              isLive={isLive}
              stats={{ gigs: totalGigs || null, upcoming: upcoming.length || null, genres: genres.length || null }}
            />
          </section>

          {hasContact ? (
            <section className="dj-contact">
              <DjContactPanel
                name={displayName}
                instagram={dj.instagram}
                website={dj.website}
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
