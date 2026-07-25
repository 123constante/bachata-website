import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { cn } from '@/lib/utils';
import { formatWallClockTime, wallClockDateKey, wallClockExactDateKey } from '@/lib/time/wallClock';
import type { EventPageModel, FestivalScheduleItem } from '@/modules/event-page/types';

// ─── Shared types ─────────────────────────────────────────────────────────────
// Exported so the new bento ScheduleBlock can reuse this hook without
// duplicating it. EventScheduleGrid is slated for deletion post-bento rollout;
// the hook will relocate at that point.

export type Person = {
  id: string;
  name: string;
  href: string | null;
  avatarUrl: string | null;
  role: string;
  profileType: string | null;
  /** Phase C — public bento multi-room renderer. Per-person level binding
   *  surfaced from event_program_people.level. NULL = applies to whole session
   *  (default behaviour preserved). When non-null, RankCard groups people by
   *  level so each level row shows its own teacher/DJ. */
  level: SessionLevel | null;
};

export type SessionLevel = 'beginner' | 'improver' | 'intermediate' | 'advanced' | 'open_level';
export const ALL_SESSION_LEVELS: readonly SessionLevel[] = [
  'beginner', 'improver', 'intermediate', 'advanced', 'open_level',
] as const;

export type ScheduleSession = {
  id: string;
  title: string;
  type: string;
  day: string | null;
  startMins: number | null;
  endMins: number | null;
  /** This row's position in the RPC's returned array. Used ONLY as a stable,
   *  unique tiebreak so the display sort is a strict total order -- it is NOT
   *  a cross-section program authority, and neither is `sort_order`:
   *    - `sort_order` restarts per section AND repeats within one (verified
   *      live: occurrence da08f3c6 returns two items both at sort_order 0).
   *    - the array order appends occurrence-added sessions LAST (verified
   *      live: occurrence 2714d3bd returns [party 23:00, masterclass no-time]
   *      even though the masterclass leads the program).
   *  Hence neither can place a time-less row; see orderSessionsForDisplay. */
  programIndex: number;
  /** Skill levels for this session (class / masterclass / workshop / bootcamp).
   *  Subset of {beginner, improver, intermediate, advanced, open_level}. Empty = unspecified.
   *  `open_level` is the platform-wide term for "anyone, any level, no restriction"
   *  — never use "all levels" or similar. Always [] for parties / shows. */
  levels: SessionLevel[];
  /** Optional room name — used to disambiguate parallel sessions. */
  room: string | null;
  people: Person[];
  /** Phase 2B step 2e — section context surfaced from get_event_program_v1.
   *  Null for legacy events that have not been migrated to the program-tree
   *  tables. When present, the renderer groups sessions by section_id and
   *  uses section_label (label_override fallback to kind) for section
   *  headers. */
  sectionId: string | null;
  sectionKind: string | null;
  sectionLabel: string | null;
  /** Arc 6 / Premium D (2026-05-30) — true when this session was created via
   *  the per-occurrence "+ Add session" UI (calendar_occurrence_added_sessions),
   *  not as part of the recurring series program. The schedule renderer surfaces
   *  a "Special tonight" chip on these so visitors know it's a one-off. */
  addedOnly?: boolean;
  /** Arc 13 / Premium D — true when this session was cancelled for this
   *  occurrence via admin_set_session_attribute_override (cancelled: true).
   *  Only present when events.show_cancelled_publicly = true; the schedule
   *  renderer shows a struck-through card so visitors see the honest programme. */
  cancelled?: boolean;
};

/** Phase 2B step 2e — section row from get_event_program_sections_v1.
 *  Includes empty sections (item_count=0) so the renderer can surface
 *  structural intent the user added before populating items. */
export type ProgramSection = {
  id: string;
  kind: string;
  labelOverride: string | null;
  label: string;
  sortOrder: number;
  dayId: string;
  dayEventDate: string | null;
  daySortOrder: number;
  itemCount: number;
};

