import React from 'react';
import { heroBio } from '@/modules/profile/organiserHeroBio';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Suspense, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { lazyWithRetry } from '@/lib/lazyWithRetry';
import { cn } from '@/lib/utils';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { flags } from '@/lib/featureFlags';
import { ManagedBadge, PublicClaimCard } from '@/modules/organiser/shared/components/PublicClaimCard';
import { ownershipFacts } from '@/modules/organiser/shared/ownership';
import type { EipBridge } from '@/modules/organiser/edit-in-place/bridge';
import { extractDomain, extractIgHandle } from '@/lib/organiserLinkLabels';
import {
  NO_PUBLIC_CONTACT,
  fetchOrganiserOwnership,
  fetchPublicContactOrThrow,
  organiserOwnershipQueryKey,
  organiserPublicContactQueryKey,
} from '@/modules/organiser/shared/ownershipApi';
import { fetchClaimHint, myAccessRequestsQueryKey, organiserClaimHintQueryKey, organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { isMailboxProvenToken } from '@/modules/organiser/shared/sessionProof';
import { useIsMobile } from '@/hooks/use-mobile';
import { ChevronLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useEntitySlugOrId, useCanonicalReplaceState } from '@/lib/seo';
import {
  buildMailtoHref,
  buildWhatsAppHref,
} from '@/lib/contactValidation';
import {
  hostMatchesDomain,
  withNormalizedProtocol,
} from '@/lib/organiserProfileUpdate';
import { londonDayRangeUtc } from '@/lib/londonDate';
import {
  type WallClock,
  asWallClockOrNull,
  formatWallClockLocal,
  formatWallClockLocalIntl,
  wallClockExactDateKey,
} from '@/lib/time/wallClock';
import { useLondonToday } from '@/hooks/useLondonToday';
import { NO_DATES_ANNOUNCED, organiserEmptyState } from '@/modules/profile/organiserEmptyState';
import { organiserStatsByFeed } from '@/modules/profile/organiserStatsByFeed';
import { RetryButton } from '@/modules/profile/RetryButton';
import { useStickyFailure } from '@/modules/profile/useStickyFailure';
import { pickNationalityCode } from '@/components/people/nationality';
import { usePeopleBadges } from '@/modules/person-page/badges';
import { teamFromPublicRows } from '@/modules/profile/organiserTeam';
import { fetchOrganiserPublicTeam, organiserPublicTeamKey } from '@/modules/organiser/team/publicTeamApi';
import { OrganiserStatsStrip } from '@/modules/profile/OrganiserStatsStrip';
import { OrganiserGetInTouch, buildContactRows } from '@/modules/profile/OrganiserGetInTouch';
import { OrganiserTeamSection } from '@/modules/profile/OrganiserTeamSection';
import { optimizedImageUrl, cssUrl, srcWidthFor } from '@/lib/imageCdn';
import { useListImpressions } from '@/lib/listImpressions';
import { type EventRowProps } from '@/components/events/EventRow';
import NightsCard from '@/modules/profile/NightsCard';
import PastHighlights from '@/modules/profile/PastHighlights';
import { countdownChip, venueCityLine, seriesCityLabel, upcomingWording, cardMetaLine, actionLabel as nightsActionLabel, pastCounts, fallbackInitials } from '@/modules/profile/nightsCardModel';
import SeriesDatesSheet from '@/components/events/SeriesDatesSheet';
import { groupByEventId, stableRowKey } from '@/lib/eventListGrouping';
import { ReportProblemLink } from '@/lib/contactLinks';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import {
  type EventRow,
  type OrgOccRow,
  fetchOrganiserEntity,
  fetchOrganiserFullProfile,
  organiserFullProfileQueryKey,
  fetchOrganiserEvents,
  fetchOrganiserFutureOccEvents,
  fetchOrganiserPastOccEvents,
  organiserEntityQueryKey,
  organiserEventsQueryKey,
  organiserOccEventsQueryKey,
  organiserOccEventsPastQueryKey,
} from '@/modules/profile/organiserPublicProfile';

// --- Types ---

type OrgEvent = EventRow & { displayStart: WallClock | null; occurrenceId?: string | null; cityName?: string | null };

type UpcomingListItem =
  | { kind: 'single'; event: OrgEvent }
  | {
      kind: 'series';
      eventId: string;
      name: string;
      posterUrl: string | null;
      location: string | null;
      cityLabel: string | null;
      dates: OrgEvent[];
    };

const EMPTY_NATIONALITY: ReadonlyMap<string, string | null> = new Map();

type EntityProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  socials: Record<string, string | undefined> | null;
  city_id: string | null;
  instagram: string | null;
  facebook: string | null;
  website: string | null;
  organisation_category: string | null;
  founded_year: number | null;
  cities: { name: string; slug: string } | null;
};

// --- Design tokens ---

const D = {
  black:     '#0C0A0D',
  gold:      '#E7BE6E',
  orange:    '#FF6A2C',
  cream:     '#F6F1EA',
  lightGold: '#FBEFC4',
};
const SERIF = "'Cormorant Garamond', Georgia, serif";
const BODY  = "'Manrope', 'Inter Variable', system-ui, sans-serif";

const PAST_GRADS = [
  'linear-gradient(160deg,#311f2a,#100b13)',
  'linear-gradient(160deg,#2a2233,#100b13)',
  'linear-gradient(160deg,#33202b,#100b13)',
  'linear-gradient(160deg,#2b2132,#100b13)',
];

// HERO_BG is now computed per-organiser inside the component using useAverageColor.
// This placeholder is only used by the loading skeleton (before entity loads).
const HERO_BG_DEFAULT =
  'radial-gradient(circle at 24% 22%,rgba(255,140,60,0.42),transparent 38%),' +
  'radial-gradient(circle at 80% 30%,rgba(231,190,110,0.40),transparent 44%),' +
  'radial-gradient(circle at 62% 88%,rgba(255,106,44,0.30),transparent 52%),' +
  'linear-gradient(155deg,#2a1622,#0c0a0d 72%)';

const heroBg = (r: number, g: number, b: number) =>
  `radial-gradient(circle at 24% 22%,rgba(${r},${g},${b},0.52),transparent 38%),` +
  `radial-gradient(circle at 80% 30%,rgba(231,190,110,0.40),transparent 44%),` +
  `radial-gradient(circle at 62% 88%,rgba(${r},${g},${b},0.32),transparent 52%),` +
  `linear-gradient(155deg,#2a1622,#0c0a0d 72%)`;

// Relative bar heights for the hero's sound-floor motif -- a nod to the DJ set
// or live band every bachata night runs on, not a decorative flourish.
const HERO_EQ_HEIGHTS = [
  0.35, 0.62, 0.9, 0.5, 0.78, 0.42, 0.68, 0.95, 0.55, 0.3, 0.72, 0.48, 0.85,
  0.6, 0.38, 0.92, 0.5, 0.7, 0.44, 0.8, 0.58, 0.34, 0.88, 0.62, 0.46, 0.75,
  0.4, 0.66,
];

// Static -- hoisted so it isn't re-created as a new string on every render.
const HERO_EQ_STYLE = `
  @keyframes organiserHeroEq { 0%, 100% { transform: scaleY(0.55); } 50% { transform: scaleY(1); } }
  @media (prefers-reduced-motion: reduce) {
    .organiser-hero-eq-bar { animation: none !important; transform: scaleY(0.8) !important; }
  }
`;

// --- Helpers ---

const initials = (name: string | null | undefined): string => {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

// displayStart is a branded WallClock (stored local-as-UTC). These read it
// AS STORED via the wallClock formatters -- the old `new Date(raw).toLocale*`
// rendered the time an hour late in BST (the live "8:00pm" bug for a stored
// 19:00 on /organisers/cumbaye) and the date a day early west of UTC.
const dateParts = (wc: WallClock | null | undefined): { day: string; mon: string } => {
  const day = formatWallClockLocal(wc, 'dd');
  const mon = formatWallClockLocal(wc, 'MMM');
  if (!day || !mon) return { day: '--', mon: 'TBA' };
  return { day, mon: mon.toUpperCase() };
};

// Both operands below are plain YYYY-MM-DD date keys, diffed via Date.UTC --
// never `new Date(rawString)` on a datetime string, which is what caused the
// BST off-by-one bug the comment above documents.
const daysFromToday = (dateKey: string, todayKey: string): number => {
  const [ty, tm, td] = todayKey.split('-').map(Number);
  const [ey, em, ed] = dateKey.split('-').map(Number);
  const t = Date.UTC(ty, tm - 1, td);
  const e = Date.UTC(ey, em - 1, ed);
  return Math.round((e - t) / 86400000);
};

const countdownLabel = (wc: WallClock | null | undefined, todayKey: string): string => {
  const key = formatWallClockLocal(wc, 'yyyy-MM-dd');
  if (!key) return '';
  const diff = daysFromToday(key, todayKey);
  if (diff < 0) return 'Past';
  if (diff === 0) return 'Tonight';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7) return `in ${diff} days`;
  if (diff < 14) return 'next week';
  return `in ${Math.round(diff / 7)} weeks`;
};

