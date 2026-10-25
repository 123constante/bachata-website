/**
 * P3 organiser model types (mockup C3). Pure data: no React, no Supabase.
 * Dates are London wall-clock ISO days ('2026-10-30'); times are 'HH:MM' 24h.
 */

export type IsoDate = string;

/**
 * A session's kind = the stored item type (event_series_program_item_p5.type). C3's
 * "What is it?" picks one of the first four; prod also holds the last three (25 Oct 2026:
 * party 370, class 280, masterclass 19, performance 3, workshop 2, competition 1, show 1).
 */
export type SessionKind = 'class' | 'workshop' | 'party' | 'show' | 'masterclass' | 'performance' | 'competition';

/** A person's role on a session (C3 chips Teaches / DJs / Performs). */
export type RoleKey = 'teach' | 'dj' | 'perform';

export interface P3Person {
  name: string;
  role: RoleKey;
}

/** The fields a session carries, and the fields a change may replace. */
export interface SessionFields {
  kind: SessionKind;
  /** null or '' = no name yet (239 prod items). */
  title: string | null;
  /** 'HH:MM' or 'HH:MM:SS'; null = no time yet (223 prod items, mostly parties). */
  start: string | null;
  end: string | null;
  /** The stored ends_next_day; null/undefined = work it out from the times. */
  endsNextDay?: boolean | null;
  room?: string;
  levels?: string[];
  people: P3Person[];
}

/** "This and later": ONE forward change on a series session, applied on `from` and every later date. */
export interface ForwardChange {
  from: IsoDate;
  patch: Partial<SessionFields>;
}

export interface P3Session extends SessionFields {
  id: string;
  forward?: ForwardChange[];
}

/** A per-date change to one series session; `notRunning` = cancelled on this date only. */
export interface SessionChange extends Partial<SessionFields> {
  notRunning?: boolean;
}

/** `skip` = a break (removed date); it is not a class and not a cancel. */
export type DateStatus = 'scheduled' | 'cancelled' | 'skip';

export interface P3Date {
  date: IsoDate;
  status: DateStatus;
  /** Keyed by series session id. */
  changes?: Record<string, SessionChange>;
  /** Sessions added to this date only. */
  extra?: P3Session[];
}

/** The six shapes of CONTRACT.md section 1. */
export type P3Kind = 'weekly' | 'monthly' | 'course' | 'custom' | 'festival' | 'oneoff';

export interface P3Event {
  kind: P3Kind;
  sessions: P3Session[];
  dates: P3Date[];
}

/** One session as it applies on one date (base, then forward changes, then this date's change). */
export interface DaySession extends SessionFields {
  id: string;
  base: P3Session;
  notRunning: boolean;
  changed: boolean;
  extra: boolean;
}