const LEVEL_SET = new Set<string>(ALL_SESSION_LEVELS);
const sanitizeLevels = (raw: unknown): SessionLevel[] => {
  if (!Array.isArray(raw)) return [];
  return (raw as unknown[])
    .filter((v): v is SessionLevel => typeof v === 'string' && LEVEL_SET.has(v))
    .sort((a, b) => ALL_SESSION_LEVELS.indexOf(a) - ALL_SESSION_LEVELS.indexOf(b));
};

// ─── Time utilities ───────────────────────────────────────────────────────────

const toMins = (value: string | null | undefined): number | null => {
  if (!value) return null;
  const tIdx = value.indexOf('T');
  const part = tIdx !== -1 ? value.slice(tIdx + 1) : value;
  const [h, m] = part.split(':').map(Number);
  if (isNaN(h)) return null;
  return h * 60 + (m || 0);
};

const fmtMins12 = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const normalizeTitle = (title: string): string =>
  /^(class|party|workshop|social|show|competition)\s+\d+$/i.test(title.trim())
    ? title.trim().replace(/\s+\d+$/, '')
    : title;

/** Display order for a session list. Shared by the legacy grid and the bento
 *  ScheduleBlock so the two surfaces cannot drift.
 *
 *  Timed sessions order chronologically. A time-less session (startMins ===
 *  null) has no chronological home, so it LEADS the day -- which is what puts
 *  the no-time masterclass above the 11pm party on the Sensual Vibes page, and
 *  reads correctly for a reader ("there is a masterclass, time to be
 *  confirmed"). Several time-less rows keep their RPC array order.
 *
 *  Why "leads" rather than "at its program position": neither available field
 *  can express that position across sections. `sort_order` restarts per
 *  section and repeats within one, and the RPC appends occurrence-added
 *  sessions to the END of the array (so array order would sink the very
 *  masterclass this exists to surface). Both were verified against prod.
 *
 *  Deliberately a single total order (start, then programIndex) and NOT a
 *  comparator that switches key by pair. A mixed-key comparator ("both timed
 *  -> compare time, else compare order") is non-transitive: with 3+ rows it
 *  can report a < b, b < c and c < a, and V8's TimSort then emits an arbitrary
 *  order (other engines a different one). */
export const orderSessionsForDisplay = <T extends { startMins: number | null; programIndex: number }>(
  sessions: T[],
): T[] => {
  if (!sessions.length) return [];
  return [...sessions].sort((a, b) => {
    const ka = a.startMins ?? Number.NEGATIVE_INFINITY;
    const kb = b.startMins ?? Number.NEGATIVE_INFINITY;
    // Compare, never subtract: (-Infinity) - (-Infinity) is NaN, which would
    // corrupt the sort. programIndex is unique per list, so this is a STRICT
    // total order -- every pair is decided by one key, never two.
    if (ka !== kb) return ka < kb ? -1 : 1;
    return a.programIndex - b.programIndex;
  });
};

const normalizeSessions = (sessions: ScheduleSession[]): ScheduleSession[] => {
  if (!sessions.length) return [];
  return orderSessionsForDisplay(sessions).map((s) => {
    if (s.startMins === null || s.endMins === null) return s;
    let end = s.endMins;
    if (end > 0 && end <= s.startMins) end += 24 * 60;
    return { ...s, endMins: end };
  });
};

// ─── Role / href helpers ──────────────────────────────────────────────────────

const hrefFor = (profileType: string | null, profileId: string | null): string | null => {
  if (!profileId) return null;
  if (profileType === 'teacher') return `/teachers/${profileId}`;
  if (profileType === 'dj') return `/djs/${profileId}`;
  if (profileType === 'dancer') return `/dancers/${profileId}`;
  if (profileType === 'vendor') return `/vendors/${profileId}`;
  return null;
};

