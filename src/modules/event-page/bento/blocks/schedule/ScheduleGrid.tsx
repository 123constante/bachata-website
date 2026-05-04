// F.2.b — ScheduleGrid: matrix layout wrapper.
//
// Owns: time column, section headers, room column headers, slot rows,
// stripe overlay, and the single-room vs multi-room layout switch.
// SessionCell is the leaf; ScheduleGrid is the container.
//
// Props:
//   rooms    — ordered room list ([] or length-1 = single-room mode)
//   sessions — already-normalised sessions for the *current* day
//   eventId  — forwarded to SessionCell → PeopleStack for click attribution

import { useMemo } from 'react';
import type { ScheduleSession } from '@/modules/event-page/sections/EventScheduleGrid';
import { SessionCell, kindFor } from './SessionCell';

// ─── Time helpers ─────────────────────────────────────────────────────────────

const fmtMins12 = (mins: number): string => {
  const h24 = Math.floor(mins / 60) % 24;
  const m   = mins % 60;
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  const ampm = h24 < 12 ? 'AM' : 'PM';
  return `${h12}:${String(m).padStart(2, '0')} ${ampm}`;
};

const fmtDuration = (startMins: number, endMins: number): string => {
  const diff = Math.max(0, endMins - startMins);
  if (diff < 60) return `${diff} MIN`;
  const hrs = diff / 60;
  if (Number.isInteger(hrs)) return hrs === 1 ? '1 HR' : `${hrs} HRS`;
  return diff < 90 ? `${diff} MIN` : `${hrs.toFixed(1)} HRS`;
};

// ─── Normalisation (sort + overnight fold) ───────────────────────────────────

const normalize = (sessions: ScheduleSession[]): ScheduleSession[] => {
  if (!sessions.length) return [];
  return [...sessions]
    .sort((a, b) => a.startMins - b.startMins || a.id.localeCompare(b.id))
    .map((s) => {
      let end = s.endMins;
      if (end > 0 && end <= s.startMins) end += 24 * 60;
      return { ...s, endMins: end };
    });
};

// ─── Slot grouping ────────────────────────────────────────────────────────────

type Slot = {
  startMins: number;
  endMins: number;
  sessions: ScheduleSession[];
  hasParty: boolean;
};

const groupIntoSlots = (sessions: ScheduleSession[]): Slot[] => {
  const slots: Slot[] = [];
  for (const s of sessions) {
    const last = slots[slots.length - 1];
    if (last && last.startMins === s.startMins) {
      last.sessions.push(s);
      last.endMins = Math.max(last.endMins, s.endMins);
    } else {
      slots.push({
        startMins: s.startMins,
        endMins:   s.endMins,
        sessions:  [s],
        hasParty:  false,
      });
    }
  }
  for (const slot of slots) {
    slot.hasParty = slot.sessions.some(
      (s) => s.type === 'party' || s.type === 'performance' || s.type === 'show',
    );
  }
  return slots;
};

// ─── Section grouping ─────────────────────────────────────────────────────────

type Section = {
  kind: 'class' | 'party';
  slots: Slot[];
};

const groupIntoSections = (slots: Slot[]): Section[] => {
  const sections: Section[] = [];
  for (const slot of slots) {
    const kind: 'class' | 'party' = slot.hasParty ? 'party' : 'class';
    const last = sections[sections.length - 1];
    if (last && last.kind === kind) {
      last.slots.push(slot);
    } else {
      sections.push({ kind, slots: [slot] });
    }
  }
  return sections;
};

// ─── Room column headers ──────────────────────────────────────────────────────
//
// One sticky row at the top that names each room column. Hidden when rooms < 2.

const RoomColumnHeaders = ({ rooms }: { rooms: string[] }) => {
  if (rooms.length < 2) return null;
  return (
    <div
      className="mb-[10px] grid gap-[6px]"
      style={{
        gridTemplateColumns: `64px repeat(${rooms.length}, 1fr)`,
        borderBottom: '1px solid var(--bento-hairline)',
        paddingBottom: '6px',
      }}
    >
      {/* Leading spacer aligned with the time column on each slot row below */}
      <div />
      {rooms.map((room) => (
        <div
          key={room}
          className="text-center text-[11px] font-bold uppercase leading-tight"
          style={{
            fontFamily: '"Fraunces", Georgia, serif',
            letterSpacing: '0.06em',
            color: 'hsl(var(--bento-accent))',
          }}
        >
          {room}
        </div>
      ))}
    </div>
  );
};

// ─── Time column cell ─────────────────────────────────────────────────────────

const TimeCell = ({
  startMins,
  endMins,
  isRange,
}: {
  startMins: number;
  endMins: number;
  isRange: boolean;
}) => (
  <div className="text-center" style={{ paddingTop: '2px' }}>
    <div
      style={{
        fontSize: '12px',
        fontWeight: 700,
        color: 'hsl(var(--bento-accent))',
        lineHeight: 1.1,
      }}
    >
      {fmtMins12(startMins)}
    </div>
    <div
      className="font-mono"
      style={{
        fontSize: '9px',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.10em',
        color: 'hsl(var(--bento-fg-muted))',
        marginTop: '3px',
      }}
    >
      {isRange ? `– ${fmtMins12(endMins)}` : fmtDuration(startMins, endMins)}
    </div>
  </div>
);

// ─── ScheduleGrid ─────────────────────────────────────────────────────────────

export type ScheduleGridProps = {
  /**
   * Ordered room list. Pass [] or a single-element array for single-room
   * mode (no column headers, single-column slot rows).
   */
  rooms: string[];
  /** Already-normalised sessions for the *current* day (day-filtering lives
   *  in the parent — ScheduleBlock for standard events, FestivalProgramSection
   *  for festivals). */
  sessions: ScheduleSession[];
  eventId: string | null;
};

