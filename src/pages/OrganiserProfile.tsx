import { withPublicNames } from '@/lib/publicDancerNames';
import { resolvePublicName } from '@/lib/publicName';
import React from 'react';
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
import { PUBLIC_LINK_REL, extractDomain, extractFbHandle, extractIgHandle } from '@/lib/organiserLinkLabels';
import {
  NO_PUBLIC_CONTACT,
  fetchOrganiserOwnership,
  fetchPublicContact,
  organiserOwnershipQueryKey,
  organiserPublicContactQueryKey,
} from '@/modules/organiser/shared/ownershipApi';
import { fetchClaimHint, myAccessRequestsQueryKey, organiserClaimHintQueryKey, organiserHomeQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { isMailboxProvenToken } from '@/modules/organiser/shared/sessionProof';
import { useIsMobile } from '@/hooks/use-mobile';
import { Loader2, ChevronLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useEntitySlugOrId, useCanonicalReplaceState } from '@/lib/seo';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CityPicker } from '@/components/ui/city-picker';
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import {
  buildMailtoHref,
  buildWhatsAppHref,
  isValidEmail as sharedIsValidEmail,
} from '@/lib/contactValidation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import {
  hostMatchesDomain,
  withNormalizedProtocol,
  saveOrganiserProfile,
  organiserProfileSaveErrorToast,
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
import { organiserEmptyState } from '@/modules/profile/organiserEmptyState';
import { optimizedImageUrl, cssUrl, srcWidthFor } from '@/lib/imageCdn';
import { useListImpressions } from '@/lib/listImpressions';
import EventRowCard, { type EventRowProps } from '@/components/events/EventRow';
import SeriesDatesSheet from '@/components/events/SeriesDatesSheet';
import { groupByEventId, stableRowKey } from '@/lib/eventListGrouping';
import { ReportProblemLink } from '@/lib/contactLinks';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { NationalityFlag } from '@/components/people/NationalityFlag';
import { pickNationalityCode } from '@/components/people/nationality';
import { usePeopleBadges, roleTagsFor, nameFor, linkRoleFor, hrefForRole, type PersonBadge } from '@/modules/person-page/badges';
import { emitProfileView } from '@/lib/profileViewEmit';
import { ROLE_LABEL } from '@/lib/searchEntities';
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

type OrgEvent = EventRow & { displayStart: WallClock | null; occurrenceId?: string | null };

type UpcomingListItem =
  | { kind: 'single'; event: OrgEvent }
  | {
      kind: 'series';
      eventId: string;
      name: string;
      posterUrl: string | null;
      location: string | null;
      dates: OrgEvent[];
    };

type TeamMember = {
  id: string;
  memberId: string;
  dancerId: string | null;
  name: string;
  avatarUrl: string | null;
  nationalityCode: string | null;
  role: string | null;
  isHead: boolean | null;
  isLeader: boolean | null;
};

type EntityProfile = {
  id: string;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  socials: Record<string, string | undefined> | null;
  is_verified: boolean | null;
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


// A resolved hostname must look like a real domain -- containing a dot AND
// a letter -- before a website URL is accepted. Without this, placeholder
// text like "TBA"/"N/A" (hostname "tba", no dot) and purely numeric input
// like "12345" (the URL parser reads it as the IPv4 "0.0.48.57" -- has dots
// but no letters) both validate and save as a live, dead link. Checking the
// PARSED hostname rather than the raw input closes this for both the bare
// "tba" and the scheme-prefixed "https://tba" spellings alike.
const hostnameLooksLikeDomain = (hostname: string): boolean =>
  hostname.includes('.') && /[a-z]/i.test(hostname);

// extractIgHandle / extractFbHandle / extractDomain live in
// src/lib/organiserLinkLabels.ts, shared with the owner's edit-in-place rows.

// --- Validation helpers ---

// Delegates to contactValidation.ts's own isValidEmail
// (already imported below for buildMailtoHref/buildWhatsAppHref) so save-time
// validation can't diverge from what render-time link-building accepts --
// an earlier version of this file had two separate regexes for the same
// thing and that's exactly the drift contactValidation.ts exists to stop.
const isValidEmail = (email: string | null | undefined): boolean => {
  if (!email || !email.trim()) return true;
  return sharedIsValidEmail(email);
};

const isValidWebsiteUrl = (url: string | null | undefined): boolean => {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  try {
    const hostname = new URL(withNormalizedProtocol(trimmed)).hostname;
    return hostnameLooksLikeDomain(hostname);
  } catch {
    return false;
  }
};

const isValidInstagramUrl = (url: string | null | undefined): boolean => {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('@')) {
    return /^@[a-zA-Z0-9._]+$/.test(trimmed);
  }
  // hostMatchesDomain, not a substring test -- an arbitrary URL that merely
  // mentions "instagram.com" in its query string or path must NOT validate
  // as an Instagram entry.
  if (hostMatchesDomain(trimmed, 'instagram.com')) {
    try {
      new URL(withNormalizedProtocol(trimmed, 'instagram.com'));
      return true;
    } catch {
      return false;
    }
  }
  if (/^https?:\/\//i.test(trimmed)) return false;
  return /^[a-zA-Z0-9._]+$/.test(trimmed);
};

const isValidFacebookUrl = (url: string | null | undefined): boolean => {
  if (!url) return true;
  const trimmed = url.trim();
  if (!trimmed) return true;
  if (trimmed.startsWith('@')) {
    return /^@[a-zA-Z0-9.\-_]+$/.test(trimmed);
  }
  if (hostMatchesDomain(trimmed, 'facebook.com')) {
    try {
      new URL(withNormalizedProtocol(trimmed, 'facebook.com'));
      return true;
    } catch {
      return false;
    }
  }
  if (/^https?:\/\//i.test(trimmed)) return false;
  return /^[a-zA-Z0-9.\-_]+$/.test(trimmed);
};

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

const VerifiedBadge = ({ size }: { size: 'sm' | 'md' }) => {
  const iconPx = size === 'sm' ? 10 : 12;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: size === 'sm' ? 4 : 5,
        fontSize: size === 'sm' ? 10 : 12,
        fontWeight: 700,
        color: D.cream,
        padding: size === 'sm' ? '2px 7px' : '3px 9px',
        borderRadius: 100,
        background: 'rgba(231,190,110,0.16)',
        border: '1px solid rgba(231,190,110,0.35)',
      }}
    >
      <svg width={iconPx} height={iconPx} viewBox="0 0 24 24" fill="none" stroke={D.gold} strokeWidth="2" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="m9 12 2 2 4-4" />
      </svg>
      Verified
    </span>
  );
};