const roleLabel = (profileType: string | null): string => {
  if (profileType === 'teacher') return 'Teacher';
  if (profileType === 'dj') return 'DJ';
  if (profileType === 'dancer') return 'Dancer';
  if (profileType === 'videographer') return 'Videographer';
  if (profileType === 'vendor') return 'Vendor';
  return '';
};

// ─── Occurrence override program hook ────────────────────────────────────────

/** Fetches override_payload.program for the given occurrence via RPC.
 *  Returns null when: no occurrenceId, no override, or RPC not deployed yet. */
function useOccurrenceOverrideProgram(occurrenceId: string | null | undefined): ScheduleSession[] | null {
  const { data } = useQuery<ScheduleSession[] | null>({
    queryKey: ['occurrence-override-program', occurrenceId],
    queryFn: async () => {
      if (!occurrenceId) return null;
      const { data, error } = await (supabase.rpc as any)('get_occurrence_override_program_v1', {
        p_occurrence_id: occurrenceId,
      });
      if (error || data === null || data === undefined) return null;
      // data is a jsonb array from the RPC
      const items: unknown[] = Array.isArray(data) ? data : [];
      return items
        .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
        .map((item, idx): ScheduleSession | null => {
          const startMins = toMins(item.startTime as string | null);
          const endMins = toMins(item.endTime as string | null) ?? (startMins !== null ? startMins + 60 : null);
          const people: Person[] = (Array.isArray(item.people) ? item.people : [])
            .map((p: unknown): Person | null => {
              if (!p || typeof p !== 'object') return null;
              const r = p as Record<string, unknown>;
              const pid = typeof r.profile_id === 'string' ? r.profile_id : null;
              const ptype = typeof r.profile_type === 'string' ? r.profile_type : null;
              if (!pid) return null;
              return {
                id: pid,
                name: typeof r.display_name === 'string' && r.display_name ? r.display_name
                      : ptype === 'dj' ? 'DJ' : 'Teacher',
                href: ptype === 'teacher' ? `/teachers/${pid}`
                      : ptype === 'dj' ? `/djs/${pid}`
                      : ptype === 'dancer' ? `/dancers/${pid}` : null,
                avatarUrl: typeof r.avatar_url === 'string' ? r.avatar_url : null,
                role: typeof r.role === 'string' ? r.role : (ptype ?? ''),
                profileType: ptype,
                level: null,
              };
            })
            .filter((x): x is Person => x !== null);
          return {
            id: typeof item.id === 'string' ? item.id : `occ-${idx}`,
            title: typeof item.title === 'string' && item.title
              ? item.title
              : item.type === 'party' ? 'Party' : 'Class',
            type: typeof item.type === 'string' ? item.type : 'class',
            day: null,
            startMins,
            endMins,
            programIndex: idx,
            levels: sanitizeLevels(item.levels),
            room: typeof item.room === 'string' && item.room.trim() ? item.room.trim() : null,
            people,
            sectionId: null,
            sectionKind: null,
            sectionLabel: null,
          };
        })
        .filter((x): x is ScheduleSession => x !== null);
    },
    enabled: Boolean(occurrenceId),
    // ADR-007 Phase 4 — was 5 min; reduced so admin edits propagate fast.
    staleTime: 1000 * 30,
  });
  return data ?? null;
}


// Phase C — both useProgramItems (series) and useOccurrenceProgram
// (occurrence-merged) consume the same jsonb shape from their respective
// RPCs (get_event_program_v1 / get_occurrence_program_v1, Phase 2N). The
// parser below is shared so the two hooks stay in lockstep.