export const ScheduleGrid = ({ rooms, sessions, eventId }: ScheduleGridProps) => {
  const isMultiRoom = rooms.length >= 2;

  const normalizedSessions = useMemo(() => normalize(sessions), [sessions]);
  const slots    = useMemo(() => groupIntoSlots(normalizedSessions), [normalizedSessions]);
  const sections = useMemo(() => groupIntoSections(slots), [slots]);

  // Per-column stripe overlay — alternating transparent / subtle-light tint.
  // Runs continuously behind the room column headers AND all sections so the
  // shading reads as one rectangle per room. left=102px aligns stripe edges
  // with the card-column grid (24px vertical-label + 8px gap + 64px time-col + 6px gap).
  const scheduleStripeBg = useMemo(() => {
    if (!isMultiRoom || rooms.length < 2) return undefined;
    const n = rooms.length;
    const stops: string[] = [];
    for (let i = 0; i < n; i++) {
      const start = ((i / n) * 100).toFixed(4);
      const end   = (((i + 1) / n) * 100).toFixed(4);
      const color = i % 2 === 0
        ? 'transparent'           // even-index — no tint
        : 'rgba(255,255,255,0.08)'; // odd-index — lighter side
      stops.push(`${color} ${start}% ${end}%`);
    }
    return `linear-gradient(to right, ${stops.join(', ')})`;
  }, [isMultiRoom, rooms.length]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Stripe overlay */}
      {scheduleStripeBg && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: '-10px',
            bottom: '-10px',
            left: '102px',
            right: '-10px',
            backgroundImage: scheduleStripeBg,
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />
      )}

      {/* Room column headers — aligned to section grid (24px spine + 8px gap + content) */}
      <div
        aria-hidden="true"
        style={{
          display: 'grid',
          gridTemplateColumns: '24px 1fr',
          gap: '8px',
          position: 'relative',
          zIndex: 1,
        }}
      >
        <div />
        <RoomColumnHeaders rooms={rooms} />
      </div>

      {/* Sections */}
      <div
        className="flex flex-col gap-[14px]"
        style={{ position: 'relative', zIndex: 1 }}
      >
        {sections.map((section, sectionIdx) => (
          <div
            key={`section-${section.kind}-${sectionIdx}-${section.slots[0]?.startMins ?? 'x'}`}
            style={{
              padding: '8px 0',
              display: 'grid',
              gridTemplateColumns: '24px 1fr',
              alignItems: 'stretch',
              gap: '8px',
              borderTop:
                sectionIdx > 0
                  ? '0.5px solid hsl(var(--bento-accent) / 0.30)'
                  : 'none',
              paddingTop:  sectionIdx > 0 ? '16px' : '8px',
              marginTop:   sectionIdx > 0 ? '4px'  : '0',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {/* Vertical section label — book-spine style */}
            <div
              style={{
                writingMode: 'vertical-rl',
                transform: 'rotate(180deg)',
                fontSize: '11px',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.20em',
                fontFamily: '"Fraunces", Georgia, serif',
                color: 'hsl(var(--bento-accent))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px 0',
              }}
              aria-label={section.kind === 'party' ? 'Party section' : 'Classes section'}
            >
              {section.kind === 'party' ? 'Party' : 'Classes'}
            </div>

            {/* Slots */}
            <div className="flex flex-col gap-[14px] min-w-0">
              {section.slots.map((slot) => {
                const isRange = slot.hasParty;

                if (isMultiRoom) {
                  // ── Multi-room: time column + one cell per room ──────────
                  return (
                    <div
                      key={`slot-${slot.startMins}-${slot.sessions[0]?.id ?? 'x'}`}
                      className="grid items-center gap-[6px]"
                      style={{
                        gridTemplateColumns: `64px repeat(${rooms.length}, 1fr)`,
                      }}
                    >
                      <TimeCell
                        startMins={slot.startMins}
                        endMins={slot.endMins}
                        isRange={isRange}
                      />
                      {rooms.map((room) => {
                        const cellSessions = slot.sessions.filter((s) => s.room === room);
                        if (cellSessions.length === 0) {
                          return (
                            <div
                              key={`empty-${room}`}
                              className="flex items-center justify-center rounded-[10px] py-2 opacity-25"
                              style={{ color: 'hsl(var(--bento-fg-muted))' }}
                              aria-label={`No session in ${room} at this time`}
                            >
                              —
                            </div>
                          );
                        }
                        return (
                          <div key={`cell-${room}`} className="flex flex-col gap-[6px]">
                            {cellSessions.map((s) => (
                              <SessionCell
                                key={s.id}
                                session={s}
                                kind={kindFor(s.type)}
                                isMultiRoom={true}
                                eventId={eventId}
                              />
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  );
                }

                // ── Single-room: one row per session (time + content) ──────
                return (
                  <div
                    key={`slot-${slot.startMins}-${slot.sessions[0]?.id ?? 'x'}`}
                    className="flex flex-col gap-[6px]"
                  >
                    {slot.sessions.map((s) => (
                      <div
                        key={s.id}
                        className="grid items-start gap-[10px] px-1 py-1"
                        style={{ gridTemplateColumns: '64px 1fr' }}
                      >
                        <TimeCell
                          startMins={s.startMins}
                          endMins={s.endMins}
                          isRange={
                            s.type === 'party' ||
                            s.type === 'performance' ||
                            s.type === 'show'
                          }
                        />
                        <SessionCell
                          session={s}
                          kind={kindFor(s.type)}
                          isMultiRoom={false}
                          eventId={eventId}
                        />
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