const eventTime = (wc: WallClock | null | undefined): string | null => {
  // A date-only value (the instance_date fallback) carries no time; and suppress
  // an exact-midnight placeholder, as the old `!raw.includes('T')` / 00:00 gates did.
  if (!wc || wallClockExactDateKey(wc) || formatWallClockLocal(wc, 'HH:mm') === '00:00') {
    return null;
  }
  const s = formatWallClockLocalIntl(wc, { hour: 'numeric', minute: '2-digit', hour12: true });
  return s ? s.replace(/\s/g, '').toLowerCase() : null;
};


// extractIgHandle / extractFbHandle / extractDomain live in
// src/lib/organiserLinkLabels.ts, shared with the owner's edit-in-place rows.
// The save-time link validators went with the legacy Edit profile dialog
// (retireLegacyEditDialog): edit-in-place validates in fieldRules.ts.

// --- Sub-components ---

const AvatarCircle = ({
  avatarUrl,
  name,
  sizePx,
  fontSize,
}: {
  avatarUrl: string | null;
  name: string;
  sizePx: number;
  fontSize: number;
}) => (
  <div
    style={{
      width: sizePx,
      height: sizePx,
      borderRadius: '50%',
      padding: sizePx > 80 ? 4 : 3,
      background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)',
      boxShadow: '0 10px 30px rgba(255,106,44,0.35)',
      flexShrink: 0,
    }}
  >
    <div
      style={{
        width: '100%',
        height: '100%',
        borderRadius: '50%',
        background: 'radial-gradient(circle at 40% 35%,#3a2030,#140d16 75%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        border: '3px solid #0C0A0D',
      }}
    >
      {avatarUrl ? (
        <img src={optimizedImageUrl(avatarUrl, srcWidthFor(sizePx))} alt={name} width={sizePx} height={sizePx} style={{ width: '100%', height: '100%', objectFit: 'cover' }} loading="lazy" />
      ) : (
        <span style={{ fontFamily: SERIF, fontSize, color: 'rgba(251,239,196,0.85)' }}>{initials(name)}</span>
      )}
    </div>
  </div>
);

/** Shown only when organiser_full_profile_v1 is true. Deliberately not the word "Verified". */
const FullProfileMark = () => (
  <span
    data-testid="full-profile-mark"
    style={{ fontSize: 11, fontWeight: 700, color: D.cream, padding: '2px 8px', borderRadius: 100, background: 'rgba(231,190,110,0.16)', border: '1px solid rgba(231,190,110,0.35)' }}
  >
    Full profile
  </span>
);

/** The empty states' one way out: what is on elsewhere. */
const BrowseNightsLink = () => (
  <Link to="/parties" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', borderRadius: 100, background: 'rgba(246,241,234,0.1)', border: '1px solid rgba(246,241,234,0.2)', color: D.cream, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
    Browse upcoming nights
  </Link>
);

/**
 * A feed that FAILED (S1, prod verify doc E4): one quiet line in place of the
 * section, with a retry. Never the empty-state copy -- a failure is not "no
 * nights". Explicit px sizes: html is ~13.5px on phones, so rem tap targets
 * render small.
 */
const FeedErrorLine = ({ feed, what, onRetry, retrying }: { feed: 'upcoming' | 'past'; what: string; onRetry: () => void; retrying: boolean }) => (
  <section className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid={`org-feed-error-${feed}`} role="status">
    <p style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: 0, fontSize: 14, color: 'rgba(246,241,234,0.75)' }}>
      Couldn&rsquo;t load {what}.
      <RetryButton onRetry={onRetry} pending={retrying} />
    </p>
  </section>
);

// 44px past rows make a busy year very tall; show the latest few per year.
const PAST_ROWS_PER_YEAR = 8;
// Rows / years shown before the "Show all" toggles.
const UPCOMING_VISIBLE = 3;
const PAST_YEARS_VISIBLE = 3;

// Scrolls a section's top into view without touching the URL hash (a hash
// link adds a history entry and cannot target a section that renders late).
const scrollBehavior = (): ScrollBehavior =>
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
const scrollToId = (id: string) => {
  document.getElementById(id)?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
};
// Collapsing a long list: bring the section top back only if it has scrolled
// above the viewport -- otherwise scrollIntoView would move the page DOWN.
const scrollBackIfAbove = (id: string) => {
  const el = document.getElementById(id);
  if (el && el.getBoundingClientRect().top < 0) el.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
};

// Builds EventRow props for a single occurrence. EventRow itself stays
// time-library-agnostic; all WallClock formatting happens here.
//
// A series summary row (one card standing in for a whole run of dates) also
// goes through this: it needs the SERIES's name/poster rather than its first
// date's, and a date-count meta line instead of a time, so those fields take
// an override while the day/mon extraction and href fallback stay shared.
const buildEventRowProps = (
  event: OrgEvent,
  todayKey: string,
  fallbackIndex: number,
  overrides?: {
    chip?: string;
    onClick?: () => void;
    name?: string;
    posterUrl?: string | null;
    meta?: string;
  },
): EventRowProps => {
  const { day, mon } = dateParts(event.displayStart);
  const time = eventTime(event.displayStart);
  const venue = venueCityLine(event.location, event.cityName ?? event.city) ?? '';
  const meta = overrides?.meta ?? [countdownLabel(event.displayStart, todayKey), venue, time].filter(Boolean).join(' \u00b7 ');
  const href = event.occurrenceId ? `/event/${event.id}?occurrenceId=${event.occurrenceId}` : `/event/${event.id}`;
  return {
    href,
    name: overrides?.name ?? event.name,
    posterUrl: overrides?.posterUrl ?? event.poster_url,
    dateDay: day,
    dateMon: mon,
    meta,
    fallbackIndex,
    chip: overrides?.chip,
    onClick: overrides?.onClick,
  };
};

// Props for the Next nights card (design D4). A series passes `series` and gets no time.
const buildNightsCardProps = (
  event: OrgEvent,
  todayKey: string,
  fallbackIndex: number,
  organiserName: string,
  series?: { name: string; posterUrl: string | null; location: string | null; cityLabel: string | null; dateCount: number; tag?: string; onClick: () => void },
) => {
  const key = formatWallClockLocal(event.displayStart, 'yyyy-MM-dd');
  const chip = countdownChip(key, todayKey);
  const name = series?.name ?? event.name;
  const venue = series ? venueCityLine(series.location, series.cityLabel) : venueCityLine(event.location, event.cityName ?? event.city);
  const { day, mon } = dateParts(event.displayStart);
  return {
    href: event.occurrenceId ? `/event/${event.id}?occurrenceId=${event.occurrenceId}` : `/event/${event.id}`,
    onClick: series?.onClick,
    name,
    posterUrl: series ? series.posterUrl : event.poster_url,
    weekday: formatWallClockLocal(event.displayStart, 'EEEE') ?? '',
    day,
    month: mon,
    chipText: chip?.text ?? null,
    chipSoon: chip?.soon ?? false,
    metaLine: cardMetaLine(venue, series ? null : eventTime(event.displayStart)),
    actionLabel: series?.tag ? `See ${series.tag}` : nightsActionLabel(series ? 'series' : 'single', series?.dateCount ?? 1),
    initials: fallbackInitials(name, organiserName),
    fallbackIndex,
  };
};

// --- Colour extraction ---

const DEFAULT_HERO_RGB: [number, number, number] = [255, 106, 44];

// Sampling result per avatar URL, kept for the life of the tab. The R2 bucket
// currently sends no CORS headers (see below), so every attempt fails at
// getImageData and would otherwise re-run the same doomed decode+draw+catch
// on every mount of this page (including a StrictMode double-invoke and every
// back/forward nav between organisers) for no visual gain. Caching both the
// success AND the failure means a given avatar URL is ever sampled once per
// tab, not once per view. Only a DETERMINISTIC failure (the canvas-taint catch
// below) is cached as a negative -- a transient img.onerror (a mobile network
// blip on ~95% of this site's traffic) is deliberately NOT cached, so it can
// retry on the next mount instead of permanently blacklisting an organiser
// whose avatar merely failed to load once.
const HERO_COLOUR_CACHE_MAX = 500;
const heroColourCache = new Map<string, [number, number, number] | null>();

function cacheHeroColour(url: string, value: [number, number, number] | null): void {
  // Insertion-order eviction: this Map lives for the tab's lifetime with no
  // other cleanup, so bound it rather than let it grow with every distinct
  // organiser browsed in one long session.
  if (heroColourCache.size >= HERO_COLOUR_CACHE_MAX && !heroColourCache.has(url)) {
    const oldest = heroColourCache.keys().next().value;
    if (oldest !== undefined) heroColourCache.delete(oldest);
  }
  heroColourCache.set(url, value);
}