type RpcPerson = {
  profile_id: string | null;
  profile_type: string | null;
  display_name: string | null;
  avatar_url: string | null;
  sort_order: number | null;
  level: string | null;
};
type RpcItem = {
  id: string;
  title: string | null;
  type: string | null;
  start_time: string | null;
  end_time: string | null;
  /** Occurrence/day date (YYYY-MM-DD) surfaced by event_view_p5 legacy_compat.
   *  Fallback day source for time-less rows: a null start_time carries no
   *  date prefix, so the day derivation reads this instead. */
  day_event_date?: string | null;
  sort_order: number | null;
  levels: string[] | null;
  room: string | null;
  people: RpcPerson[] | null;
  // Phase 2B step 2d — additive section context (Phase 2B step 2e
  // surfaces these into ScheduleSession so the renderer can group by
  // database section instead of inferring from item type).
  section_id: string | null;
  section_kind: string | null;
  section_label: string | null;
  /** Arc 6 / Premium D (2026-05-30) — true on rows that came from
   *  calendar_occurrence_added_sessions. Surfaced by get_occurrence_program_v1
   *  post-Bundle 1; the schedule renderer renders a "Special tonight" chip
   *  on these so visitors recognise them as one-off additions. */
  added_only?: boolean | null;
  /** Arc 13 / Premium D — true when cancelled IS TRUE on the session override
   *  row and events.show_cancelled_publicly = true. Always false for added
   *  sessions (they can be deleted instead of cancelled). */
  cancelled?: boolean | null;
};

/** A time-less row only earns a place on the public page when it carries
 *  something worth showing. Dropping the old null-start filter (so a real
 *  masterclass with no time renders) would otherwise also surface editor
 *  detritus: the RPC coalesces a NULL title to 'Untitled', so a half-created
 *  session with no teacher, level or title would render as a bare
 *  "Time TBC / UNTITLED" row above the real classes (verified live on the
 *  50/50 event, reachable from the organiser past-events grid). Timed rows are
 *  never gated by this -- their time alone anchors them. */
export const isRenderableTimelessItem = (item: RpcItem): boolean => {
  const title = typeof item.title === 'string' ? item.title.trim().toLowerCase() : '';
  const hasTitle = title.length > 0 && title !== 'untitled';
  const hasPeople = Array.isArray(item.people) && item.people.some((p) => p && p.profile_id);
  const hasLevels = Array.isArray(item.levels) && item.levels.length > 0;
  return hasTitle || hasPeople || hasLevels;
};

function parseProgramItems(data: unknown): ScheduleSession[] {
  const items = (data as unknown as RpcItem[]) ?? [];
  return items
    .filter((item) => toMins(item.start_time) !== null || isRenderableTimelessItem(item))
    .map((item, idx): ScheduleSession => {
      const startMins = toMins(item.start_time);
      const endMins = toMins(item.end_time) ?? (startMins !== null ? startMins + 60 : null);

      const people: Person[] = (item.people ?? [])
        .slice()
        .sort((a, b) => {
          const ao = a.sort_order ?? Number.MAX_SAFE_INTEGER;
          const bo = b.sort_order ?? Number.MAX_SAFE_INTEGER;
          return ao - bo;
        })
        .map((r): Person | null => {
          if (!r.profile_id) return null;
          const lvl: SessionLevel | null =
            r.level && LEVEL_SET.has(r.level) ? (r.level as SessionLevel) : null;
          return {
            id: r.profile_id,
            name: r.display_name || (r.profile_type === 'dj' ? 'DJ' : 'Teacher'),
            href: hrefFor(r.profile_type, r.profile_id),
            avatarUrl: r.avatar_url,
            role: roleLabel(r.profile_type),
            profileType: r.profile_type,
            level: lvl,
          };
        })
        .filter((x): x is Person => x !== null);

      // Extract local-wall-clock date prefix. The RPC stores times as naive
      // local (see toMins, which ignores any offset); the YYYY-MM-DD prefix
      // matches what DayBlock/formatDayLabel expect.
      const dayMatch =
        typeof item.start_time === 'string' ? item.start_time.match(/^(\d{4}-\d{2}-\d{2})/) : null;
      // Time-less rows carry no date in start_time; fall back to the RPC's
      // day_event_date so day-grouping / multi-day logic still places them.
      const dayFallback =
        typeof item.day_event_date === 'string' && /^\d{4}-\d{2}-\d{2}/.test(item.day_event_date)
          ? item.day_event_date.slice(0, 10)
          : null;
      // Confined to TIME-LESS rows, which is all the comment above ever claimed.
      // Applying it to any row lacking a date prefix also caught legacy
      // meta_data->program items (branch 3 emits a bare 'HH:MM' start_time
      // alongside day_event_date = item->>'day'), which would hand every row a
      // day and flip a flat single-day list into day tabs. Latent today (0 live
      // rows have that shape) -- kept impossible rather than left to chance.
      const day = dayMatch ? dayMatch[1] : startMins === null ? dayFallback : null;

      return {
        id: item.id,
        title: normalizeTitle(item.title || (item.type === 'party' ? 'Party' : 'Class')),
        type: item.type || 'class',
        day,
        startMins,
        endMins,
        programIndex: idx,
        levels: sanitizeLevels(item.levels),
        room: typeof item.room === 'string' && item.room.trim().length > 0 ? item.room.trim() : null,
        people,
        sectionId: typeof item.section_id === 'string' ? item.section_id : null,
        sectionKind: typeof item.section_kind === 'string' ? item.section_kind : null,
        sectionLabel: typeof item.section_label === 'string' && item.section_label.trim().length > 0
          ? item.section_label
          : null,
        addedOnly: item.added_only === true,
        cancelled: item.cancelled === true,
      };
    });
}

