import { Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, X, CalendarDays, MapPin, Star, Building2, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { Skeleton } from '@/components/ui/skeleton';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';

/* eslint-disable @typescript-eslint/no-explicit-any */

const ACCENT      = '#d3a84c';
const MUTED       = '#c4b89a';
const CARD_BG     = 'rgba(42,22,34,0.55)';
const CARD_HOVER  = 'rgba(55,28,42,0.75)';
const CARD_BORDER = 'rgba(211,168,76,0.28)';
const CARD_BORDER_HOVER = 'rgba(211,168,76,0.60)';
const RULE_GRAD   = `linear-gradient(90deg, ${CARD_BORDER}, transparent)`;

const hueFromId = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
};
const avatarColor = (id: string) => `hsl(${hueFromId(id)} 55% 62%)`;

const initials = (name: string) =>
  name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0] ?? '')
    .join('')
    .toUpperCase();

type OrgRow = {
  id: string;
  slug: string | null;
  name: string;
  avatar_url: string | null;
  bio: string | null;
  organisation_category: string | null;
  city_id?: string;
  cities?: { name: string } | null;
};

type UpcomingOrg = OrgRow & { daysUntil: number; nextLabel: string };

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2.5 mb-2.5">
      <span
        className="text-[11px] font-semibold whitespace-nowrap leading-none"
        style={{ color: ACCENT }}
      >
        {children}
      </span>
      <div className="flex-1 h-px" style={{ background: RULE_GRAD }} />
    </div>
  );
}

function OrgPill({
  org,
  statusLabel,
  showPulse = false,
}: {
  org: OrgRow;
  statusLabel: string;
  showPulse?: boolean;
}) {
  const href = org.slug ? `/organisers/${org.slug}` : `/organisers/${org.id}`;
  const color = avatarColor(org.id);

  return (
    <Link
      to={href}
      className="flex items-center gap-2 rounded-full border px-2.5 py-1.5 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400 active:scale-95"
      style={{ background: CARD_BG, borderColor: CARD_BORDER }}
      onMouseEnter={(e) => {
        (e.currentTarget as HTMLElement).style.background = CARD_HOVER;
        (e.currentTarget as HTMLElement).style.borderColor = CARD_BORDER_HOVER;
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLElement).style.background = CARD_BG;
        (e.currentTarget as HTMLElement).style.borderColor = CARD_BORDER;
      }}
    >
      <div className="relative flex-none w-9 h-9">
        <div
          className="w-9 h-9 rounded-full flex items-center justify-center overflow-hidden text-[11px] font-black relative"
          style={{ border: `1.5px solid ${color}`, color }}
        >
          <div
            className="absolute inset-0 rounded-full"
            style={{ background: color, opacity: 0.1 }}
          />
          {org.avatar_url ? (
            <img
              src={org.avatar_url}
              alt={org.name}
              className="relative z-10 w-full h-full object-cover"
            />
          ) : (
            <span className="relative z-10">{initials(org.name)}</span>
          )}
        </div>
        {showPulse && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{ background: color, borderColor: 'rgba(42,22,34,0.9)' }}
          >
            <span
              className="absolute inset-0 rounded-full animate-ping opacity-60"
              style={{ background: color }}
            />
          </span>
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className="text-[12px] font-bold leading-tight truncate" style={{ color: '#f4f2ee' }}>
          {org.name}
        </div>
        <div className="text-[10px] truncate mt-0.5" style={{ color: MUTED }}>
          {org.organisation_category ?? 'Organiser'}
        </div>
        <div
          className="text-[10px] font-semibold font-mono truncate mt-0.5"
          style={{ color: ACCENT }}
        >
          {statusLabel}
        </div>
      </div>
    </Link>
  );
}