function useAverageColor(url: string | null): { rgb: [number, number, number]; ready: boolean } {
  const cached = url ? heroColourCache.get(url) : undefined;
  const [rgb, setRgb] = React.useState<[number, number, number]>(cached ?? DEFAULT_HERO_RGB);
  const [ready, setReady] = React.useState<boolean>(!!cached);

  React.useEffect(() => {
    if (!url) { setRgb(DEFAULT_HERO_RGB); setReady(false); return; }
    const cachedForUrl = heroColourCache.get(url);
    if (cachedForUrl !== undefined) {
      // A same-instance url change (no remount) must resync rgb/ready to
      // THIS url's cached verdict, not leave a previous url's state behind --
      // a positive cache hit sets colour+ready, a cached failure must reset
      // to the default rather than silently keep an unrelated organiser's
      // sampled colour on screen.
      if (cachedForUrl) { setRgb(cachedForUrl); setReady(true); } else { setRgb(DEFAULT_HERO_RGB); setReady(false); }
      return;
    }
    setRgb(DEFAULT_HERO_RGB);
    setReady(false);
    // A url change on the same mounted instance (e.g. the profile owner saves
    // a new avatar and the entity query refetches, with no route/id change to
    // remount this component) must not let a late callback for the OLD url
    // land after this effect has already moved on to the new one.
    let cancelled = false;
    // No crossOrigin: the cover CDN (Cloudflare R2) sends no CORS headers, so a
    // crossOrigin='anonymous' request fails with net::ERR_FAILED -- a console
    // error for every organiser page (and the colour sample fell back to default
    // anyway). Without it the request reuses the already-cached non-CORS <img>
    // fetch (no second request, no error); the canvas then taints and
    // getImageData throws below, caught -> same default colour. To actually
    // enable colour theming, add CORS headers to the R2 bucket and restore
    // crossOrigin here. Whenever that lands, the cache above still holds and
    // the ready-gated opacity fade below (see HERO_BG usage) keeps the reveal
    // a crossfade instead of a pop.
    const img = new Image();
    img.onload = () => {
      let sampled: [number, number, number] | null = null;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 16; canvas.height = 16;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(img, 0, 0, 16, 16);
        const data = ctx.getImageData(2, 2, 12, 12).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < data.length; i += 4) {
          const sat = Math.max(data[i], data[i+1], data[i+2]) - Math.min(data[i], data[i+1], data[i+2]);
          if (sat < 20) continue; // skip near-greys
          r += data[i]; g += data[i+1]; b += data[i+2]; count++;
        }
        if (count === 0) return;
        sampled = [Math.round(r/count), Math.round(g/count), Math.round(b/count)];
      } catch { /* CORS block -- stay on default */ }
      finally {
        // Only reachable via drawImage succeeding and either getImageData
        // throwing (CORS taint) or resolving -- both deterministic outcomes
        // for this url, safe to cache either way.
        cacheHeroColour(url, sampled);
        if (sampled && !cancelled) { setRgb(sampled); setReady(true); }
      }
    };
    img.onerror = () => { /* transient network failure -- do not cache, retry next mount; stay on default for now */ };
    img.src = url;
    return () => { cancelled = true; };
  }, [url]);

  return { rgb, ready };
}

// The owner's edit-in-place layer: its own chunk, loaded ONLY when
// ownershipFacts says canEdit, so a visitor downloads and requests nothing new.
/**
 * Owner layer only: sizes the heading to its widest line of text. A wrapped
 * heading is otherwise as wide as the row, so the Name pencil beside it lands far
 * from the text. Inactive (no inline width, nothing measured) for everyone else.
 */
function useHugText(active: boolean) {
  const ref = useRef<HTMLHeadingElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!active || !el) return undefined;
    const fit = () => {
      el.style.width = '';
      const range = document.createRange();
      if (typeof range.getClientRects !== 'function') return; // jsdom
      range.selectNodeContents(el);
      const widest = Math.max(0, ...Array.from(range.getClientRects()).map((r) => r.width));
      if (widest > 0 && widest < el.getBoundingClientRect().width) el.style.width = `${Math.ceil(widest) + 2}px`;
    };
    fit();
    window.addEventListener('resize', fit);
    void document.fonts?.ready.then(fit);
    return () => {
      window.removeEventListener('resize', fit);
      el.style.width = '';
    };
  });
  return ref;
}

const EditInPlaceLayer = lazyWithRetry(() => import('@/modules/organiser/edit-in-place/EditInPlaceLayer'));

// --- Main component ---