export function useProgramItems(eventId: string | null | undefined) {
  return useQuery<ScheduleSession[]>({
    queryKey: ['event-program-items', eventId],
    queryFn: async () => {
      if (!eventId) return [];
      const { data, error } = await (supabase.rpc as any)('event_view_p5', {
        p_target: { series_id: eventId },
        p_viewer: { role: 'anon', shape: 'legacy_compat' },
      });
      if (error || !data) return [];
      return parseProgramItems(data);
    },
    enabled: Boolean(eventId),
    // ADR-007 Phase 4 — was 5 min; reduced so admin edits propagate fast.
    staleTime: 1000 * 30,
  });
}

// Phase C — occurrence-aware program reader. Calls get_occurrence_program_v1
// (Phase 2N), which returns the same jsonb shape as get_event_program_v1 but
// with per-occurrence overrides merged: cancelled sessions filtered out, time
// / title overrides applied, hidden people removed. ScheduleBlock branches
// on occurrenceId to pick this hook over useProgramItems.
export function useOccurrenceProgram(occurrenceId: string | null | undefined) {
  return useQuery<ScheduleSession[]>({
    queryKey: ['occurrence-program', occurrenceId],
    queryFn: async () => {
      if (!occurrenceId) return [];
      const { data, error } = await (supabase.rpc as any)('event_view_p5', {
        p_target: { occurrence_id: occurrenceId },
        p_viewer: { role: 'anon', shape: 'legacy_compat' },
      });
      if (error || !data) return [];
      return parseProgramItems(data);
    },
    enabled: Boolean(occurrenceId),
    // ADR-007 Phase 4 — was 5 min; reduced so admin edits propagate fast.
    staleTime: 1000 * 30,
  });
}

// Phase 2B step 2e — companion hook that fetches the full section list
// (including empty sections) so the bento renderer can surface structural
// intent the user added before populating items. Legacy events without
// program-tree rows get an empty array; the renderer falls back to its
// type-inference path when sections is empty.
export function useProgramSections(eventId: string | null | undefined) {
  return useQuery<ProgramSection[]>({
    queryKey: ['event-program-sections', eventId],
    queryFn: async () => {
      if (!eventId) return [];

      const { data, error } = await (supabase.rpc as any)('get_event_program_sections_v1', {
        p_event_id: eventId,
      });

      if (error || !data) return [];

      type RpcSection = {
        id: string;
        kind: string;
        label_override: string | null;
        label: string;
        sort_order: number | null;
        day_id: string;
        day_event_date: string | null;
        day_sort_order: number | null;
        item_count: number | null;
      };

      const rows = (data as unknown as RpcSection[]) ?? [];
      return rows.map((r): ProgramSection => ({
        id: r.id,
        kind: r.kind,
        labelOverride: r.label_override && r.label_override.trim().length > 0
          ? r.label_override
          : null,
        label: typeof r.label === 'string' && r.label.length > 0 ? r.label : r.kind,
        sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
        dayId: r.day_id,
        dayEventDate: r.day_event_date,
        daySortOrder: typeof r.day_sort_order === 'number' ? r.day_sort_order : 0,
        itemCount: typeof r.item_count === 'number' ? r.item_count : 0,
      }));
    },
    enabled: Boolean(eventId),
    // ADR-007 Phase 4 — was 5 min; reduced so admin edits propagate fast.
    staleTime: 1000 * 30,
  });
}