const Organisers = () => {
  useSeo(buildSeoForRoute('organisers'));
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const searchFilter = searchParams.get('search')?.trim() || null;

  const { data: organisers = [], isLoading } = useQuery({
    queryKey: ['entities-organisers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('organiser_profiles')
        .select('id, slug, name, avatar_url, bio, organisation_category, city_id')
        .not('is_active', 'is', false)
        .order('name');
      if (error) throw error;

      if (data && data.length > 0) {
        const cityIds = [...new Set((data as any[]).map((o) => o.city_id).filter(Boolean))];
        let cityMap: Record<string, { name: string }> = {};
        if (cityIds.length > 0) {
          const { data: cities } = await supabase
            .from('cities')
            .select('id, name')
            .in('id', cityIds);
          if (cities) {
            cityMap = Object.fromEntries((cities as any[]).map((c) => [c.id, { name: c.name }]));
          }
        }
        return (data as any[]).map((org) => ({
          ...org,
          cities: org.city_id ? cityMap[org.city_id] : null,
        })) as OrgRow[];
      }
      return (data ?? []) as unknown as OrgRow[];
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: eventCounts = {} } = useQuery({
    queryKey: ['organiser-event-counts-all'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_organiser_event_counts' as any, {
        p_city_slug: null,
      });
      if (error) return {} as Record<string, number>;
      const counts: Record<string, number> = {};
      (data as any[] | null)?.forEach((item) => {
        if (item?.entity_id) counts[item.entity_id] = item.event_count ?? 0;
      });
      return counts;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: nextEventDates = {} } = useQuery({
    queryKey: ['organiser-next-event-dates'],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_organiser_next_event_dates' as any);
      if (error) return {} as Record<string, string>;
      const dates: Record<string, string> = {};
      (data as any[] | null)?.forEach((item) => {
        if (item?.entity_id && item?.next_event_date) {
          dates[item.entity_id] = item.next_event_date;
        }
      });
      return dates;
    },
    staleTime: 15 * 60 * 1000,
  });

  const filteredOrganisers = useMemo(() => {
    if (!searchFilter) return organisers;
    const needle = searchFilter.toLowerCase();
    return organisers.filter(
      (o) =>
        o.name.toLowerCase().includes(needle) ||
        (o.cities?.name ?? '').toLowerCase().includes(needle),
    );
  }, [organisers, searchFilter]);

  const { upcoming, recentlyActive, dormant } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayMs = today.getTime();

    const upcoming: UpcomingOrg[] = [];
    const recentlyActive: OrgRow[] = [];
    const dormant: OrgRow[] = [];

    filteredOrganisers.forEach((org) => {
      const nextDate = nextEventDates[org.id];
      if (nextDate) {
        const d = new Date(nextDate);
        d.setHours(0, 0, 0, 0);
        const days = Math.round((d.getTime() - todayMs) / 86_400_000);
        const nextLabel =
          days === 0 ? 'Tonight' : days === 1 ? 'Tomorrow' : `in ${days} days`;
        upcoming.push({ ...org, daysUntil: days, nextLabel });
      } else if ((eventCounts[org.id] ?? 0) > 0) {
        recentlyActive.push(org);
      } else {
        dormant.push(org);
      }
    });

    upcoming.sort((a, b) => a.daysUntil - b.daysUntil);
    recentlyActive.sort((a, b) => a.name.localeCompare(b.name));
    dormant.sort((a, b) => a.name.localeCompare(b.name));

    return { upcoming, recentlyActive, dormant };
  }, [filteredOrganisers, nextEventDates, eventCounts]);

  const handleSearch = (value: string) => {
    setSearchInput(value);
    const next = new URLSearchParams(searchParams);
    if (value.trim()) next.set('search', value.trim());
    else next.delete('search');
    setSearchParams(next, { replace: true });
  };

  const clearSearch = () => {
    setSearchInput('');
    const next = new URLSearchParams(searchParams);
    next.delete('search');
    setSearchParams(next, { replace: true });
  };

  const isEmpty = !isLoading && upcoming.length + recentlyActive.length + dormant.length === 0;

  return (
    <GlobalLayout
      breadcrumbs={buildBreadcrumbs('organisers')}
      gradientPalette="organiser"
      hero={{
        emoji: '\u{1F4CB}',
        titleWhite: 'Meet the',
        titleOrange: 'Organisers',
        subtitle: 'Find out who runs bachata near you.',
        highlightColor: 'text-amber-400',
        floatingIcons: [Users, CalendarDays, Music, MapPin, Star, Building2],
      }}
    >
      <div className="px-4 pb-3 pt-1 flex justify-center">
        <div
          className="flex items-center gap-2 rounded-xl border px-3 py-2 w-full max-w-[210px] transition-colors"
          style={{ background: 'rgba(12,10,13,0.55)', borderColor: 'rgba(255,255,255,0.09)' }}
        >
          <Search className="h-3.5 w-3.5 flex-none opacity-35" />
          <input
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name..."
            className="flex-1 bg-transparent text-[13px] text-foreground outline-none placeholder:text-white/40 min-w-0"
          />
          {searchInput && (
            <button onClick={clearSearch} className="flex-none">
              <X className="h-3 w-3 opacity-40" />
            </button>
          )}
        </div>
      </div>

      <section className="px-4 pb-20">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-2">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-full border border-white/5 px-2.5 py-1.5"
                style={{ background: CARD_BG }}
              >
                <Skeleton className="h-9 w-9 flex-none rounded-full" />
                <div className="flex-1 space-y-1 min-w-0">
                  <Skeleton className="h-3 w-20 rounded" />
                  <Skeleton className="h-2 w-14 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : isEmpty ? (
          <div className="py-12 text-center">
            <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">
              {searchFilter ? 'No organisers match your search.' : 'No organisers yet.'}
            </p>
            {searchFilter && (
              <button
                onClick={clearSearch}
                className="mt-3 inline-flex items-center gap-1 rounded-full border border-amber-400/50 px-3 py-1.5 text-xs font-bold text-amber-400 hover:bg-amber-400/10"
              >
                <X className="h-3.5 w-3.5" />
                Clear search
              </button>
            )}
          </div>
        ) : (
          <>
            {upcoming.length > 0 && (
              <div className="mb-1">
                <SectionLabel>
                  Happening soon &middot; {upcoming.length}
                </SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {upcoming.map((org) => (
                    <OrgPill
                      key={org.id}
                      org={org}
                      statusLabel={org.nextLabel}
                      showPulse
                    />
                  ))}
                </div>
              </div>
            )}

            {recentlyActive.length > 0 && (
              <div className={upcoming.length > 0 ? 'mt-5 mb-1' : 'mb-1'}>
                <SectionLabel>Recently active</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {recentlyActive.map((org) => (
                    <OrgPill
                      key={org.id}
                      org={org}
                      statusLabel={`${eventCounts[org.id] ?? 0} event${(eventCounts[org.id] ?? 0) !== 1 ? 's' : ''}`}
                    />
                  ))}
                </div>
              </div>
            )}

            {dormant.length > 0 && (
              <div className={upcoming.length > 0 || recentlyActive.length > 0 ? 'mt-5 mb-1' : 'mb-1'}>
                <SectionLabel>Quiet for now</SectionLabel>
                <div className="grid grid-cols-2 gap-2">
                  {dormant.map((org) => (
                    <OrgPill key={org.id} org={org} statusLabel="No events yet" />
                  ))}
                </div>
              </div>
            )}
          </>
        )}

        {!isLoading && (
          <div
            className="mt-8 flex items-center gap-3 rounded-xl border px-4 py-3"
            style={{ background: CARD_BG, borderColor: 'rgba(255,255,255,0.07)' }}
          >
            <span className="text-lg flex-none" role="img" aria-hidden>&#127914;</span>
            <div className="flex-1 min-w-0">
              <div className="text-[13px] font-bold text-foreground">
                Are you an organiser?
              </div>
              <div className="text-[11px] mt-0.5" style={{ color: MUTED }}>
                Add your events in minutes
              </div>
            </div>
            <Link
              to="/listing-request"
              className="flex-none rounded-lg px-4 py-2 text-[12px] font-bold transition-colors hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
              style={{ background: ACCENT, color: '#1a1408' }}
            >
              Join
            </Link>
          </div>
        )}
      </section>
    </GlobalLayout>
  );
};

export default Organisers;