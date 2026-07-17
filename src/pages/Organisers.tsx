import { Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Users, Search, X, CalendarDays, MapPin, Star, Building2, Music } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useSeo, buildSeoForRoute } from '@/lib/seo';
import { Skeleton } from '@/components/ui/skeleton';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { londonDaysBetweenKeys } from '@/lib/londonDate';
import { useLondonToday } from '@/hooks/useLondonToday';

/* eslint-disable @typescript-eslint/no-explicit-any */

// Mobile palette
const ACCENT            = '#d3a84c';
const MUTED             = '#c4b89a';
const CARD_BG           = 'rgba(42,22,34,0.55)';
const CARD_HOVER        = 'rgba(55,28,42,0.75)';
const CARD_BORDER       = 'rgba(211,168,76,0.28)';
const CARD_BORDER_HOVER = 'rgba(211,168,76,0.60)';
const RULE_GRAD         = `linear-gradient(90deg, ${CARD_BORDER}, transparent)`;

// Desktop palette
const D_SIDEBAR = '#0e0e13';
const D_CARD    = '#1a1a20';
const D_BORDER  = 'rgba(255,255,255,.07)';
const D_GOLD    = '#d3a84c';

const WA_URL = 'https://wa.me/447577576006?text=' + encodeURIComponent("Hi! I'd like to list my events on Bachata Calendar.");

const CAT_DOT: Record<string, string> = {
  'Promoter':        '#d3a84c',
  'Dance School':    'hsl(150 55% 58%)',
  'Event Brand':     'hsl(14 60% 60%)',
  'Community Group': 'hsl(198 60% 60%)',
  'Venue':           'hsl(36 60% 60%)',
  'Festival Brand':  'hsl(210 55% 62%)',
};

const DESKTOP_NAV = [
  { emoji: '\u{1F4C5}', label: 'Events',     active: false, href: '/'           },
  { emoji: '\u{1F3E2}', label: 'Organisers', active: true,  href: '/organisers' },
] as const;

const hueFromId = (id: string) => {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = id.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h) % 360;
};
const avatarColor = (id: string) => `hsl(${hueFromId(id)} 55% 62%)`;

const initials = (name: string) =>
  name.split(' ').slice(0, 2).map((w) => w[0] ?? '').join('').toUpperCase();

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
      <span className="text-[11px] font-semibold whitespace-nowrap leading-none" style={{ color: ACCENT }}>
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
          <div className="absolute inset-0 rounded-full" style={{ background: color, opacity: 0.1 }} />
          {org.avatar_url ? (
            <img src={org.avatar_url} alt={org.name} loading="lazy" className="relative z-10 w-full h-full object-cover" />
          ) : (
            <span className="relative z-10">{initials(org.name)}</span>
          )}
        </div>
        {showPulse && (
          <span
            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
            style={{ background: color, borderColor: 'rgba(42,22,34,0.9)' }}
          >
            <span className="absolute inset-0 rounded-full animate-ping opacity-60" style={{ background: color }} />
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
        <div className="text-[10px] font-semibold font-mono truncate mt-0.5" style={{ color: ACCENT }}>
          {statusLabel}
        </div>
      </div>
    </Link>
  );
}

type DesktopStatus = 'upcoming' | 'active' | 'dormant';