// ─── Fallback converters ──────────────────────────────────────────────────────

function fromFestivalSchedule(items: FestivalScheduleItem[]): ScheduleSession[] {
  return items
    .map((item, idx): ScheduleSession | null => {
      // Branded festival stamps -> 24h "HH:MM" via the sanctioned reader, then
      // through the SAME toMins as every other path. toMins itself must stay
      // string-typed: the occurrence-override program feeds it bare "HH:MM"
      // by DB construction (recompute_override_payload_program_v1).
      const startHHMM = formatWallClockTime(item.startTime, { hour12: false });
      const startMins = toMins(startHHMM);
      const endMins = toMins(formatWallClockTime(item.endTime, { hour12: false })) ?? (startMins !== null ? startMins + 60 : null);
      const people: Person[] = [
        ...item.instructors.map((p) => ({
          id: p.id,
          name: p.displayName ?? 'Teacher',
          href: `/teachers/${p.id}`,
          avatarUrl: p.avatarUrl ?? null,
          role: 'Teacher',
          profileType: 'teacher',
          level: null,
        })),
        ...item.djs.map((p) => ({
          id: p.id,
          name: p.displayName ?? 'DJ',
          href: `/djs/${p.id}`,
          avatarUrl: p.avatarUrl ?? null,
          role: 'DJ',
          profileType: 'dj',
          level: null,
        })),
      ];
      return {
        // Derive the fallback id from sanitized strings, never the branded stamps.
        // startHHMM is non-null here: the `startMins === null` guard above already
        // returned for anything that failed to parse. The id wants a stable
        // discriminator, so it keeps the date PREFIX read -- unlike `day` below,
        // which must stay anchored to preserve the pre-brand grouping semantics.
        id: item.id ?? `${item.type}-${wallClockDateKey(item.day) ?? ''}-${startHHMM}`,
        title: normalizeTitle(item.title || (item.type === 'party' ? 'Party' : 'Class')),
        type: item.type,
        day: wallClockExactDateKey(item.day),
        startMins,
        endMins,
        programIndex: idx,
        levels: sanitizeLevels((item as unknown as { levels?: unknown }).levels),
        room: typeof item.venueRoom === 'string' && item.venueRoom.trim().length > 0 ? item.venueRoom.trim() : null,
        people,
        sectionId: null,
        sectionKind: null,
        sectionLabel: null,
      };
    })
    .filter((x): x is ScheduleSession => x !== null);
}

function fromKeyTimes(kt: NonNullable<EventPageModel['schedule']['keyTimes']>): ScheduleSession[] {
  const out: ScheduleSession[] = [];
  if (kt.classes?.start) {
    const s = toMins(kt.classes.start) ?? 0;
    const e = toMins(kt.classes.end) ?? s + 60;
    out.push({ id: 'kt-classes', title: 'Classes', type: 'class', day: null, startMins: s, endMins: e, programIndex: 0, levels: [], room: null, people: [], sectionId: null, sectionKind: null, sectionLabel: null });
  }
  if (kt.party?.start) {
    const s = toMins(kt.party.start) ?? 0;
    const e = toMins(kt.party.end) ?? s + 60;
    out.push({ id: 'kt-party', title: 'Party', type: 'party', day: null, startMins: s, endMins: e, programIndex: 1, levels: [], room: null, people: [], sectionId: null, sectionKind: null, sectionLabel: null });
  }
  return out;
}