/** The empty states' one way out: what is on elsewhere. */
const BrowseNightsLink = () => (
  <Link to="/parties" style={{ display: 'inline-flex', alignItems: 'center', minHeight: 44, padding: '0 18px', borderRadius: 100, background: 'rgba(246,241,234,0.1)', border: '1px solid rgba(246,241,234,0.2)', color: D.cream, fontSize: 13, fontWeight: 700, textDecoration: 'none' }}>
    Browse upcoming nights
  </Link>
);

// Name, tags and link come ONLY from the people-badges mapping (badges.ts): a team strip is
// not a DJ thing, so the real name leads and the stage name shows in the DJ tag only (review
// M2); the link is DJ page, else dancer page, else none (a teacher-only member is plain,
// never a dead end). The organiser-authored title (organiser_team_members.role, e.g.
// "Founder") shows beside the tags when set; no 'Team' default (review 7d), and not when it
// only repeats a tag's word, nor when it is 'Leader': prod 2026-10-21 has every active team
// row at role='Leader' (a system default, not a title anyone authored).
// While the badges read loads or after it failed (`badgesState`), a member with a dancerId keeps
// the dancer page link, as ScheduleBlock's feedFallback does; the title waits for the read
// (loading: none, so it never flashes then hides on dedupe) and shows on error (no tags). A
// click emits a profile view typed by the role the link opens (data-contracts rule).
export const TeamCircle = ({ member, badge, badgesState = 'ready' }: { member: TeamMember; badge: PersonBadge | undefined; badgesState?: 'loading' | 'error' | 'ready' }) => {
  const opts = { teacherPagesOpen: flags.teacherDetail };
  const [imgFailed, setImgFailed] = useState(false);
  const tags = badge ? roleTagsFor(badge, { ...opts, withStageName: true }) : [];
  const shownName = nameFor('other', { name: member.name, djName: badge?.djName });
  const rawTitle = badgesState === 'loading' ? '' : (member.role ?? '').trim();
  const lowerTitle = rawTitle.toLowerCase();
  const title = rawTitle && lowerTitle !== 'leader' && !tags.some((t) => ROLE_LABEL[t.role].toLowerCase() === lowerTitle) ? rawTitle : null;
  const feedFallback = badgesState !== 'ready';
  const linkId = badge?.id ?? (feedFallback ? member.dancerId : null);
  const linkRole = badge ? linkRoleFor(badge, opts) : linkId ? 'dancer' : null;
  const href = linkId && linkRole ? hrefForRole(linkRole, linkId, opts) : null;
  const inner = (
    <div className="text-center">
      <div style={{ position: 'relative', aspectRatio: '1', borderRadius: '50%', padding: 2.5, background: 'linear-gradient(135deg,#FBEFC4,#E7BE6E,#FF6A2C)', marginBottom: 6 }}>
        <div style={{ width: '100%', height: '100%', borderRadius: '50%', background: 'radial-gradient(circle at 40% 35%,#33202c,#120c14)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
          {member.avatarUrl && !imgFailed ? (
            <img src={optimizedImageUrl(member.avatarUrl, srcWidthFor(112))} alt={member.name} width={112} height={112} className="w-full h-full object-cover" loading="lazy" onError={() => setImgFailed(true)} />
          ) : (
            <span style={{ fontFamily: SERIF, fontSize: 'clamp(16px,2.5vw,26px)', color: 'rgba(251,239,196,0.8)' }}>{initials(member.name)}</span>
          )}
        </div>
        {/* The circle is fluid (about 100px on a phone); 80 keeps the flag inside the page gutter. */}
        <NationalityFlag code={member.nationalityCode} size={80} />
      </div>
      <div data-team-name style={{ fontFamily: SERIF, fontSize: 14, fontWeight: 600, color: D.cream, lineHeight: 1.2, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' as const, overflowWrap: 'break-word' }}>{shownName}</div>
      {(tags.length > 0 || title) && (
        <div className="flex flex-wrap justify-center" style={{ gap: 4, marginTop: 4 }}>
          {title && <span data-team-title style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, color: D.cream, padding: '2px 0', overflowWrap: 'anywhere' }}>{title}</span>}
          {tags.map((t) => (
            <span key={t.role} data-team-tag={t.role} style={{ fontSize: 12, fontWeight: 700, lineHeight: 1.2, color: D.gold, border: '1px solid rgba(231,190,110,0.55)', borderRadius: 100, padding: '2px 8px' }}>{t.label}</span>
          ))}
        </div>
      )}
    </div>
  );
  return href && linkId ? (
    <Link to={href} onClick={() => emitProfileView({ personId: linkId, profileType: linkRole, context: 'organiser:team' })} style={{ display: 'block', minHeight: 44 }}>{inner}</Link>
  ) : <div>{inner}</div>;
};

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
  const venue = event.location?.trim() || event.city?.trim() || '';
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
  const [isEditOpen, setIsEditOpen] = useState(false);
  // Set by the lazy owner layer (null for everyone else): pencils + drafted values.
  const [eip, setEip] = useState<EipBridge | null>(null);
  // Owner layer only: the name's box hugs its widest line so the Name pencil sits right beside the text.
  const nameRef = useHugText(!!eip);
  const [isSaving, setIsSaving] = useState(false);
  const [showAllUpcoming, setShowAllUpcoming] = useState(false);
  const [openSeriesEventId, setOpenSeriesEventId] = useState<string | null>(null);
  const [showAllPastYears, setShowAllPastYears] = useState(false);
  const [aboutExpanded, setAboutExpanded] = useState(false);
  const [expandedPastYears, setExpandedPastYears] = useState<Set<string>>(() => new Set());
  const [editForm, setEditForm] = useState({
    name: '',
    avatar_url: '',
    bio: '',
    city: '',
    instagram: '',
    facebook: '',
    website: '',
    organisation_category: '',
    founded_year: '',
  });
  // Contact details (phone, and the two public switches, admin #771) are NOT in
  // this dialog: the owner layer's Contact card opens the ONE Contact details
  // sheet (edit-in-place/ContactSheet.tsx). This dialog never sends a contact key
  // (above all never the legacy show_contact_publicly, which sets BOTH flags).
  const openedFormRef = useRef<string | null>(null);

  const { data: entity, isLoading, error } = useQuery({
    queryKey: organiserEntityQueryKey(id),
    queryFn: () => fetchOrganiserEntity(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  // A page that is not found (retired, archived, or never existed) is kept out of search.
  useNoindexMeta(!isLoading && (!!error || !entity));

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
  // The WhatsApp / email buttons: both null unless the organiser is live AND
  // show_contact_publicly. An error degrades to "no contact shown".
  const { data: publicContact = NO_PUBLIC_CONTACT, isLoading: publicContactLoading } = useQuery({
    queryKey: organiserPublicContactQueryKey(id),
    queryFn: () => fetchPublicContact(id as string),
    enabled: !!id && !!entity,
    staleTime: 5 * 60 * 1000,
  });

  // The ONE place that turns those answers into badge / card / claim button /
  // edit access (ownership.ts); nothing below re-derives any of them.
  const facts = ownershipFacts({ flagOn: flags.organiserSelfServe, signedIn: !!user, ownership, hint: claimHint, hintLoading: claimHintLoading });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { rgb: [cr, cg, cb], ready: heroColourReady } = useAverageColor((entity as any)?.avatar_url ?? null);
  const HERO_BG = heroBg(cr, cg, cb);

  const { data: allEvents = [], isLoading: allEventsLoading } = useQuery({
    queryKey: organiserEventsQueryKey(id),
    queryFn: () => fetchOrganiserEvents(id as string),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const { data: futureOccs = [], isLoading: futureOccsLoading } = useQuery({
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
  const { data: pastOccs = [], isLoading: pastOccsLoading } = useQuery({
    queryKey: organiserOccEventsPastQueryKey(id),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
    queryFn: () => fetchOrganiserPastOccEvents(id as string),
  });

  const { data: teamMembers = [], isLoading: teamMembersLoading } = useQuery({
    // The public line-up (organiser_team_members), NOT organiser_team_v1's access team,
    // whose key is ['organiser-team', id] (teamRpcApi): sharing it fed this array to the
    // owner layer's team read, so the Team card never showed.
    queryKey: ['organiser-lineup', id],
    queryFn: async (): Promise<TeamMember[]> => {
      if (!id) return [];
      const { data: teamRows, error } = await supabase
        .from('organiser_team_members')
        .select('id, role, is_head, is_leader, sort_order, member_profile_id, is_active')
        .eq('organiser_profile_id', id)
        .eq('is_active', true)
        .order('sort_order', { ascending: true, nullsFirst: false });
      if (error) { console.error('Organiser team fetch error:', error); return []; }
      if (!teamRows?.length) return [];
      const memberIds = teamRows.map((r) => r.member_profile_id);
      const { data: dancerRows } = await supabase
        .from('dancer_profiles')
        .select('id, first_name, avatar_url, nationality')
        .in('id', memberIds);
      type DancerRow = { id: string; first_name: string | null; surname: string | null; display_name: string | null; public_name?: string | null; avatar_url: string | null; nationality: string | null };
      const maskedRows = await withPublicNames((dancerRows ?? []) as Array<Pick<DancerRow, 'id' | 'first_name' | 'avatar_url' | 'nationality'>>);
      const dancerMap = new Map<string, DancerRow>(maskedRows.map((d) => [d.id, d as unknown as DancerRow]));
      return teamRows.map((t) => {
        const d = dancerMap.get(t.member_profile_id);
        const name = resolvePublicName({ public_name: d?.public_name, display_name: d?.display_name, first_name: d?.first_name, surname: d?.surname }) || 'Team member';
        return { id: t.id, memberId: t.member_profile_id, dancerId: d?.id ?? null, name, avatarUrl: d?.avatar_url ?? null, nationalityCode: pickNationalityCode(d), role: t.role, isHead: t.is_head, isLeader: t.is_leader };
      });
    },
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const leader = useMemo(() => {
    if (!teamMembers.length) return null;
    return teamMembers.find((m) => m.isHead) || teamMembers.find((m) => m.isLeader) || teamMembers[0];
  }, [teamMembers]);

  const { badges: teamBadges, isLoading: teamBadgesLoading, isError: teamBadgesError } = usePeopleBadges(useMemo(() => teamMembers.map((m) => m.dancerId ?? '').filter(Boolean), [teamMembers]));
  const teamBadgesState = teamBadgesLoading ? 'loading' : teamBadgesError ? 'error' : 'ready';

  const orderedTeam = useMemo(
    () => (leader ? [leader, ...teamMembers.filter((m) => m.id !== leader.id)] : teamMembers),
    [teamMembers, leader],
  );

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
      upcoming.push({ ...e, name: occ.name || e.name, poster_url: poster, location: occ.location ?? e.location, displayStart: asWallClockOrNull(occ.start_time ?? occ.instance_date), occurrenceId: occ.occurrence_id });
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
      past.push({ ...e, name: occ.name || e.name, poster_url: poster, location: occ.location ?? e.location, displayStart: asWallClockOrNull(startRaw), occurrenceId: occ.occurrence_id });
    }
    // Base-date fallback only for legacy events the occurrence feed never
    // surfaced (no future AND no past occurrence row at all). EventRow.start_time
    // / .date stay RAW strings -- their semantics are genuinely mixed and this
    // fallback is unreachable on live data (0 of 15 organisers sampled); displayStart
    // is branded at the push.
    const eventsWithAnyOcc = new Set<string>([...eventsWithFutureOcc, ...pastOccs.map((o) => o.event_id)]);
    for (const e of allEvents) {
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
  }, [allEvents, futureOccs, pastOccs, todayMs]);

  const totalEventsCount = allEvents.length;

  const sinceYear = useMemo(() => {
    // Wall-clock strings sort lexically same as chronologically (yyyy-MM-dd...),
    // so the earliest key is found by string comparison -- no Date math, no TZ.
    let earliestKey: string | null = null;
    for (const e of allEvents) {
      const wc = asWallClockOrNull(e.start_time ?? e.date);
      const key = formatWallClockLocal(wc, "yyyy-MM-dd'T'HH:mm");
      if (!key) continue;
      if (earliestKey === null || key < earliestKey) earliestKey = key;
    }
    return earliestKey === null ? null : Number(earliestKey.slice(0, 4));
  }, [allEvents]);

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
  const openEditModal = () => {
    if (!entity || !id || !facts.canEdit) return;
    const ep = entity as EntityProfile;
    const socials = ep.socials as { instagram?: string; website?: string; facebook?: string } | null;
    const base = {
      name: entity.name || '',
      avatar_url: entity.avatar_url || '',
      bio: entity.bio || '',
      city: entity.cities?.name || '',
      instagram: ep.instagram || socials?.instagram || '',
      facebook: ep.facebook || socials?.facebook || '',
      website: ep.website || socials?.website || '',
      organisation_category: ep.organisation_category || '',
      founded_year: ep.founded_year ? String(ep.founded_year) : '',
    };
    setEditForm(base);
    openedFormRef.current = JSON.stringify(base);
    setIsEditOpen(true);
  };

  const handleSave = async () => {
    if (!id || !user?.id || !facts.canEdit) return;
    const city = normalizeRequiredCity(editForm.city);
    if (!hasRequiredCity(city)) {
      toast({ title: 'City is required', description: 'Please add city before saving.', variant: 'destructive' });
      return;
    }
    // Saving an untouched form sends nothing.
    if (openedFormRef.current !== null && JSON.stringify(editForm) === openedFormRef.current) {
      toast({ title: 'Nothing to save', description: 'You haven\u2019t changed anything.' });
      setIsEditOpen(false);
      return;
    }
    if (!isValidInstagramUrl(editForm.instagram)) {
      toast({ title: 'Invalid Instagram', description: 'Please enter a valid Instagram handle or URL.', variant: 'destructive' });
      return;
    }
    if (!isValidFacebookUrl(editForm.facebook)) {
      toast({ title: 'Invalid Facebook', description: 'Please enter a valid Facebook handle or URL.', variant: 'destructive' });
      return;
    }
    if (!isValidWebsiteUrl(editForm.website)) {
      toast({ title: 'Invalid website', description: 'Please enter a valid website URL.', variant: 'destructive' });
      return;
    }
    setIsSaving(true);
    try {
      const canonicalCity = await resolveCanonicalCity(city);
      if (!canonicalCity) {
        toast({ title: 'Select a valid city', description: 'Please choose city from the city picker list.', variant: 'destructive' });
        return;
      }
      // No contact key: the form carries none, so the patch leaves the phone and both flags alone.
      const { error } = await saveOrganiserProfile(supabase, id, editForm, canonicalCity.cityId);
      if (error) throw error;
      toast({ title: 'Profile updated' });
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: organiserEntityQueryKey(id) });
    } catch (err) {
      console.error('Save error:', err);
      toast({ ...organiserProfileSaveErrorToast(err), variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

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

  // --- Not found ---
  if (error || !entity) {
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
  const socials          = ep.socials as { instagram?: string; website?: string; facebook?: string } | null;
  const instagramRaw     = ep.instagram  || socials?.instagram  || null;
  const websiteRaw       = ep.website    || socials?.website    || null;
  const facebookRaw      = ep.facebook   || socials?.facebook   || null;
  const contactPhone     = publicContact.contact_phone;
  const contactEmail     = publicContact.contact_email;
  const organisationCategory = ep.organisation_category || null;

  // Reuses withNormalizedProtocol (defined above with the validators) so the
  // rendered href can never disagree with what isValidInstagramUrl /
  // isValidFacebookUrl / isValidWebsiteUrl accepted at save time.
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
  const facebookUrl  = facebookRaw
    ? (hostMatchesDomain(facebookRaw, 'facebook.com')
        ? withNormalizedProtocol(facebookRaw, 'facebook.com')
        : /^https?:\/\//i.test(facebookRaw)
          ? null
          : `https://facebook.com/${facebookRaw.replace('@', '')}`)
    : null;
  const whatsappUrl = buildWhatsAppHref(contactPhone);
  const mailtoHref = buildMailtoHref(contactEmail);

  const hasContact = !!(instagramUrl || facebookUrl || websiteUrl || whatsappUrl || mailtoHref);

  const emptyKind = organiserEmptyState({
    loading: allEventsLoading || futureOccsLoading || pastOccsLoading || teamMembersLoading || publicContactLoading,
    upcoming: upcomingListItems.length,
    past: pastEvents.length,
    hasBio: !!entity.bio?.trim(),
    hasContact,
    team: orderedTeam.length,
    isOwner: facts.isOwner,
  });
  // W7: the badge and the "Is this you?" card come from `facts` (computed above,
  // behind the self-serve flag, off in production until launch).
  const claimUser = user ? { id: user.id, email: user.email } : null;
  const publicPath = `/organisers/${resolved.slug ?? routeParam ?? ''}`;

  // ep, not entity: an owner's drafted City shows in place.
  const cityName = ep.cities?.name ?? ep.city ?? null;
  const metaLine = [organisationCategory, cityName].filter(Boolean).join(' \u00b7 ');

  const foundedYear = (ep.founded_year as number | null | undefined) ?? null;
  // estYear falls back to the earliest listed event's year when the organiser
  // hasn't told us when they started -- that's an estimate, not a fact, so it
  // carries its own flag through to the stat display below.
  const estYear         = foundedYear ?? (sinceYear !== null && sinceYear < new Date().getFullYear() ? sinceYear : null);
  const estYearInferred = foundedYear === null && estYear !== null;
  const yearsActive     = estYear !== null ? new Date().getFullYear() - estYear : null;

  const thirdStatValue = orderedTeam.length > 0 ? orderedTeam.length : (yearsActive !== null ? `${estYearInferred ? '~' : ''}${yearsActive}` : '--');
  const thirdStatLabel = orderedTeam.length > 0 ? 'Team members' : yearsActive !== null ? 'Yrs active' : 'Since';
  const thirdStatTitle = orderedTeam.length === 0 && yearsActive !== null && estYearInferred
    ? `Estimated from the earliest listed event (${estYear}) -- not a confirmed founding date`
    : undefined;


  // First sentence of the bio for the hero tagline (original behaviour).
  const bioParts = ep.bio ? ep.bio.split(/\.\s+/) : [];
  const heroTagline = bioParts.length > 0 ? `${bioParts[0]}${bioParts.length > 1 ? '.' : ''}` : null;
  // A long bio is clamped to 3 lines in About with a More toggle.
  const aboutIsLong = (ep.bio?.length ?? 0) > 180;

  // Email is always offered -- it used to vanish on desktop whenever a
  // WhatsApp number existed.
  // The extract* helpers return the platform name when no handle is found;
  // avoid announcing "Instagram Instagram".
  const labelWithHandle = (platform: string, handle: string | null | undefined) =>
    handle && handle !== platform ? `${platform} ${handle}` : platform;
  const igHandle = instagramUrl ? extractIgHandle(instagramRaw) : null;
  const fbHandle = facebookUrl ? extractFbHandle(facebookRaw) : null;
  const siteDomain = websiteUrl ? extractDomain(websiteRaw) : null;
  // Contact list: icon tile + small label + value + copy button per row, then
  // labelled social pills underneath (reference: choiceqr venue page).
  // navigator.clipboard is undefined on plain-HTTP origins and some in-app
  // browsers; say so rather than letting the tap do nothing.
  const copyValue = (value: string, noun: string) => {
    const failed = () => toast({ title: `Couldn't copy the ${noun}`, variant: 'destructive' });
    if (!navigator.clipboard?.writeText) { failed(); return; }
    navigator.clipboard.writeText(value).then(() => toast({ title: `${noun.charAt(0).toUpperCase()}${noun.slice(1)} copied` }), failed);
  };
  const iconTile: React.CSSProperties = { width: 44, height: 44, borderRadius: 10, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(246,241,234,0.06)', color: D.cream, flexShrink: 0 };
  const rowLabel: React.CSSProperties = { fontSize: 12, color: 'rgba(246,241,234,0.6)', fontWeight: 600, margin: 0 };
  const rowValue: React.CSSProperties = { fontSize: 14, color: D.cream, textDecoration: 'none', wordBreak: 'break-word' };
  const copyBtn: React.CSSProperties = { width: 44, height: 44, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', border: 'none', color: D.gold, cursor: 'pointer', flexShrink: 0 };
  const socialPill: React.CSSProperties = { height: 44, display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 14px', borderRadius: 10, fontSize: 14, color: D.cream, textDecoration: 'none' };
  const copyIcon = <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>;
  const contactItems = [
    whatsappUrl && contactPhone ? { key: 'wa', label: 'WhatsApp', copyNoun: 'WhatsApp number', value: contactPhone.trim(), href: whatsappUrl, external: true, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><path d="M3 21l1.7-5A8 8 0 1 1 8 19.3z"/></svg> } : null,
    mailtoHref && contactEmail ? { key: 'email', label: 'Email', copyNoun: 'email address', value: contactEmail.trim(), href: mailtoHref, external: false, icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/></svg> } : null,
  ].filter((x): x is NonNullable<typeof x> => x !== null);
  const hasSocials = !!(instagramUrl || facebookUrl || websiteUrl);
  const contactRow = hasContact ? (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 480 }}>
      {contactItems.map((c) => (
        <div key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={c.key === 'wa' ? { ...iconTile, color: '#25D366', background: 'rgba(37,211,102,0.12)' } : iconTile}>{c.icon}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={rowLabel}>{c.label}</p>
            <a href={c.href} {...(c.external ? { target: '_blank', rel: 'noopener noreferrer' } : {})} className="rounded-sm hover:underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400" style={rowValue}>{c.value}</a>
          </div>
          <button type="button" onClick={() => copyValue(c.value, c.copyNoun)} aria-label={`Copy ${c.copyNoun}`} className="rounded-lg bg-transparent transition-colors hover:bg-white/5 active:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400" style={copyBtn}>{copyIcon}</button>
        </div>
      ))}
      {hasSocials && (
        <>
          <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 16, margin: '8px 0 0', color: D.cream }}>Online</h2>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {instagramUrl && (
              <a href={instagramUrl} target="_blank" rel={PUBLIC_LINK_REL} aria-label={labelWithHandle('Instagram', igHandle)} className="bg-white/[0.06] transition-colors hover:bg-white/10 active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400" style={socialPill}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1.2" fill="currentColor"/></svg>
                Instagram
              </a>
            )}
            {facebookUrl && (
              <a href={facebookUrl} target="_blank" rel={PUBLIC_LINK_REL} aria-label={labelWithHandle('Facebook', fbHandle)} className="bg-white/[0.06] transition-colors hover:bg-white/10 active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400" style={socialPill}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M14 9h3V6h-3c-1.7 0-3 1.3-3 3v2H8.5v3H11v7h3v-7h2.4l.6-3H14V9z"/></svg>
                Facebook
              </a>
            )}
            {websiteUrl && (
              <a href={websiteUrl} target="_blank" rel={PUBLIC_LINK_REL} aria-label={labelWithHandle('Website', siteDomain)} className="bg-white/[0.06] transition-colors hover:bg-white/10 active:bg-white/15 focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber-400" style={socialPill}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 3 2.5 15 0 18M12 3c-2.5 3-2.5 15 0 18"/></svg>
                {siteDomain && siteDomain !== 'Website' ? siteDomain : 'Website'}
              </a>
            )}
          </div>
        </>
      )}
    </div>
  ) : null;

  const sectionH2: React.CSSProperties = { fontFamily: SERIF, fontWeight: 600, fontSize: 16, lineHeight: 1.3, margin: 0, color: D.cream };
  const sectionCount: React.CSSProperties = { fontSize: 12, color: 'rgba(246,241,234,0.6)', fontWeight: 600 };
  const moreBtn: React.CSSProperties = { display: 'block', width: '100%', minHeight: 44, padding: '10px', background: 'none', border: 'none', color: D.gold, fontSize: 13, fontWeight: 700, cursor: 'pointer', letterSpacing: '0.04em' };

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
              profile still offers "Complete your profile" below. */}

          {/* Mobile */}
          {(isMobile !== false) && <div style={{ position: 'relative', minHeight: 320, height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 26, paddingLeft: 24, paddingRight: 24, textAlign: 'center' }}>
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <AvatarCircle avatarUrl={ep.avatar_url ?? null} name={ep.name} sizePx={104} fontSize={40} />
              {eip?.slot('photo')}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, marginBottom: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
              {metaLine && !eip && <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase' as const, color: D.gold }}>{metaLine}</span>}
              {eip?.slot('meta')}
              {ep.is_verified && <VerifiedBadge size="sm" />}
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
            {heroTagline && (
              <p style={{ margin: 0, fontSize: 13, color: 'rgba(246,241,234,0.78)', fontWeight: 500, lineHeight: 1.4 }}>
                {heroTagline}
              </p>
            )}
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
                  {ep.is_verified && <VerifiedBadge size="md" />}
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
                {heroTagline && (
                  <p style={{ margin: 0, fontSize: 18, color: 'rgba(246,241,234,0.78)', fontWeight: 500 }}>
                    {heroTagline}
                  </p>
                )}
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

        {/* Stats strip */}
        <div className="flex justify-around py-3 px-5" style={{ position: 'relative', zIndex: 1, borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
          {[
            { value: totalUpcomingDateCount,   label: 'Upcoming dates',  title: undefined, href: upcomingListItems.length > 0 ? 'upcoming' : undefined },
            { value: pastEvents.length,        label: 'Past nights',     title: undefined, href: pastEvents.length > 0 ? 'past' : undefined },
            { value: thirdStatValue,           label: thirdStatLabel,    title: thirdStatTitle, href: undefined },
          ].map((s) => {
            const body = (
              <>
                <div style={{ fontFamily: SERIF, fontSize: 26, fontWeight: 600, color: D.cream, lineHeight: 1 }}>{s.value}</div>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' as const, color: D.gold, marginTop: 4 }}>{s.label}</div>
              </>
            );
            return s.href ? (
              <button key={s.label} type="button" onClick={() => scrollToId(s.href!)} style={{ textAlign: 'center', minHeight: 44, padding: '2px 6px', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer' }}>{body}</button>
            ) : (
              <div key={s.label} style={{ textAlign: 'center', padding: '2px 6px' }} title={s.title}>{body}</div>
            );
          })}
        </div>

        {/* CONTACT -- one quiet row under the stats */}
        {contactRow && (
          <div className="flex flex-col items-center gap-2 px-5 py-3 md:items-start md:px-12" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            {contactRow}
          </div>
        )}
        {eip?.slot('contact')}
        {eip?.slot('links')}
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

        {/* EMPTY STATES -- one decision (organiserEmptyState): nothing upcoming
            always says so and offers somewhere to go, whatever else the profile
            has. The owner of a wholly blank profile is offered "Complete your
            profile" too (the form dialog; the hero has no Edit profile button).

            The owner layer adds its Create event link beside "Browse upcoming
            nights" (and beside "Complete your profile"); it is only loaded for an
            owner or manager.

            Gated on all four content queries having settled (not just the
            `entity` query, which resolves first as a single-row fetch) --
            otherwise a well-populated organiser flashes this on every cold
            load, before allEvents/futureOccs/pastOccs/teamMembers (four
            independent, slower queries) have had a chance to come back. */}
        {emptyKind === 'owner-blank' && (
          <section className="px-5 md:px-12 py-8 md:py-10 text-center" data-testid="org-public-empty" data-kind={emptyKind}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.18em', textTransform: 'uppercase' as const, color: D.gold, margin: '0 0 12px' }}>Your profile</p>
            <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(22px,4vw,30px)', color: D.cream, margin: '0 0 10px' }}>Just getting started</h2>
            <p style={{ fontSize: 14, color: 'rgba(246,241,234,0.6)', maxWidth: 420, margin: '0 auto 22px', lineHeight: 1.5 }}>
              Add a bio, photo and your social links so dancers know who you are before your first night goes up.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              <button onClick={openEditModal} style={{ minHeight: 44, padding: '0 18px', borderRadius: 100, background: D.gold, color: D.black, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer' }}>
                Complete your profile
              </button>
              {eip?.slot('create-first-event')}
            </div>
          </section>
        )}
        {emptyKind === 'none' && (
          <section className="px-5 md:px-12 py-8 md:py-10 text-center" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="org-public-empty" data-kind={emptyKind}>
            <h2 style={{ fontFamily: SERIF, fontWeight: 600, fontSize: 'clamp(22px,4vw,30px)', color: D.cream, margin: '0 0 10px' }}>No nights listed yet</h2>
            <p style={{ fontSize: 14, color: 'rgba(246,241,234,0.75)', maxWidth: 420, margin: '0 auto 22px', lineHeight: 1.5 }}>
              {ep.name} hasn&rsquo;t listed any nights here yet.{' '}
              {hasContact ? 'Follow them with the links above for news, or see' : 'Check back soon, or see'} what&rsquo;s on elsewhere in London.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              <BrowseNightsLink />
              {eip?.slot('create-first-event')}
            </div>
          </section>
        )}
        {emptyKind === 'past-only' && (
          <section className="px-5 md:px-12 py-5 md:py-6 text-center" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }} data-testid="org-public-empty" data-kind={emptyKind}>
            <h2 style={{ ...sectionH2, marginBottom: 6 }}>No upcoming nights</h2>
            <p style={{ fontSize: 14, color: 'rgba(246,241,234,0.75)', maxWidth: 420, margin: '0 auto 14px', lineHeight: 1.5 }}>
              {ep.name} has nothing on the calendar right now.{' '}
              {hasContact ? 'Follow them with the links above for new dates, or see' : 'See'} what&rsquo;s on elsewhere in London.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              <BrowseNightsLink />
              {eip?.slot('create-another-event')}
            </div>
          </section>
        )}

        {/* UPCOMING EVENTS */}
        {upcomingListItems.length > 0 && (
          <section id="upcoming" className="px-5 md:px-12 py-4 md:py-6 scroll-mt-16" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            {/* Wraps at 360px: the owner's Create event link goes under the count rather than off the screen. */}
            <div style={{ display: 'flex', alignItems: eip ? 'center' : 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
              <h2 style={sectionH2}>Upcoming events</h2>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', gap: 8, marginLeft: 'auto' }}>
                <span style={sectionCount}>{totalUpcomingDateCount} {totalUpcomingDateCount === 1 ? 'date' : 'dates'}</span>
                {eip?.slot('create-event')}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {visibleItems.map((item, i) =>
                item.kind === 'single' ? (
                  <EventRowCard key={stableRowKey(item.event.occurrenceId, item.event.id, i)} impressionRef={trackImpression(item.event.id)} {...buildEventRowProps(item.event, todayKey, i)} />
                ) : (
                  <EventRowCard
                    key={item.eventId}
                    impressionRef={trackImpression(item.eventId)}
                    {...buildEventRowProps(item.dates[0], todayKey, i, {
                      name: item.name,
                      posterUrl: item.posterUrl,
                      meta: [countdownLabel(item.dates[0].displayStart, todayKey), item.location].filter(Boolean).join(' · '),
                      chip: `${item.dates.length} dates`,
                      onClick: () => setOpenSeriesEventId(item.eventId),
                    })}
                  />
                ),
              )}
            </div>
            {upcomingListItems.length > UPCOMING_VISIBLE && (
              <button onClick={() => { if (showAllUpcoming) scrollBackIfAbove('upcoming'); setShowAllUpcoming((v) => !v); }} aria-expanded={showAllUpcoming} style={moreBtn}>
                {showAllUpcoming ? 'Show fewer' : `Show all ${totalUpcomingDateCount} dates`}
              </button>
            )}
          </section>
        )}

        {/* ABOUT -- below the events: a regular came for dates, not the bio */}
        {(ep.bio || eip) && (
          <section className="px-5 md:px-12 py-4 md:py-6" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            <h2 style={{ ...sectionH2, marginBottom: 8 }}>About{eip?.slot('about')}</h2>
            {ep.bio ? <p
              className={cn('text-sm', !aboutExpanded && aboutIsLong && 'line-clamp-3', eip?.mark('bio'))}
              style={{ lineHeight: 1.55, color: 'rgba(246,241,234,0.85)', margin: 0, maxWidth: 680, whiteSpace: 'pre-line' }}
            >
              {ep.bio}
            </p> : eip?.slot('about-empty')}
            {aboutIsLong && (
              <button onClick={() => setAboutExpanded((v) => !v)} aria-expanded={aboutExpanded} style={{ ...moreBtn, display: 'inline-block', width: 'auto', padding: '10px 0', textAlign: 'left' }}>
                {aboutExpanded ? 'Show less' : 'More'}
              </button>
            )}
          </section>
        )}

        {/* TEACHERS & DJs */}
        {orderedTeam.length > 0 && (
          <section className="px-5 md:px-12 py-4 md:py-6" style={{ borderBottom: '1px solid rgba(246,241,234,0.08)' }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={sectionH2}>Teachers &amp; DJs</h2>
              <span style={sectionCount}>{orderedTeam.length} {orderedTeam.length === 1 ? 'member' : 'members'}</span>
            </div>
            {/* px-3: the nationality sticker stands out past each circle's top-right, so the
                last column needs room before the page's overflow-x-clip edge. */}
            <div className={orderedTeam.length <= 3 ? 'flex justify-center gap-3 px-3' : 'grid grid-cols-3 gap-3 px-3 lg:grid-cols-8'}>
              {orderedTeam.map((m) => <div key={m.id} className={cn('min-w-0 max-w-[112px]', orderedTeam.length <= 3 ? 'basis-1/3' : 'mx-auto w-full')}><TeamCircle member={m} badge={teamBadges.get(m.dancerId ?? '')} badgesState={teamBadgesState} /></div>)}
            </div>
          </section>
        )}

        {/* PAST EVENTS */}
        {pastEvents.length > 0 && (
          <section id="past" className="px-5 md:px-12 py-4 md:py-6 scroll-mt-16">
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 12 }}>
              <h2 style={sectionH2}>Past nights</h2>
              <span style={sectionCount}>{pastEvents.length} hosted</span>
            </div>
            <div className="flex max-w-3xl flex-col gap-2">
              {visiblePastYears.map((group, gi) => { const shown = expandedPastYears.has(group.year) ? group.events : group.events.slice(0, PAST_ROWS_PER_YEAR); return (
                <details key={group.year} id={`past-${group.year}`} open={gi === 0} className="scroll-mt-16 rounded-2xl border" style={{ borderColor: 'rgba(246,241,234,0.08)', padding: '0 12px' }}>
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
            {pastByYear.length > PAST_YEARS_VISIBLE && (
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

      {/* EDIT DIALOG */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Edit profile</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} placeholder="Organiser name" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="organisation_category">Category</Label>
              <Input id="organisation_category" value={editForm.organisation_category} onChange={(e) => setEditForm({ ...editForm, organisation_category: e.target.value })} placeholder="Event Brand, Dance School, Community Group..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="founded_year">Founded year</Label>
              <Input id="founded_year" type="number" inputMode="numeric" value={editForm.founded_year} onChange={(e) => setEditForm({ ...editForm, founded_year: e.target.value })} placeholder="e.g. 2015" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="avatar_url">Avatar URL</Label>
              <Input id="avatar_url" value={editForm.avatar_url} onChange={(e) => setEditForm({ ...editForm, avatar_url: e.target.value })} placeholder="https://..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="city">City</Label>
              <CityPicker id="city" value={editForm.city} onChange={(city) => setEditForm({ ...editForm, city })} placeholder="Select city..." />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea id="bio" value={editForm.bio} onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })} placeholder="About this organiser..." rows={4} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="instagram">Instagram</Label>
              <Input id="instagram" value={editForm.instagram} onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })} placeholder="@username or full URL" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="facebook">Facebook</Label>
              <Input id="facebook" value={editForm.facebook} onChange={(e) => setEditForm({ ...editForm, facebook: e.target.value })} placeholder="Page URL or username" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="website">Website</Label>
              <Input id="website" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} placeholder="https://..." />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setIsEditOpen(false)} disabled={isSaving}>Cancel</Button>
              <Button onClick={handleSave} disabled={isSaving || !editForm.name.trim()}>
                {isSaving && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
