// ONE mapping for how a session reads in a one-line summary, shared by the date
// page (dates/index.tsx SessionRow, DatePreview) and the event page's next-date
// ScheduleCard (events/EditorRows.tsx), so the two screens never disagree.
// Levels follow the Levels rule (sessionLevels / levelsApplyTo): only a class or
// a masterclass shows a level, so a party never does, on either screen.

import { LEVEL_LABEL, TYPE_LABEL, sessionLevels, type LevelKey } from './programmeModel';

interface SessionLike {
  type: string | null;
  title: string;
  start: string;
  end: string;
  levels: string[];
}

/** "Class", "Party"; "Session" for a type the screen does not know. */
export const typeLabel = (type: string | null) => (type && TYPE_LABEL[type]) || 'Session';

/** "19:00-20:00", just the start when there is no end, or null. */
export const timesLabel = (row: Pick<SessionLike, 'start' | 'end'>) =>
  row.start && row.end ? `${row.start}\u2013${row.end}` : row.start || null;

/** Level keys in words ("Beginner, Improver"). */
export const levelsLabel = (levels: string[]) => levels.map((l) => LEVEL_LABEL[l as LevelKey] ?? l).join(', ');

/** The session's levels in words, or null: none for a type without levels. */
export const sessionLevelsLabel = (row: Pick<SessionLike, 'type' | 'levels'>) => {
  const levels = sessionLevels(row);
  return levels.length ? levelsLabel(levels) : null;
};

/** The one-line summary: time range, then levels ("22:00-02:00 \u00b7 Intermediate"); null when neither. */
export const sessionSummary = (row: SessionLike): string | null =>
  [timesLabel(row), sessionLevelsLabel(row)].filter(Boolean).join(' \u00b7 ') || null;

/** The typed title when it says more than the type; null when blank or just the type's own word (any case). */
export const ownTitle = (row: Pick<SessionLike, 'type' | 'title'>): string | null => {
  const t = row.title.trim();
  return t && t.toLowerCase() !== typeLabel(row.type).toLowerCase() ? t : null;
};

/** The session's name: its own title, else the type (so the type is never shown twice). */
export const sessionName = (row: Pick<SessionLike, 'type' | 'title'>) => ownTitle(row) ?? typeLabel(row.type);

/** A one-line heading naming the type once: "Party", or "Party: Late Social". */
export const sessionHeading = (row: Pick<SessionLike, 'type' | 'title'>) => {
  const own = ownTitle(row);
  return own ? `${typeLabel(row.type)}: ${own}` : typeLabel(row.type);
};