// ─── Visual helpers ───────────────────────────────────────────────────────────

const AvatarStack = ({ people }: { people: Person[] }) => {
  if (people.length === 0) return null;
  const visible = people.slice(0, 2);
  const extra = people.length - 2;
  return (
    <div className="flex items-center justify-end">
      {visible.map((p, i) => {
        const initial = (p.name || '?').charAt(0).toUpperCase();
        return (
          <div
            key={p.id}
            className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-full bg-white/15"
            style={{
              marginLeft: i === 0 ? 0 : -8,
              border: '1.5px solid hsl(var(--background))',
            }}
          >
            {p.avatarUrl ? (
              <img src={optimizedImageUrl(p.avatarUrl, 96)} alt="" className="h-full w-full object-cover" loading="lazy" />
            ) : (
              <span className="text-[11px] font-semibold text-white/80">{initial}</span>
            )}
          </div>
        );
      })}
      {extra > 0 && (
        <div
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white/[0.08] text-[10px] font-semibold text-white/70"
          style={{
            marginLeft: -8,
            border: '1.5px solid hsl(var(--background))',
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  );
};

const SessionRow = ({ session, isLast }: { session: ScheduleSession; isLast: boolean }) => (
  <div
    className={cn(
      'grid items-center gap-[10px] px-3 py-[9px]',
      !isLast && 'border-b border-black/5',
    )}
    style={{ gridTemplateColumns: '64px minmax(0,1fr) auto' }}
  >
    <span className="text-[13px] font-medium text-black tabular-nums whitespace-nowrap">
      {session.startMins === null ? 'Time TBC' : fmtMins12(session.startMins)}
    </span>
    <span className="text-[13px] text-black/85 line-clamp-2">{session.title}</span>
    <div className="min-w-[32px]">
      <AvatarStack people={session.people} />
    </div>
  </div>
);

const SessionTable = ({ sessions, flushTop = false }: { sessions: ScheduleSession[]; flushTop?: boolean }) => (
  <div
    className={cn(
      'overflow-hidden border-[0.5px] border-black/10 bg-white',
      flushTop ? 'rounded-b-md border-t-0' : 'rounded-md',
    )}
  >
    {sessions.map((s, i) => (
      <SessionRow key={s.id} session={s} isLast={i === sessions.length - 1} />
    ))}
  </div>
);

// ─── Day grouping ─────────────────────────────────────────────────────────────

const formatDayLabel = (day: string): string => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return day;
  const d = new Date(`${day}T12:00:00`);
  if (isNaN(d.getTime())) return day;
  return d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
};

const todayKeyInTz = (tz: string | null): string => {
  const opts: Intl.DateTimeFormatOptions = {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: tz ?? undefined,
  };
  try {
    const parts = new Intl.DateTimeFormat('en-CA', opts).format(new Date());
    return parts; // en-CA yields YYYY-MM-DD
  } catch {
    const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    return parts;
  }
};

const DayBlock = ({
  day,
  sessions,
  defaultOpen,
}: {
  day: string;
  sessions: ScheduleSession[];
  defaultOpen: boolean;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  const label = formatDayLabel(day);
  const count = sessions.length;
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          'flex w-full items-center justify-between border-[0.5px] border-black/10 bg-white px-3 py-[9px] text-left',
          open ? 'rounded-t-md' : 'rounded-md',
        )}
      >
        <span className="text-[13px] font-medium text-black">
          {label} <span className="text-black/50">· {count} session{count !== 1 ? 's' : ''}</span>
        </span>
        <ChevronDown
          className={cn('h-3 w-3 shrink-0 text-black/50 transition-transform', open && 'rotate-180')}
        />
      </button>
      {open && <SessionTable sessions={sessions} flushTop />}
    </div>
  );
};

// ─── Public component ─────────────────────────────────────────────────────────

type EventScheduleGridProps = {
  schedule: EventPageModel['schedule'];
  eventId: string | null;
  occurrenceId?: string | null;
  fallbackSchedule?: FestivalScheduleItem[] | null;
};

export const EventScheduleGrid = ({
  schedule,
  eventId,
  occurrenceId,
  fallbackSchedule,
}: EventScheduleGridProps) => {
  const overrideProgram = useOccurrenceOverrideProgram(occurrenceId);
  const { data: programItems = [], isLoading } = useProgramItems(overrideProgram ? null : eventId);

  const sessions: ScheduleSession[] = useMemo(() => {
    // Priority 1: Per-occurrence override program
    if (overrideProgram?.length) return normalizeSessions(overrideProgram);

    // Priority 2: Parent event's event_program_items (from DB)
    if (programItems.length) {
      if (fallbackSchedule?.length) {
        const fbPeople = new Map<string, Person[]>();
        for (const s of fromFestivalSchedule(fallbackSchedule)) {
          if (s.people.length > 0) {
            fbPeople.set(`${s.startMins}|${s.type}`, s.people);
          }
        }
        return normalizeSessions(
          programItems.map((item) => ({
            ...item,
            people:
              item.people.length > 0
                ? item.people
                : (fbPeople.get(`${item.startMins}|${item.type}`) ?? []),
          })),
        );
      }
      return normalizeSessions(programItems);
    }
    if (fallbackSchedule?.length) return normalizeSessions(fromFestivalSchedule(fallbackSchedule));
    if (schedule.keyTimes) return normalizeSessions(fromKeyTimes(schedule.keyTimes));
    return [];
  }, [overrideProgram, programItems, fallbackSchedule, schedule.keyTimes]);

  const hasAny = sessions.length > 0;
  if (!hasAny && !isLoading) return null;

  // Group by day when multiple distinct dated days exist
  const uniqueDays = Array.from(new Set(sessions.map((s) => s.day).filter((d): d is string => Boolean(d)))).sort();
  const isMultiDay = uniqueDays.length > 1;

  if (isLoading && !fallbackSchedule?.length && !schedule.keyTimes) {
    return (
      <section>
        {schedule.isCancelled && <CancelledBanner />}
        <div className="flex h-16 items-center justify-center rounded-md border-[0.5px] border-black/10 bg-white">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-black/15 border-t-black/50" />
        </div>
      </section>
    );
  }

  if (isMultiDay) {
    const defaultOpenDay = uniqueDays.find((d) => d >= todayKeyInTz(schedule.timezoneLabel)) ?? uniqueDays[uniqueDays.length - 1];
    return (
      <section className="space-y-2">
        {schedule.isCancelled && <CancelledBanner />}
        {uniqueDays.map((day, idx) => (
          <DayBlock
            key={day}
            day={day}
            // `day === null` matches no DayBlock, so an undated row would render
            // NOWHERE on a multi-day event -- and the P5-native series branch of
            // get_event_program_v1 hard-codes day_event_date NULL, so every
            // time-less item from it arrives that way (223 such rows live).
            // Surface them under the earliest day; each carries its own "Time TBC".
            sessions={sessions.filter((s) => s.day === day || (idx === 0 && s.day === null))}
            defaultOpen={day === defaultOpenDay}
          />
        ))}
      </section>
    );
  }

  return (
    <section>
      {schedule.isCancelled && <CancelledBanner />}
      <SessionTable sessions={sessions} />
    </section>
  );
};

const CancelledBanner = () => (
  <div className="mb-2 inline-flex items-center gap-1 rounded-full border border-red-500/40 bg-red-500/10 px-3 py-1">
    <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
    <span className="text-[10px] uppercase tracking-[0.15em] text-red-400">Cancelled</span>
  </div>
);