function DesktopOrgPill({
  org,
  statusLabel,
  status,
}: {
  org: OrgRow;
  statusLabel: string;
  status: DesktopStatus;
}) {
  const href = org.slug ? `/organisers/${org.slug}` : `/organisers/${org.id}`;
  const hue  = hueFromId(org.id);
  const av   = avatarColor(org.id);
  const isDormant = status === 'dormant';

  const borderColor = isDormant
    ? 'rgba(255,255,255,.14)'
    : status === 'active'
    ? `hsl(${hue} 32% 58%)`
    : `hsl(${hue} 60% 60%)`;
  const statusColor =
    status === 'upcoming' ? D_GOLD : status === 'active' ? '#9b8a55' : '#a9a8ae';

  return (
    <Link
      to={href}
      style={{
        display: 'flex', alignItems: 'center', gap: 11,
        background: isDormant ? '#161619' : D_CARD,
        border: `1px solid ${isDormant ? 'rgba(255,255,255,.05)' : D_BORDER}`,
        borderRadius: 999, padding: '7px 15px 7px 7px',
        opacity: 1,
        transition: 'transform .18s, border-color .18s, background .18s, opacity .2s',
        textDecoration: 'none', color: '#f4f3f0',
      }}
      onMouseEnter={(e) => {
        const el = e.currentTarget as HTMLElement;
        
        el.style.transform = 'translateY(-2px)';
        el.style.background = '#21212a';
        el.style.borderColor = status === 'upcoming' ? D_GOLD : 'rgba(255,255,255,.22)';
      }}
      onMouseLeave={(e) => {
        const el = e.currentTarget as HTMLElement;
        el.style.transform = '';
        el.style.background = isDormant ? '#161619' : D_CARD;
        el.style.borderColor = isDormant ? 'rgba(255,255,255,.05)' : D_BORDER;
        
      }}
    >
      <div
        style={{
          position: 'relative', flexShrink: 0,
          width: 40, height: 40, borderRadius: '50%',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isDormant ? '#17171c' : `hsl(${hue} 20% 11%)`,
          border: `1.5px solid ${borderColor}`,
          color: isDormant ? '#76757b' : av,
          fontSize: 13, fontWeight: 800,
          overflow: 'hidden',
        }}
      >
        {org.avatar_url ? (
          <img src={org.avatar_url} alt={org.name} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initials(org.name)
        )}
        {status === 'upcoming' && (
          <span style={{ position: 'absolute', right: 0, bottom: 0, width: 9, height: 9, borderRadius: '50%', background: D_GOLD, border: `2px solid ${D_CARD}` }}>
            <span className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ background: D_GOLD }} />
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: 700, fontSize: 13, lineHeight: 1.15,
          color: '#f4f3f0',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {org.name}
        </div>
        <div style={{
          fontSize: 10, lineHeight: 1.2,
          color: '#b9b8be',
          marginTop: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {org.organisation_category ?? 'Organiser'}
        </div>
        <div style={{
          fontFamily: 'ui-monospace, monospace',
          fontSize: 9.5, fontWeight: isDormant ? 500 : 600,
          color: statusColor, marginTop: 2,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>
          {statusLabel}
        </div>
      </div>
    </Link>
  );
}

const formatLastSeen = (dateStr: string | undefined): string => {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const days = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (days < 60) return days === 0 ? 'today' : days === 1 ? 'yesterday' : `${days} days ago`;
  const opts: Intl.DateTimeFormatOptions = days > 365
    ? { month: 'long', year: 'numeric' }
    : { month: 'long' };
  return d.toLocaleDateString('en-GB', opts);
};

const Organisers = () => {
  useSeo(buildSeoForRoute('organisers'));
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');
  const searchFilter = searchParams.get('search')?.trim() || null;
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set());

  // Reactive London-calendar "today": rolls the countdown labels (and the
  // day-anchored queries below) over at midnight instead of freezing at mount.
  const todayKey = useLondonToday();

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
    // Keyed by London-day so a tab open across midnight refetches: the RPC's
    // "next event" answer changes when the calendar day does.
    queryKey: ['organiser-next-event-dates', todayKey],
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

  const { data: lastEventDates = {} } = useQuery({
    // Keyed by London-day to match the next-dates query: the "past" boundary the
    // RPC applies moves when the London calendar day does.
    queryKey: ['organiser-last-event-dates-v2', todayKey],
    queryFn: async () => {
      // Was a client-side join over event_entities + calendar_occurrences (two
      // legacy tables, capped at 2000 occurrence rows, and it kept only ONE
      // organiser per event). The P5-native RPC does the aggregation server-side
      // with the London-day boundary applied there (M2).
      const { data, error } = await supabase.rpc('get_organiser_last_event_dates_v1' as any);
      if (error) return {} as Record<string, string>;
      const best: Record<string, string> = {};
      (data as any[] | null)?.forEach((item) => {
        if (item?.entity_id && item?.last_event_date) {
          best[item.entity_id] = item.last_event_date;
        }
      });
      return best;
    },
    staleTime: 30 * 60 * 1000,
  });

  const catCounts = useMemo(() => {
    const m: Record<string, number> = {};
    organisers.forEach((o) => {
      const cat = o.organisation_category;
      if (cat) m[cat] = (m[cat] ?? 0) + 1;
    });
    return m;
  }, [organisers]);

  const filteredOrganisers = useMemo(() => {
    let list = organisers;
    if (searchFilter) {
      const needle = searchFilter.toLowerCase();
      list = list.filter(
        (o) =>
          o.name.toLowerCase().includes(needle) ||
          (o.cities?.name ?? '').toLowerCase().includes(needle),
      );
    }
    if (selectedCats.size > 0) {
      list = list.filter((o) => selectedCats.has(o.organisation_category ?? ''));
    }
    return list;
  }, [organisers, searchFilter, selectedCats]);

  const { upcoming, recentlyActive, dormant } = useMemo(() => {
    const upcoming: UpcomingOrg[] = [];
    const recentlyActive: OrgRow[] = [];
    const dormant: OrgRow[] = [];

    filteredOrganisers.forEach((org) => {
      const nextDate = nextEventDates[org.id];
      // next_event_date is a London calendar date key; days < 0 only happens
      // when the cached RPC data has aged past midnight — that event already
      // ran, so the organiser degrades to "recently active" rather than
      // rendering an "in -1 days" pill at the top of the list.
      const days = nextDate ? londonDaysBetweenKeys(todayKey, nextDate) : null;
      if (days !== null && days >= 0) {
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
  }, [filteredOrganisers, nextEventDates, eventCounts, todayKey]);

  const toggleCat = (cat: string) =>
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });

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
  const totalFiltered = upcoming.length + recentlyActive.length + dormant.length;

  return (
    <>
      {/* DESKTOP (lg+) */}
      <div
        className="hidden lg:flex"
        style={{ height: 'calc(100vh - 60px)', overflow: 'hidden', background: '#0a0a0f', color: '#f4f3f0' }}
      >
        {/* Sidebar */}
        <aside style={{
          width: 228, flexShrink: 0,
          background: D_SIDEBAR,
          borderRight: '1px solid rgba(255,255,255,.06)',
          display: 'flex', flexDirection: 'column',
          height: '100%', overflow: 'hidden',
        }}>
          <nav style={{ padding: '16px 10px 0', flex: 1, overflowY: 'auto' }}>
            <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#4a4950', padding: '0 10px', marginBottom: 6 }}>
              Explore
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {DESKTOP_NAV.map((item) => (
                <Link
                  key={item.label}
                  to={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 10px', borderRadius: 9,
                    background: item.active ? 'rgba(211,168,76,.1)' : 'transparent',
                    color: item.active ? D_GOLD : '#86858c',
                    textDecoration: 'none',
                  }}
                >
                  <span style={{ fontSize: 15, width: 18, textAlign: 'center' }}>{item.emoji}</span>
                  <span style={{ fontSize: 13.5, fontWeight: item.active ? 700 : 500 }}>{item.label}</span>
                  {item.active && (
                    <span style={{
                      marginLeft: 'auto', fontSize: 10,
                      fontFamily: 'ui-monospace, monospace', fontWeight: 700,
                      background: 'rgba(211,168,76,.2)', color: D_GOLD,
                      padding: '2px 7px', borderRadius: 99,
                    }}>
                      {organisers.length}
                    </span>
                  )}
                </Link>
              ))}
            </div>

            {Object.keys(catCounts).length > 0 && (
              <div style={{ marginTop: 24 }}>
                <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.16em', textTransform: 'uppercase', color: '#4a4950', padding: '0 10px', marginBottom: 8 }}>
                  Filter by type
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                  {Object.entries(catCounts).map(([cat, count]) => {
                    const active = selectedCats.has(cat);
                    return (
                      <div
                        key={cat}
                        onClick={() => toggleCat(cat)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 9,
                          padding: '7px 10px', borderRadius: 8, cursor: 'pointer',
                          background: active ? 'rgba(255,255,255,.06)' : 'transparent',
                          transition: 'background .15s',
                        }}
                        onMouseEnter={(e) => {
                          if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,.04)';
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLElement).style.background = active ? 'rgba(255,255,255,.06)' : 'transparent';
                        }}
                      >
                        <div style={{ width: 8, height: 8, borderRadius: '50%', background: CAT_DOT[cat] ?? '#86858c', flexShrink: 0 }} />
                        <span style={{ flex: 1, fontSize: 12.5, fontWeight: 500, color: active ? '#f4f3f0' : '#86858c' }}>{cat}</span>
                        <span style={{ fontFamily: 'ui-monospace, monospace', fontSize: 10.5, fontWeight: 600, color: '#4a4950' }}>{count}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </nav>

          <div style={{ padding: '14px 12px', borderTop: '1px solid rgba(255,255,255,.06)', flexShrink: 0 }}>
            <a
              href={WA_URL}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', gap: 11,
                background: '#1c1c23', border: '1px solid rgba(255,255,255,.07)',
                borderRadius: 12, padding: '11px 12px', textDecoration: 'none',
                transition: 'border-color .18s, background .18s',
              }}
              onMouseEnter={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'rgba(211,168,76,.3)';
                el.style.background = '#21212a';
              }}
              onMouseLeave={(e) => {
                const el = e.currentTarget as HTMLElement;
                el.style.borderColor = 'rgba(255,255,255,.07)';
                el.style.background = '#1c1c23';
              }}
            >
              <span style={{ fontSize: 18 }}>&#127914;</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: '#f4f3f0' }}>List your night</div>
                <div style={{ fontSize: 10.5, fontWeight: 500, color: '#6c6b72', marginTop: 1 }}>It&rsquo;s free</div>
              </div>
              <span style={{ fontSize: 13, color: D_GOLD }}>&rarr;</span>
            </a>
          </div>
        </aside>

        {/* Main column */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', minWidth: 0 }}>
          {/* Inner top bar */}
          <div style={{
            flexShrink: 0, height: 58,
            background: D_SIDEBAR, borderBottom: '1px solid rgba(255,255,255,.06)',
            display: 'flex', alignItems: 'center', gap: 16, padding: '0 28px',
          }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 800, lineHeight: 1 }}>Organisers</div>
              <div style={{ fontSize: 11, fontWeight: 500, color: '#5b5a60', marginTop: 2 }}>
                {totalFiltered} in London &middot; soonest first
              </div>
            </div>

            <div style={{
              display: 'flex', alignItems: 'center', gap: 9,
              background: D_CARD, border: '1px solid rgba(255,255,255,.08)',
              borderRadius: 10, padding: '8px 14px', width: 280,
            }}>
              <Search style={{ width: 14, height: 14, opacity: 0.4, flexShrink: 0 }} />
              <input
                value={searchInput}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder="Search organisers..."
                style={{
                  flex: 1, background: 'none', border: 'none', outline: 'none',
                  color: '#f4f3f0', fontSize: 13.5, fontWeight: 500,
                }}
              />
              {searchInput && (
                <button
                  onClick={clearSearch}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '1px 6px', borderRadius: 5, color: '#6c6b72', display: 'flex', alignItems: 'center' }}
                >
                  <X style={{ width: 11, height: 11 }} />
                </button>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, background: D_CARD, border: '1px solid rgba(211,168,76,.2)', borderRadius: 9, padding: '7px 13px' }}>
                <span className="relative flex-none inline-flex w-[7px] h-[7px]">
                  <span className="absolute inset-0 rounded-full animate-ping opacity-75" style={{ background: D_GOLD }} />
                  <span className="relative block w-full h-full rounded-full" style={{ background: D_GOLD }} />
                </span>
                <span style={{ fontSize: 12, fontWeight: 700, color: D_GOLD }}>{upcoming.length} upcoming</span>
              </div>

            </div>
          </div>

          {/* Scrollable content */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '28px 28px 40px' }}>
            {isLoading ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 11, background: D_CARD, border: `1px solid ${D_BORDER}`, borderRadius: 999, padding: '7px 15px 7px 7px' }}>
                    <Skeleton className="w-10 h-10 rounded-full flex-none" />
                    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <Skeleton className="h-3 w-20 rounded" />
                      <Skeleton className="h-2 w-14 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            ) : isEmpty ? (
              <div style={{ paddingTop: 48, textAlign: 'center' }}>
                <Users style={{ margin: '0 auto 12px', width: 40, height: 40, opacity: 0.2, color: '#86858c' }} />
                <p style={{ fontSize: 13, color: '#86858c' }}>
                  {searchFilter || selectedCats.size > 0 ? 'No organisers match your filter.' : 'No organisers yet.'}
                </p>
                {(searchFilter || selectedCats.size > 0) && (
                  <button
                    onClick={() => { clearSearch(); setSelectedCats(new Set()); }}
                    style={{ marginTop: 12, display: 'inline-flex', alignItems: 'center', gap: 4, borderRadius: 999, border: '1px solid rgba(211,168,76,.5)', padding: '6px 12px', fontSize: 12, fontWeight: 700, color: D_GOLD, background: 'none', cursor: 'pointer' }}
                  >
                    <X style={{ width: 12, height: 12 }} /> Clear filters
                  </button>
                )}
              </div>
            ) : (
              <>
                {upcoming.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: D_GOLD }}>Happening soon</div>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700, color: 'rgba(211,168,76,.5)' }}>{upcoming.length}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {upcoming.map((org) => (
                        <DesktopOrgPill key={org.id} org={org} statusLabel={org.nextLabel} status="upcoming" />
                      ))}
                    </div>
                  </div>
                )}

                {recentlyActive.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#7d7c83' }}>Recently active</div>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700, color: '#4a4950' }}>{recentlyActive.length}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {recentlyActive.map((org) => (
                        <DesktopOrgPill
                          key={org.id}
                          org={org}
                          statusLabel={`Last seen ${formatLastSeen(lastEventDates[org.id]) || 'recently'}`}
                          status="active"
                        />
                      ))}
                    </div>
                  </div>
                )}

                {dormant.length > 0 && (
                  <div style={{ marginBottom: 32 }}>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, marginBottom: 14 }}>
                      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '.15em', textTransform: 'uppercase', color: '#5b5a60' }}>Quiet for now</div>
                      <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, fontWeight: 700, color: '#36353a' }}>{dormant.length}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
                      {dormant.map((org) => (
                        <DesktopOrgPill key={org.id} org={org} statusLabel={lastEventDates[org.id] ? `Last seen ${formatLastSeen(lastEventDates[org.id])}` : 'No events yet'} status="dormant" />
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {!isLoading && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 14,
                background: '#1c1c23', border: '1px solid rgba(255,255,255,.08)',
                borderRadius: 14, padding: '13px 14px 13px 20px',
              }}>
                <span style={{ fontSize: 20 }}>&#127914;</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700 }}>Are you an organiser?</div>
                  <div style={{ fontSize: 12, color: '#86858c', marginTop: 1 }}>Add your events in minutes</div>
                </div>
                <a
                  href={WA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    flexShrink: 0, fontSize: 13, fontWeight: 700, color: '#1a1408',
                    background: D_GOLD, padding: '10px 20px', borderRadius: 10,
                    textDecoration: 'none', whiteSpace: 'nowrap',
                    transition: 'background .18s',
                  }}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#e4ba5e'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = D_GOLD; }}
                >
                  Join as an organiser
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* MOBILE (< lg) -- unchanged */}
      <div className="lg:hidden">
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
                        <OrgPill key={org.id} org={org} statusLabel={org.nextLabel} showPulse />
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
                          statusLabel={`Last seen ${formatLastSeen(lastEventDates[org.id]) || 'recently'}`}
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
                        <OrgPill key={org.id} org={org} statusLabel={lastEventDates[org.id] ? `Last seen ${formatLastSeen(lastEventDates[org.id])}` : 'No events yet'} />
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
      </div>
    </>
  );
};

export default Organisers;