const OrganiserProfile = () => {
  const { id: routeParam } = useParams<{ id: string }>();
  const trackImpression = useListImpressions('organiser');
  const resolved = useEntitySlugOrId(routeParam, 'organiser_profiles');
  const id = resolved.id ?? undefined;
  useCanonicalReplaceState({
    arrivedViaUuid: resolved.arrivedViaUuid,
    slug: resolved.slug,
    buildPath: (s) => `/organisers/${s}`,
  });
  const navigate = useNavigate();
  const { user, session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // W7: decoded once per token, not per render of this page.
  const mailboxProven = useMemo(() => isMailboxProvenToken(session?.access_token), [session?.access_token]);

  const isMobile = useIsMobile();
  // Set by the lazy owner layer (null for everyone else): pencils + drafted values.
  const [eip, setEip] = useState<EipBridge | null>(null);
  // Owner layer only: the name's box hugs its widest line so the Name pencil sits right beside the text.
  const nameRef = useHugText(!!eip);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [openSeriesEventId, setOpenSeriesEventId] = useState<string | null>(null);
  const [showAllPastYears, setShowAllPastYears] = useState(false);
  const [pastListOpen, setPastListOpen] = useState(false);
  const [openPastYears, setOpenPastYears] = useState<Set<string>>(() => new Set());
  const [bioExpanded, setBioExpanded] = useState(false);
  const [expandedPastYears, setExpandedPastYears] = useState<Set<string>>(() => new Set());
  const { data: entity, isLoading: entityLoadingRaw, error, refetch: refetchEntity, isFetching: entityFetching } = useQuery({
    queryKey: organiserEntityQueryKey(id),
    queryFn: () => fetchOrganiserEntity(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // The entity error screen stays up (pending) while its Try again runs (LOW-6).
  const { failed: entityFailed, retrying: entityRetrying } = useStickyFailure(!!error, entityFetching);
  const isLoading = entityLoadingRaw && !entityFailed;

  // A page that is not found (retired, archived, or never existed) is kept out of search.
  // A transient read ERROR is not "not found" (E8): no noindex for it.
  useNoindexMeta(!isLoading && !entityFailed && !entity);

  const { data: fullProfile = false } = useQuery({
    queryKey: organiserFullProfileQueryKey(id),
    queryFn: () => fetchOrganiserFullProfile(id as string),
    enabled: !!id && !!entity,
    staleTime: 5 * 60 * 1000,
    retry: false,
  });

  // Ownership comes from entity_members through organiser_ownership_v1 (never the
  // legacy claimed_by pointer). Skipped for a signed-out visitor with the
  // self-serve flag off: nothing on the page would use it. An RPC error is
  // "unknown" (null), which shows nothing rather than guessing.
  const userId = user?.id;
  const { data: ownership = null } = useQuery({
    queryKey: organiserOwnershipQueryKey(id, userId),
    queryFn: () => fetchOrganiserOwnership(id as string),
    enabled: !!id && !!entity && (!!userId || flags.organiserSelfServe),
    staleTime: 60 * 1000,
  });
  // The claim hint is signed-in only (anon is refused by the RPC).
  const { data: claimHint = null, isLoading: claimHintLoading } = useQuery({
    queryKey: organiserClaimHintQueryKey(id, userId),
    queryFn: () => fetchClaimHint(id as string),
    enabled: !!id && !!entity && !!userId && flags.organiserSelfServe,
    staleTime: 60 * 1000,
  });
  // The WhatsApp / Email rows: both null unless the organiser is live AND the
  // matching show_*_publicly switch is on. An RPC ERROR is its own state (E9):
  // Get in touch keeps the stored-link rows and says it could not load these two.
  const { data: publicContact = NO_PUBLIC_CONTACT, isLoading: publicContactLoading, isError: publicContactErrorRaw, refetch: refetchPublicContact, isFetching: publicContactFetching } = useQuery({
    queryKey: organiserPublicContactQueryKey(id),
    queryFn: () => fetchPublicContactOrThrow(id as string),
    enabled: !!id && !!entity,
    staleTime: 5 * 60 * 1000,
  });

  const { failed: publicContactError, retrying: publicContactRetrying } = useStickyFailure(publicContactErrorRaw, publicContactFetching);

  // The ONE place that turns those answers into badge / card / claim button /
  // edit access (ownership.ts); nothing below re-derives any of them.
  const facts = ownershipFacts({ flagOn: flags.organiserSelfServe, signedIn: !!user, ownership, hint: claimHint, hintLoading: claimHintLoading });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rgb: [cr, cg, cb], ready: heroColourReady } = useAverageColor((entity as any)?.avatar_url ?? null);
  const HERO_BG = heroBg(cr, cg, cb);

  // Each feed query THROWS on an RPC error (S1) -- React Query retries it, and
  // its isError drives the page's error line instead of a false empty state.
  const { data: allEvents = [], isLoading: allEventsLoading, isError: allEventsErrorRaw, refetch: refetchAllEvents, isFetching: allEventsFetching } = useQuery({
    queryKey: organiserEventsQueryKey(id),
    queryFn: () => fetchOrganiserEvents(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: futureOccs = [], isLoading: futureOccsLoading, isError: futureOccsErrorRaw, refetch: refetchFutureOccs, isFetching: futureOccsFetching } = useQuery({
    queryKey: organiserOccEventsQueryKey(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchOrganiserFutureOccEvents(id as string),
  });

  // Past occurrences. Separate query (and cache key) from the future feed above,
  // so the upcoming list never breaks even if the p_include_past RPC arg is not
  // yet deployed (PostgREST rejects the unknown param -> we degrade to empty).
  // The server tags each row with is_past (inverse of the 6h-grace keep-window);
  // we keep only is_past rows so today's already-ended events count as past.
  // The 10-year window itself lives in fetchOrganiserPastOccEvents now, shared
  // with app/routes/organiser.tsx's loader prefetch.
  const { data: pastOccs = [], isLoading: pastOccsLoading, isError: pastOccsErrorRaw, refetch: refetchPastOccs, isFetching: pastOccsFetching } = useQuery({
    queryKey: organiserOccEventsPastQueryKey(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchOrganiserPastOccEvents(id as string),
  });

  // P2: the public Team is organiser_public_team_v1 -- owners, managers, then listed
  // people, already filtered (hides, opt-outs, inactive) and ordered (sort_key) by the
  // RPC. Its key is NOT ['organiser-team', id] (organiser_team_v1, the owner layer's
  // access read). The direct organiser_team_members read stays the edit layer's source.
  const { data: publicTeamRows = [], isLoading: teamMembersLoading, isError: teamMembersErrorRaw, refetch: refetchTeamMembers, isFetching: teamMembersFetching } = useQuery({
    queryKey: organiserPublicTeamKey(id),
    // Throws on error or a bad shape: a failed read is an error line, not "no team" (S1).
    queryFn: () => fetchOrganiserPublicTeam(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // Fix round 1 (LOW-6): a failed read stays failed while its Try again runs, so
  // the error line can show its pending state instead of vanishing into loading.
  const { failed: allEventsError } = useStickyFailure(allEventsErrorRaw, allEventsFetching);
  const { failed: futureOccsError } = useStickyFailure(futureOccsErrorRaw, futureOccsFetching);
  const { failed: pastOccsError } = useStickyFailure(pastOccsErrorRaw, pastOccsFetching);
  const { failed: teamMembersError, retrying: teamMembersRetrying } = useStickyFailure(teamMembersErrorRaw, teamMembersFetching);

  // S3 (read side): the ONE Team mapping, in the RPC's order (teamFromPublicRows).
  const team = useMemo(() => teamFromPublicRows(publicTeamRows), [publicTeamRows]);
  const teamCount = team.people.length;
  const teamIds = useMemo(() => team.people.map((p) => p.personId), [team]);
  // Each circle's flag (dancer_profiles.nationality). A failed flag read only drops
  // the flags; it never hides the Team.
  const { data: teamNationality = EMPTY_NATIONALITY } = useQuery({
    queryKey: ['organiser-public-team-flags', id, teamIds],
    queryFn: async (): Promise<ReadonlyMap<string, string | null>> => {
      const { data, error } = await supabase.from('dancer_profiles').select('id, nationality').in('id', teamIds);
      if (error) throw new Error(error.message);
      return new Map((data ?? []).map((d) => [d.id, pickNationalityCode(d)]));
    },
    enabled: teamIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });
  // The role-aware link from the people-badges mapping (TeamCircle's rule, now teamPersonLink).
  const { badges: teamBadges, isLoading: teamBadgesLoading, isError: teamBadgesError } = usePeopleBadges(teamIds);
  const teamBadgesState = teamBadgesLoading ? 'loading' : teamBadgesError ? 'error' : 'ready';

  // Start of London-today as a true-UTC instant; reactive so a long-lived tab
  // rolls the upcoming/past split over at midnight (was frozen at mount).
  const todayKey = useLondonToday();
  const todayMs = useMemo(() => londonDayRangeUtc(todayKey).start.getTime(), [todayKey]);

  const { upcomingEvents, pastEvents } = useMemo(() => {
    const eventById = new Map(allEvents.map((e) => [e.id, e]));
    const upcoming: OrgEvent[] = [];
    const eventsWithFutureOcc = new Set<string>();
    for (const occ of futureOccs) {
      if (occ.is_cancelled) continue;
      const e = eventById.get(occ.event_id);
      if (!e) continue;
      eventsWithFutureOcc.add(occ.event_id);
      const poster = occ.cover_image_url || (Array.isArray(occ.photo_url) ? occ.photo_url[0] : null) || e.poster_url;
      upcoming.push({ ...e, name: occ.name || e.name, poster_url: poster, location: occ.location ?? e.location, cityName: occ.city_name ?? null, displayStart: asWallClockOrNull(occ.start_time ?? occ.instance_date), occurrenceId: occ.occurrence_id });
    }
    // Past list: driven by real past occurrences (server is_past flag), one
    // OrgEvent per past date. Cancelled rows are passed through by the RPC, so
    // skip them here to keep the "X hosted" count honest.
    const past: OrgEvent[] = [];
    const pastSeen = new Set<string>();
    for (const occ of pastOccs) {
      if (occ.is_cancelled) continue;
      if (!occ.is_past) continue;
      const e = eventById.get(occ.event_id);
      if (!e) continue;
      // startRaw stays a RAW string: it feeds the dedupe key (a template
      // interpolation, which the brand forbids). displayStart is branded below.
      const startRaw = occ.start_time ?? occ.instance_date ?? null;
      const dedupeKey = occ.occurrence_id ?? `${occ.event_id}:${startRaw}`;
      if (pastSeen.has(dedupeKey)) continue;
      pastSeen.add(dedupeKey);
      const poster = occ.cover_image_url || (Array.isArray(occ.photo_url) ? occ.photo_url[0] : null) || e.poster_url;
      past.push({ ...e, name: occ.name || e.name, poster_url: poster, location: occ.location ?? e.location, cityName: occ.city_name ?? null, displayStart: asWallClockOrNull(startRaw), occurrenceId: occ.occurrence_id });
    }
    // Base-date fallback only for legacy events the occurrence feed never
    // surfaced (no future AND no past occurrence row at all). EventRow.start_time
    // / .date stay RAW strings -- their semantics are genuinely mixed and this
    // fallback is unreachable on live data (0 of 15 organisers sampled); displayStart
    // is branded at the push.
    const eventsWithAnyOcc = new Set<string>([...eventsWithFutureOcc, ...pastOccs.map((o) => o.event_id)]);
    // Skipped while either occurrence feed has FAILED (S1): "no occurrence row"
    // is then unknowable, and the fallback would list every series by its base
    // date in place of the error line.
    if (!futureOccsError && !pastOccsError) for (const e of allEvents) {
      if (eventsWithAnyOcc.has(e.id)) continue;
      const baseRaw = e.start_time ?? e.date;
      const baseMs = baseRaw ? new Date(baseRaw).getTime() : NaN;
      const nextStart = baseRaw && !Number.isNaN(baseMs) && baseMs >= todayMs ? baseRaw : null;
      if (nextStart) { upcoming.push({ ...e, displayStart: asWallClockOrNull(nextStart), occurrenceId: null }); }
      else if (!baseRaw) { upcoming.push({ ...e, displayStart: null, occurrenceId: null }); }
      else { past.push({ ...e, displayStart: asWallClockOrNull(baseRaw), occurrenceId: null }); }
    }
    // Sort by a reader-derived key, NOT `displayStart ?? ''` -- coercing a branded
    // WallClock to '' launders it to `string & WallClock` (defeats the brand).
    const sortKey = (wc: WallClock | null): string =>
      formatWallClockLocal(wc, "yyyy-MM-dd'T'HH:mm") ?? '';
    upcoming.sort((a, b) => sortKey(a.displayStart).localeCompare(sortKey(b.displayStart)));
    past.sort((a, b) => sortKey(b.displayStart).localeCompare(sortKey(a.displayStart)));
    return { upcomingEvents: upcoming, pastEvents: past };
  }, [allEvents, futureOccs, pastOccs, futureOccsError, pastOccsError, todayMs]);

  // S1: the stats strip is ONE pure mapping (organiserStats, via
  // organiserStatsByFeed). It reads the same joined, non-cancelled nights the two
  // lists show, so a stat can never disagree with a list. No strip until the feeds
  // settle (no pop-in). Per-feed (fix round 1, review MED-3): a FAILED feed
  // contributes nothing and its own stat is a marked dash, while the stats the
  // working feed alone proves still show -- never a stat from a failed read (S5).
  // The events feed is the join source, so it failing fails both.
  // A failed feed being retried counts as settled (it is still failed), so the strip does not blink.
  const statsFeedsSettled = (!allEventsLoading || allEventsError) && (!futureOccsLoading || futureOccsError) && (!pastOccsLoading || pastOccsError);
  const statsUpcomingFailed = allEventsError || futureOccsError;
  const statsPastFailed = allEventsError || pastOccsError;
  const entityFoundedYear = (entity as EntityProfile | null | undefined)?.founded_year ?? null;
  const stats = useMemo(() => {
    if (!statsFeedsSettled) return [];
    const nightKey = (wc: WallClock | null) => formatWallClockLocal(wc, "yyyy-MM-dd'T'HH:mm");
    return organiserStatsByFeed({
      now: new Date(),
      upcoming: upcomingEvents.map((e) => ({ start: nightKey(e.displayStart) })),
      past: pastEvents.map((e) => ({ start: nightKey(e.displayStart) })),
      upcomingFailed: statsUpcomingFailed,
      pastFailed: statsPastFailed,
      foundedYear: entityFoundedYear,
    });
    // todayKey: a long-lived tab re-derives "Next night" when London rolls over.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- todayKey is the clock tick, read via new Date()
  }, [statsFeedsSettled, statsUpcomingFailed, statsPastFailed, upcomingEvents, pastEvents, entityFoundedYear, todayKey]);

  // No useSeo() here. OrganiserProfile renders only under app/routes/organiser.tsx,
  // which wraps in InitialVisiblePageTransition and so sets RouteOwnsHeadContext --
  // useSeo returns before touching the head. That route's loader + meta() own it,
  // running resolvePublicName over the same ['entity', id] row this page hydrates,
  // so the nameless-organiser soft-404 is closed on the served HTML.
  //
  // A call stood here, annotated as inert but 'kept correct anyway' in case the
  // wrapper invariant changed. That claimed more than it could: the route's meta()
  // overrides `description` with the truncated bio and has a locked / no-data
  // branch, so a woken call would contradict the document rather than back it up.
  // Deleted for the reason BentoPage.tsx gives, whose census also says which
  // useSeo calls are LIVE -- do not generalise from route type (arc W22).

  // Claiming goes through claim_organiser_v1 (Lever 2 W7, PublicClaimCard
  // below). The direct `claimed_by` UPDATE that stood here is retired: D4's
  // contract pairs every claimed_by with an entity_members owner row, which
  // only the RPC writes.
  // Groups upcomingEvents (one OrgEvent per occurrence, already sorted
  // ascending) by event_id: a recurring series (3+ upcoming dates sharing an
  // event_id) collapses to one 'series' item; 1-2-date groups stay as
  // individual 'single' items. Because upcomingEvents is sorted ascending and
  // grouping preserves first-seen order, `items` comes out "soonest first"
  // for both singles and series with no secondary sort needed -- a series'
  // position is anchored to its earliest upcoming date, which is what we want.
  // Must be before early returns (Rules of Hooks).
  const upcomingListItems = useMemo((): UpcomingListItem[] => {
    return groupByEventId(upcomingEvents).map((g): UpcomingListItem => {
      if (g.kind === 'single') return g;
      const first = g.dates[0];
      return {
        kind: 'series',
        eventId: g.eventId,
        name: first.name,
        posterUrl: first.poster_url,
        location: first.location,
        cityLabel: seriesCityLabel(g.dates.map((d) => d.cityName)),
        dates: g.dates,
      };
    });
  }, [upcomingEvents]);

  const visibleItems = showAllUpcoming ? upcomingListItems : upcomingListItems.slice(0, UPCOMING_VISIBLE);
  // "dates" counts individual occurrences, not list rows -- a collapsed
  // series row counts for all of its dates, not just 1, so this matches what
  // "Show all" actually reveals.
  const itemDateCount = (item: UpcomingListItem): number => (item.kind === 'series' ? item.dates.length : 1);
  const totalUpcomingDateCount = upcomingListItems.reduce((sum, item) => sum + itemDateCount(item), 0);

  const wording = upcomingWording(totalUpcomingDateCount, upcomingListItems.length);

  const openSeries = upcomingListItems.find(
    (it): it is Extract<UpcomingListItem, { kind: 'series' }> =>
      it.kind === 'series' && it.eventId === openSeriesEventId,
  ) ?? null;

  // pastEvents is already sorted descending (most recent first), so grouping
  // by first-seen year preserves that order -- no re-sort needed. Memoized
  // like upcomingListItems above: the past window is 10 years, so this walk
  // is worth skipping on unrelated re-renders (edit modal, showAllUpcoming).
  // Must be before early returns (Rules of Hooks).
  const pastByYear = useMemo((): { year: string; events: OrgEvent[] }[] => {
    const byYear = new Map<string, OrgEvent[]>();
    const groups: { year: string; events: OrgEvent[] }[] = [];
    for (const e of pastEvents) {
      const year = formatWallClockLocal(e.displayStart, 'yyyy') ?? 'Unknown';
      if (!byYear.has(year)) { byYear.set(year, []); groups.push({ year, events: byYear.get(year)! }); }
      byYear.get(year)!.push(e);
    }
    return groups;
  }, [pastEvents]);

  // Only the most recent 3 years mount by default -- a decade-old organiser's
  // full history is fetched (for the "since <year>" stat) but doesn't need to
  // render 500+ DOM rows on a mobile-first page just because they're collapsed.
  const pastStrip = pastCounts(
    pastEvents.map((e) => ({ dateKey: formatWallClockLocal(e.displayStart, 'yyyy-MM-dd') })),
    todayKey,
  );
  const visiblePastYears = showAllPastYears ? pastByYear : pastByYear.slice(0, PAST_YEARS_VISIBLE);
  const hiddenPastYears = pastByYear.slice(visiblePastYears.length);

  // --- Loading ---
  if (isLoading) {
    return (
      <GlobalLayout showSubheader={false} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
        <div style={{ minHeight: '100vh', background: D.black }}>
          <div style={{ height: 320, background: HERO_BG_DEFAULT }} />
          <div style={{ padding: '32px 20px' }}>
            <Skeleton className="h-3 w-48 mb-4" style={{ background: 'rgba(246,241,234,0.1)' }} />
            <Skeleton className="h-10 w-3/4 mb-3" style={{ background: 'rgba(246,241,234,0.1)' }} />
            <Skeleton className="h-4 w-1/2" style={{ background: 'rgba(246,241,234,0.08)' }} />
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // --- Entity read error (E8) ---
  // A transient network/DB failure: say so, offer a retry, keep it indexable.
  // Only a real miss (the read succeeded and found no public row) is "not found".
  if (entityFailed && !entity) {
    return (
      <GlobalLayout showSubheader={false} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
        <div data-testid="org-entity-error" role="status" style={{ minHeight: '100vh', background: D.black, color: D.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BODY }}>
          <div className="text-center px-6">
            <h1 style={{ fontFamily: SERIF, fontSize: 32, color: D.cream, marginBottom: 12 }}>Couldn&rsquo;t load this organiser</h1>
            <p style={{ color: 'rgba(246,241,234,0.75)', fontSize: 14, maxWidth: 320, margin: '0 auto 20px' }}>
              Check your connection and try again.
            </p>
            <RetryButton
              onRetry={() => void refetchEntity()}
              pending={entityRetrying}
              style={{ background: D.gold, color: D.black, borderRadius: 100, padding: '0 16px' }}
            />
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // --- Not found ---
  if (!entity) {
    return (
      <GlobalLayout showSubheader={false} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
        <div style={{ minHeight: '100vh', background: D.black, color: D.cream, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: BODY }}>
          <div className="text-center px-6">
            <h1 style={{ fontFamily: SERIF, fontSize: 48, color: D.cream, marginBottom: 12 }}>Organiser not found</h1>
            <p style={{ color: 'rgba(246,241,234,0.55)', fontSize: 14, maxWidth: 320, margin: '0 auto 24px' }}>
              The organiser profile you&rsquo;re looking for doesn&rsquo;t exist.
            </p>
            <button
              onClick={() => navigate('/organisers')}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-full"
              style={{ background: 'rgba(246,241,234,0.1)', border: '1px solid rgba(246,241,234,0.2)', color: D.cream, cursor: 'pointer' }}
            >
              <ChevronLeft className="w-4 h-4" /> Back to organisers
            </button>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  // --- Data prep ---
  // An owner's unsaved drafts are shown in place (eip.overlay is {} otherwise).
  const ep = { ...(entity as EntityProfile), ...(eip?.overlay ?? {}) } as EntityProfile;
  const socials          = ep.socials as { instagram?: string; website?: string } | null;
  const instagramRaw     = ep.instagram  || socials?.instagram  || null;
  const websiteRaw       = ep.website    || socials?.website    || null;
  const contactPhone     = publicContact.contact_phone;
  const contactEmail     = publicContact.contact_email;
  const organisationCategory = ep.organisation_category || null;

  // withNormalizedProtocol is the shared normaliser (organiserProfileUpdate.ts),
  // the same one the edit-in-place save path builds its patch with.
  // hostMatchesDomain, never a substring test -- a stored value that only
  // MENTIONS "instagram.com"/"facebook.com" (a query string, a look-alike
  // subdomain) must not render as a live link under that platform's label.
  const instagramUrl = instagramRaw
    ? (hostMatchesDomain(instagramRaw, 'instagram.com')
        ? withNormalizedProtocol(instagramRaw, 'instagram.com')
        : /^https?:\/\//i.test(instagramRaw)
          ? null
          : `https://instagram.com/${instagramRaw.replace('@', '')}`)
    : null;
  const websiteUrl   = websiteRaw ? withNormalizedProtocol(websiteRaw) : null;
  const whatsappUrl = buildWhatsAppHref(contactPhone);
  const mailtoHref = buildMailtoHref(contactEmail);

  // Facebook is not a Get in touch row (E2, owner decision): the value stays
  // stored and editable in the owner layer, it just is not offered here.
  const igHandle = instagramUrl ? extractIgHandle(instagramRaw) : null;
  const siteDomain = websiteUrl ? extractDomain(websiteRaw) : null;
  const contactRows = buildContactRows({
    phone: contactPhone, whatsappHref: whatsappUrl, email: contactEmail, mailtoHref,
    instagramUrl, instagramHandle: igHandle, websiteUrl, websiteDomain: siteDomain,
  });
  // Unknown (null), not false, while WhatsApp/Email failed to load and no stored
  // link shows (fix round 1, review L2): an owner is never told to complete
  // contact details that may well be there.
  const hasContact: boolean | null = contactRows.length > 0 ? true : publicContactError ? null : false;

  // S1: which sections FAILED (after React Query's retry). The events feed is
  // the join source for both lists, so it failing fails both; the future and
  // past feeds fail independently, and one failing never hides the other list.
  const upcomingFailed = allEventsError || futureOccsError;
  const pastFailed = allEventsError || pastOccsError;
  const retryUpcoming = () => { if (allEventsError) void refetchAllEvents(); if (futureOccsError) void refetchFutureOccs(); };
  const retryPast = () => { if (allEventsError) void refetchAllEvents(); if (pastOccsError) void refetchPastOccs(); };
  const retryingUpcoming = (allEventsError && allEventsFetching) || (futureOccsError && futureOccsFetching);
  const retryingPast = (allEventsError && allEventsFetching) || (pastOccsError && pastOccsFetching);
  // No empty state while a NIGHTS feed has failed: "no nights" / "nothing
  // upcoming" is a fact a failure cannot prove; the error lines say what
  // happened instead. A team or contact failure does not hide it (fix round 1,
  // review LOW-5): it passes the unknown as null, which is never "blank".
  const emptyKind = upcomingFailed || pastFailed ? null : organiserEmptyState({
    loading: allEventsLoading || futureOccsLoading || pastOccsLoading || (teamMembersLoading && !teamMembersError) || (publicContactLoading && !publicContactError),
    upcoming: upcomingListItems.length,
    past: pastEvents.length,
    hasBio: !!entity.bio?.trim(),
    hasContact,
    team: teamMembersError ? null : teamCount,
    canEdit: facts.canEdit,
  });
  // W7: the badge and the "Is this you?" card come from `facts` (computed above,
  // behind the self-serve flag, off in production until launch).
  const claimUser = user ? { id: user.id, email: user.email } : null;
  const publicPath = `/organisers/${resolved.slug ?? routeParam ?? ''}`;

  // ep, not entity: an owner's drafted City shows in place.
  const cityName = ep.cities?.name ?? ep.city ?? null;
  const metaLine = [organisationCategory, cityName].filter(Boolean).join(' \u00b7 ');

  // The bio is shown once, in the header: 150 characters, More for the rest.
  const hero = heroBio(ep.bio, cityName, organisationCategory);
  const heroShown = bioExpanded && hero.truncated ? (ep.bio ?? '').trim() : hero.text;
  // navigator.clipboard is undefined on plain-HTTP origins and some in-app
  // browsers; say so rather than letting the tap do nothing.
  const copyValue = (value: string, noun: string) => {
    const failed = () => toast({ title: `Couldn't copy the ${noun}`, variant: 'destructive' });
    if (!navigator.clipboard?.writeText) { failed(); return; }
    navigator.clipboard.writeText(value).then(() => toast({ title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} copied` }), failed);
  };
  const sectionH2: React.CSSProperties = { fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.3, margin: 0, color: D.cream };
  const sectionCount: React.CSSProperties = { fontSize: 12, color: 'rgba(246,241,234,0.6)', fontWeight: 600 };
  const moreBtn: React.CSSProperties = { display: 'block', width: '100%', minHeight: 44, padding: '10px', background: 'none', border: 'none', color: D.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' };
  const heroMore = hero.truncated ? (
    <button type="button" onClick={() => setBioExpanded((v) => !v)} aria-expanded={bioExpanded} data-testid="hero-bio-more" style={{ ...moreBtn, display: 'inline-block', width: 'auto', minHeight: 44, padding: '10px 0 10px 8px', textAlign: 'left' }}>
      {bioExpanded ? 'Show less' : 'More'}
    </button>
  ) : null;

  // --- Render ---
  return (
    <GlobalLayout showSubheader={false} backHref="/organisers" subheaderTone="onDark" showGradientBg={false} showProgressBar={false}>
      <article style={{ fontFamily: BODY, background: D.black, color: D.cream, minHeight: '100vh' }}>
        {eip?.slot('card')}

        {/* HERO */}
        <header className="relative overflow-hidden" style={{ background: heroBg(...DEFAULT_HERO_RGB) }}>
          {/* Sampled-colour layer, faded in only once useAverageColor has a real
              answer -- this is what keeps a future CORS fix (see the comment on
              useAverageColor) a crossfade instead of a pop; today it never
              becomes visible because sampling always fails without CORS. Base
              layer above MUST stay heroBg(DEFAULT_HERO_RGB), not HERO_BG_DEFAULT
              (that constant is the loading-skeleton's own, differently-tinted
              gradient -- using it here regressed every organiser's hero to the
              wrong colour, since ready never flips true today). */}
          <div aria-hidden style={{ position: 'absolute', inset: 0, background: HERO_BG, opacity: heroColourReady ? 1 : 0, transition: 'opacity 600ms ease-out', pointerEvents: 'none' }} />

          {/* Sound-floor motif: a low, still EQ visualiser along the hero's
              base, like a paused DJ meter -- grounds the hero in a bachata
              night's music rather than generic hero-shine sparkle. Reduced
              motion keeps it still. */}
          <style>{HERO_EQ_STYLE}</style>
          <div aria-hidden style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 44, display: 'flex', alignItems: 'flex-end', gap: 3, padding: '0 4px', opacity: 0.16, pointerEvents: 'none' }}>
            {HERO_EQ_HEIGHTS.map((h, i) => (
              <div
                key={i}
                className="organiser-hero-eq-bar"
                style={{
                  flex: 1,
                  minWidth: 2,
                  borderRadius: '2px 2px 0 0',
                  background: 'linear-gradient(180deg,#FBEFC4,#E7BE6E 55%,#FF6A2C)',
                  height: `${h * 100}%`,
                  transformOrigin: 'bottom',
                  animation: `organiserHeroEq ${1.6 + (i % 4) * 0.25}s ease-in-out ${(i % 6) * 0.09}s infinite`,
                }}
              />
            ))}
          </div>

          {/* No top-right "Edit profile" button (owner decision, 2026-10-12): the
              owner layer's pencils edit each item in place, and a wholly blank
              profile's empty state below carries the About pencil. */}

          {/* Mobile */}
          {(isMobile !== false) && <div style={{ position: 'relative', minHeight: 320, height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 26, paddingLeft: 24, paddingRight: 24, textAlign: 'center' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <AvatarCircle avatarUrl={ep.avatar_url ?? null} name={ep.name} sizePx={104} fontSize={40} />
              {eip?.slot('photo')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {metaLine && !eip && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: D.gold }}>{metaLine}</span>}
              {eip?.slot('meta')}
              {fullProfile && <FullProfileMark />}
              {facts.showBadge && <ManagedBadge size="sm" />}
            </div>
            {/* Static gold gradient, no shimmer sweep -- that mechanical
                highlight-scroll is the generic premium-SaaS hero tell; the
                sound-floor motif and wave mark below carry this hero's
                personality instead. */}
            {/* The owner's Name pencil sits BESIDE the heading, never inside it (it would join the heading's name). */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, maxWidth: '100%', ...(eip ? { width: 'fit-content', marginBottom: 8 } : null) }}>
              <h1 ref={nameRef} className={eip?.mark('name')} style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(36px,12vw,54px)', lineHeight: 0.95, margin: eip ? 0 : '0 0 8px', ...(eip ? { textWrap: 'balance' as const } : null), minWidth: 0, background: 'linear-gradient(110deg,#F4D89A,#E7BE6E 30%,#FBEFC4 50%,#D2A350 70%,#F4D89A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                {ep.name}
              </h1>
              {eip?.slot('name')}
            </div>
            <svg aria-hidden width="88" height="12" viewBox="0 0 88 12" fill="none" style={{ margin: '0 0 10px' }}>
              <path d="M2 6c6-5 12-5 18 0s12 5 18 0 12-5 18 0 12 5 18 0" stroke={D.gold} strokeWidth="2" strokeLinecap="round" opacity="0.55" />
            </svg>
            {heroShown && (
              <p className={cn(!hero.fallback && eip?.mark('bio'))} data-testid="hero-bio" style={{ margin: 0, fontSize: 13, color: 'rgba(246,241,234,0.78)', fontWeight: 500, lineHeight: 1.4, whiteSpace: 'pre-line' }}>
                {heroShown}
                {heroMore}
              </p>
            )}
            {eip?.slot(ep.bio ? 'about' : 'about-empty')}
          </div>}

          {/* Desktop */}
          {(isMobile === false) && <div style={{ minHeight: 438, position: 'relative', display: 'flex', alignItems: 'flex-end', padding: '24px 48px 40px' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 28 }}>
              <div style={{ position: 'relative', flexShrink: 0 }}>
                <AvatarCircle avatarUrl={ep.avatar_url ?? null} name={ep.name} sizePx={148} fontSize={52} />
                {eip?.slot('photo')}
              </div>
              <div style={{ flex: 1, paddingBottom: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                  {metaLine && !eip && <span style={{ fontSize: 12.5, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: D.gold }}>{metaLine}</span>}
                  {eip?.slot('meta')}
                  {fullProfile && <FullProfileMark />}
                  {facts.showBadge && <ManagedBadge size="md" />}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, ...(eip ? { width: 'fit-content', maxWidth: '100%', marginBottom: 12 } : null) }}>
                  <h1 ref={nameRef} className={eip?.mark('name')} style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(48px,5vw,78px)', lineHeight: 0.95, margin: eip ? 0 : '0 0 12px', ...(eip ? { textWrap: 'balance' as const } : null), minWidth: 0, letterSpacing: '-0.01em', background: 'linear-gradient(110deg,#F4D89A,#E7BE6E 30%,#FBEFC4 50%,#D2A350 70%,#F4D89A)', WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>
                    {ep.name}
                  </h1>
                  {eip?.slot('name')}
                </div>
                <svg aria-hidden width="104" height="14" viewBox="0 0 104 14" fill="none" style={{ margin: '0 0 12px' }}>
                  <path d="M2 7c7-6 14-6 21 0s14 6 21 0 14-6 21 0 14 6 21 0" stroke={D.gold} strokeWidth="2.3" strokeLinecap="round" opacity="0.55" />
                </svg>
                {heroShown && (
                  <p className={cn(!hero.fallback && eip?.mark('bio'))} data-testid="hero-bio-desktop" style={{ margin: 0, fontSize: 18, color: 'rgba(246,241,234,0.78)', fontWeight: 500, whiteSpace: 'pre-line' }}>
                    {heroShown}
                    {heroMore}
                  </p>
                )}
                {eip?.slot(ep.bio ? 'about' : 'about-empty')}
              </div>

            </div>
          </div>}
        </header>

        {/* Brand colour fade &mdash; bleeds the hero tint into the body. Two
            stacked layers (default + sampled) so this crossfades the same way
            the hero overlay above does, instead of popping the moment a
            colour sample lands. It takes NO height (2026-10-13): it was a 10vh /
            80px empty band between the hero's EQ bars and the stats; the fade
            now lies UNDER the stats strip (zIndex 1 there) instead. */}
        <div aria-hidden style={{ pointerEvents: 'none', position: 'relative', height: 0, marginTop: '-1px', zIndex: 0 }}>
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 'min(10vh, 80px)', background: `linear-gradient(180deg,rgba(${DEFAULT_HERO_RGB[0]},${DEFAULT_HERO_RGB[1]},${DEFAULT_HERO_RGB[2]},0.18) 0%,transparent 100%)` }} />
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 'min(10vh, 80px)', background: `linear-gradient(180deg,rgba(${cr},${cg},${cb},0.18) 0%,transparent 100%)`, opacity: heroColourReady ? 1 : 0, transition: 'opacity 600ms ease-out' }} />
        </div>

        {/* S1 order: hero, stats, Get in touch, Team, About, Next nights, Past nights. */}
        <OrganiserStatsStrip stats={stats} onNextNight={() => scrollToId('upcoming')} />

        <OrganiserGetInTouch rows={contactRows} contactFailed={publicContactError} retrying={publicContactRetrying} onRetry={() => void refetchPublicContact()} onCopy={copyValue} />
        {eip?.slot('contact')}
        {eip?.slot('links')}

        <OrganiserTeamSection
          team={team}
          failed={teamMembersError}
          retrying={teamMembersRetrying}
          onRetry={() => void refetchTeamMembers()}
          nationality={teamNationality}
          badges={teamBadges}
          badgesState={teamBadgesState}
        />
        {eip?.slot('team')}

        {/* W7 (mockup 06-A): "Is this you?" while the organiser is unclaimed.
            Renders nothing when the flag is off or the organiser is managed;
            signed out it offers sign-in back to this page. The RPCs decide. */}
        <PublicClaimCard
          key={entity.id}
          facts={facts}
          hint={claimHint}
          organiser={{ id: entity.id, name: entity.name }}
          user={claimUser}
          mailboxProven={mailboxProven}
          returnTo={publicPath}
          onChanged={(outcome) => {
            // The badge reads the refetched row; /account's home and request
            // lists are cached under the user and must not show the old state.
            if (outcome !== 'requested') {
              void queryClient.invalidateQueries({ queryKey: organiserEntityQueryKey(id) });
              void queryClient.invalidateQueries({ queryKey: organiserOwnershipQueryKey(id, userId) });
              void queryClient.invalidateQueries({ queryKey: organiserClaimHintQueryKey(id, userId) });
            }
            if (outcome === 'claimed') void queryClient.invalidateQueries({ queryKey: organiserHomeQueryKey(user?.id) });
            if (outcome !== 'stale') void queryClient.invalidateQueries({ queryKey: myAccessRequestsQueryKey(user?.id) });
          }}
        />

        {/* Owner-only (canEdit): a wholly blank profile is prompted to complete
            itself. organiserEmptyState never returns 'owner-blank' for a visitor. */}
        {emptyKind === 'owner-blank' && (
          <section className="px-5 md:px-12 py-8 md:py-10 text-center" data-testid="org-public-empty" data-kind={emptyKind}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: D.gold, margin: '0 0 12px' }}>Your profile</p>
            <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(22px,4vw,30px)', color: D.cream, margin: '0 0 10px' }}>Just getting started</h2>
            {/* retireLegacyEditDialog: the one editor is edit-in-place. The copy names
                only controls the owner layer puts on screen (the photo pencil in the
                hero, the Your links pencils, the About pencil here); until the lazy
                layer has loaded it names none and the action is disabled with a
                reason. docs/design/organiser-retire-legacy-edit-dialog.md */}
            <p style={{ fontSize: 14, color: 'rgba(246,241,234,0.6)', maxWidth: 420, margin: '0 auto 22px', lineHeight: 1.5 }}>
              {eip
                ? <>Tap the pencil on your photo for your picture, the pencils in Your links for Instagram, Facebook and your website, and the one here for a bio, so dancers know who you are before your first night goes up.</>
                : <>Add a bio, photo and your social links so dancers know who you are before your first night goes up.</>}
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: 8 }}>
              {eip ? (
                <span data-testid="org-blank-about" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, padding: '0 0 0 16px', borderRadius: 100, border: '1px solid rgba(231,190,110,0.45)', color: D.cream, fontSize: 13, fontWeight: 700 }}>
                  Add a bio
                  {eip.slot('about')}
                </span>
              ) : (
                <button type="button" disabled aria-disabled="true" data-testid="org-blank-loading" style={{ minHeight: 44, padding: '0 18px', borderRadius: 100, background: 'transparent', color: 'rgba(246,241,234,0.6)', fontSize: 13, fontWeight: 700, border: '1px solid rgba(246,241,234,0.25)', cursor: 'default' }}>
                  Loading your editor&hellip;
                </button>
              )}
              {eip?.slot('create-first-event')}
            </div>
          </section>
        )}
        {/* NEXT NIGHTS */}
        {upcomingFailed && upcomingListItems.length === 0 && <FeedErrorLine feed="upcoming" what="dates" onRetry={retryUpcoming} retrying={retryingUpcoming} />}
        {upcomingListItems.length > 0 && (
          <section id="upcoming" className="px-5 md:px-12 py-4 md:py-6 scroll-mt-16" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            {/* Wraps at 360px: the owner's Create event link goes under the count rather than off the screen. */}
            <div style={{ display: 'flex', alignItems: eip ? 'center' : 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <h2 style={sectionH2}>Next nights</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' }}>
                {wording.headingCount && <span style={sectionCount}>{wording.headingCount}</span>}
                {eip?.slot('create-event')}
              </div>
            </div>
            {/* Plain anchor (no handler, no role) so a walk can scroll to the cards without clicking one. */}
            <div id="next-nights-list">
            <div className="flex flex-col gap-2">
              {visibleItems.map((item, i) =>
                item.kind === 'single' ? (
                  <NightsCard key={stableRowKey(item.event.occurrenceId, item.event.id, i)} impressionRef={trackImpression(item.event.id)} {...buildNightsCardProps(item.event, todayKey, i, ep.name)} />
                ) : (
                  <NightsCard
                    key={item.eventId}
                    impressionRef={trackImpression(item.eventId)}
                    {...buildNightsCardProps(item.dates[0], todayKey, i, ep.name, {
                      name: item.name,
                      posterUrl: item.posterUrl,
                      location: item.location,
                      cityLabel: item.cityLabel,
                      dateCount: item.dates.length,
                      tag: wording.seriesTag ?? undefined,
                      onClick: () => setOpenSeriesEventId(item.eventId),
                    })}
                  />
                ),
              )}
            </div>
            </div>
            {upcomingListItems.length > UPCOMING_VISIBLE && (
              <button onClick={() => { if (showAllUpcoming) scrollBackIfAbove('upcoming'); setShowAllUpcoming((v) => !v); }} aria-expanded={showAllUpcoming} style={moreBtn}>
                {showAllUpcoming ? 'Show fewer' : wording.showMoreLabel}
              </button>
            )}
            {wording.capLine && (
              <p data-testid="org-upcoming-cap-line" style={{ textAlign: 'center', fontSize: 12, opacity: 0.6, margin: '10px 0 0' }}>{wording.capLine}</p>
            )}
          </section>
        )}

        {/* Nothing upcoming, no nights at all: one quiet line and a way out. */}
        {emptyKind === 'none' && (
          <section className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="org-public-empty" data-kind={emptyKind}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(246,241,234,0.75)' }}>{NO_DATES_ANNOUNCED}.</p>
              <BrowseNightsLink />
              {eip?.slot('create-first-event')}
            </div>
          </section>
        )}

        {/* Nothing upcoming but nights in the past: the quiet line, whether or not
            the past list below has rows to show (fix round 1, review L4: it used
            to render only inside that list). */}
        {emptyKind === 'past-only' && pastEvents.length === 0 && (
          <section className="px-5 md:px-12 py-3" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="org-public-empty" data-kind={emptyKind}>
            <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(246,241,234,0.75)' }}>{NO_DATES_ANNOUNCED}.</p>
              <BrowseNightsLink />
              {eip?.slot('create-another-event')}
            </div>
          </section>
        )}

        {/* PAST EVENTS */}
        {pastFailed && pastEvents.length === 0 && <FeedErrorLine feed="past" what="past dates" onRetry={retryPast} retrying={retryingPast} />}
        {pastEvents.length > 0 && (
          <section id="past" className="px-5 md:px-12 py-4 md:py-6 scroll-mt-16">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={sectionH2}>{emptyKind === 'past-only' ? 'Recently hosted' : 'Past nights'}</h2>
              {/* The highlights strip prints "N nights hosted"; the header count shows only when there is no strip. */}
              {pastStrip.total === 0 && <span style={sectionCount}>{pastEvents.length} hosted</span>}
            </div>
            {emptyKind === 'past-only' && (
              <div data-testid="org-public-empty" data-kind={emptyKind} style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 8, margin: '-4px 0 8px' }}>
                <p style={{ margin: 0, fontSize: 14, color: 'rgba(246,241,234,0.75)' }}>{NO_DATES_ANNOUNCED}.</p>
                <BrowseNightsLink />
                {eip?.slot('create-another-event')}
              </div>
            )}
            <PastHighlights
              total={pastStrip.total}
              thisYear={pastStrip.thisYear}
              latest={pastEvents.slice(0, 6).map((e, i) => ({
                key: stableRowKey(e.occurrenceId, e.id, i),
                href: e.occurrenceId ? `/event/${e.id}?occurrenceId=${e.occurrenceId}` : `/event/${e.id}`,
                name: e.name,
                posterUrl: e.poster_url,
                caption: formatWallClockLocal(e.displayStart, 'd MMM') ?? 'TBA',
              }))}
              showSeeAll={pastStrip.showSeeAll}
              listOpen={pastListOpen}
              onToggleList={() => setPastListOpen((v) => !v)}
              years={pastByYear.map((g) => ({ year: g.year, count: g.events.length }))}
              onYear={(year) => {
                setPastListOpen(true);
                const idx = pastByYear.findIndex((g) => g.year === year);
                if (idx >= PAST_YEARS_VISIBLE) setShowAllPastYears(true);
                setOpenPastYears((prev) => new Set(prev).add(year));
                setTimeout(() => scrollToId(`past-${year}`), 50);
              }}
              organiserName={ep.name}
            />
            {pastListOpen && (
            <div className="flex max-w-3xl flex-col gap-2">
              {visiblePastYears.map((group, gi) => { const shown = expandedPastYears.has(group.year) ? group.events : group.events.slice(0, PAST_ROWS_PER_YEAR); return (
                <details key={group.year} id={`past-${group.year}`} open={gi === 0 || openPastYears.has(group.year)} className="scroll-mt-16 rounded-2xl border" style={{ borderColor: 'rgba(246,241,234,0.08)', padding: '0 12px' }}>
                  <summary
                    className="flex min-h-[44px] cursor-pointer list-none items-center justify-between"
                    style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' as const, color: 'rgba(246,241,234,0.7)' }}
                  >
                    <span>{group.year} &middot; {group.events.length} {group.events.length === 1 ? 'night' : 'nights'}</span>
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="2" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
                  </summary>
                  <div className="flex flex-col pb-1">
                    {shown.map((e, i) => {
                      const href = e.occurrenceId ? `/event/${e.id}?occurrenceId=${e.occurrenceId}` : `/event/${e.id}`;
                      const label = formatWallClockLocal(e.displayStart, 'EEEE d MMM') ?? 'TBA';
                      return (
                        <Link
                          key={stableRowKey(e.occurrenceId, e.id, i)}
                          to={href}
                          className="flex min-h-[44px] items-center gap-2 no-underline"
                          style={{ borderBottom: i < shown.length - 1 ? '1px solid rgba(246,241,234,0.05)' : undefined }}
                        >
                          <span
                            className="h-7 w-7 flex-shrink-0 rounded-md"
                            style={{ background: e.poster_url ? undefined : PAST_GRADS[i % PAST_GRADS.length], backgroundImage: cssUrl(e.poster_url, srcWidthFor(28)), backgroundSize: 'cover', backgroundPosition: 'center' }}
                          />
                          <span className="flex-shrink-0 whitespace-nowrap text-sm" style={{ width: 132, color: D.cream }}>{label}</span>
                          <span className="min-w-0 flex-1 truncate text-sm" style={{ color: 'rgba(246,241,234,0.75)' }}>{e.name}</span>
                        </Link>
                      );
                    })}
                    {group.events.length > PAST_ROWS_PER_YEAR && (
                      <button
                        onClick={() => { if (expandedPastYears.has(group.year)) scrollBackIfAbove(`past-${group.year}`); setExpandedPastYears((prev) => { const next = new Set(prev); if (next.has(group.year)) next.delete(group.year); else next.add(group.year); return next; }); }}
                        aria-expanded={expandedPastYears.has(group.year)}
                        style={{ ...moreBtn, fontSize: 12 }}
                      >
                        {expandedPastYears.has(group.year) ? 'Show fewer' : `Show all ${group.events.length} nights in ${group.year}`}
                      </button>
                    )}
                  </div>
                </details>
              ); })}
            </div>
            )}
            {pastListOpen && pastByYear.length > PAST_YEARS_VISIBLE && (
              <button onClick={() => { if (showAllPastYears) scrollBackIfAbove('past'); setShowAllPastYears((v) => !v); }} aria-expanded={showAllPastYears} style={moreBtn}>
                {showAllPastYears ? 'Show fewer years' : `Show earlier years (${hiddenPastYears.length})`}
              </button>
            )}
          </section>
        )}

        {facts.canEdit && id && (
          <Suspense fallback={null}>
            <EditInPlaceLayer key={id} organiserId={id} entity={entity} onBridge={setEip} userId={userId} />
          </Suspense>
        )}
      </article>

      <div style={{ color: D.cream }}><ReportProblemLink /></div>

      <SeriesDatesSheet
        open={!!openSeries}
        onOpenChange={(o) => { if (!o) setOpenSeriesEventId(null); }}
        seriesName={openSeries?.name ?? ''}
        dates={(openSeries?.dates ?? []).map((e, i) => buildEventRowProps(e, todayKey, i))}
      />
    </GlobalLayout>
  );
};

export default OrganiserProfile;
