// People arc S4: the teacher world (the studio timetable) as data. Pure, so the matrix test runs every
// prod shape through it without rendering. Every fact comes from facts/: this file only picks.
import { buildSignInHref } from '@/lib/authRouting';
import { resolvePublicName } from '@/lib/publicName';
import { instagramUrl, normalizeUrl } from '@/components/dj/djFormat';
import { cityLabel, flagCode, gigDateLabel, languageLine, publicName, showsJoinInvite, timeLabel, wallDayOf, worldNames } from '../../facts';
import { linkText } from '../dj/model';

export const CLASSES_LABEL = 'Classes this week';
export const INVITE_LABEL = 'Dance bachata too? Get your own card';

/** One row of get_profile_event_timeline_v2('teacher', ...), as useProfileProgramAppearances maps it. */
export type TeacherClass = { event_id: string; event_name: string | null; event_start_time: string | null; event_location: string | null };

export type TeacherWorldInput = {
  /** The get_public_teacher_detail_v1 row (only the fields the world reads). */
  row: {
    entity_id?: string | null;
    first_name?: string | null;
    surname?: string | null;
    city?: string | null;
    nationality_code?: string | null;
    languages?: readonly unknown[] | null;
    website?: string | null;
    instagram?: string | null;
    facebook?: string | null;
    /** The extra detail (owner: only when filled, under the classes). Prod 2026-10-24: 1 / 6 / 1 filled. */
    years_teaching?: number | null;
    teaching_styles?: readonly (string | null)[] | null;
    offers_private?: boolean | null;
  };
  /** Every timeline row, any order; split here on the London wall-clock day. */
  classes: readonly TeacherClass[];
  /** londonTodayKey() ("2026-10-24"); passed in so the model stays pure. */
  today: string;
  /** The classes calendar (buildCityPath(citySlug, 'classes')). */
  classesHref: string;
  /** This page's path, where sign-up returns to. */
  pathname: string;
  /** The visitor (useAuth().user): D8'' shows the invite to signed-out visitors only. */
  viewer: { is_anonymous?: boolean | null } | null | undefined;
};

export type TeacherClassRow = { eventId: string; time: string | null; date: string | null; name: string; venue: string | null };

export type TeacherWorldView = {
  big: string;
  flag: string | null;
  /** "Teaches in Madrid", "Speaks Spanish, English": each only when it has something to say (no city = no line). */
  lines: string[];
  heading: 'Next class' | 'Next classes';
  upcoming: TeacherClassRow[];
  /** Nothing coming up (D11): a muted line, then one button to the classes calendar. */
  emptyAction: { note: string; label: string; href: string } | null;
  /** Years teaching, styles, private lessons: each only when filled, shown under the classes. */
  details: { label: string; value: string }[];
  /** ONE contact row (the old page showed the website twice): website, else Instagram, else Facebook. */
  contact: { label: string; value: string; href: string } | null;
  invite: { label: string; href: string } | null;
};

const text = (v: string | null | undefined): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

function detailsOf(row: TeacherWorldInput['row']): TeacherWorldView['details'] {
  const years = typeof row.years_teaching === 'number' && row.years_teaching >= 1 ? Math.floor(row.years_teaching) : null;
  const styles = [...new Set((row.teaching_styles ?? []).map((s) => text(s)).filter((s): s is string => !!s))];
  return [
    years ? { label: 'Teaching for', value: years === 1 ? '1 year' : `${years} years` } : null,
    styles.length ? { label: 'Styles', value: styles.join(', ') } : null,
    row.offers_private === true ? { label: 'Private lessons', value: 'Offered' } : null,
  ].filter((d): d is { label: string; value: string } => !!d);
}

export function teacherWorldView(p: TeacherWorldInput): TeacherWorldView {
  const name = resolvePublicName({ id: p.row.entity_id, first_name: p.row.first_name, surname: p.row.surname });
  const { big } = worldNames({ name }, 'teacher');
  // No name at all: the h1 says "Teacher" (worldNames), but "Learn with Teacher" reads like a bug.
  const first = publicName(p.row.first_name) ?? publicName(name) ?? null;
  const city = cityLabel(p.row.city);
  const langs = languageLine(p.row.languages);
  const lines = [city ? `Teaches in ${city}` : null, langs ? `Speaks ${langs}` : null].filter((l): l is string => !!l);

  const dated = p.classes.filter((c) => c.event_id);
  const upcoming = dated
    .filter((c) => (wallDayOf(c.event_start_time) ?? '') >= p.today)
    .sort((x, y) => (x.event_start_time ?? '').localeCompare(y.event_start_time ?? ''))
    .map((c) => ({
      eventId: c.event_id,
      time: timeLabel(c.event_start_time),
      date: gigDateLabel(c.event_start_time),
      name: text(c.event_name) ?? 'Class',
      venue: text(c.event_location),
    }));
  const hadPast = dated.length > upcoming.length;

  const link = [normalizeUrl(p.row.website ?? null), instagramUrl(p.row.instagram ?? null), normalizeUrl(p.row.facebook ?? null)].find(Boolean);
  return {
    big,
    flag: flagCode(p.row.nationality_code),
    lines,
    heading: upcoming.length >= 2 ? 'Next classes' : 'Next class',
    upcoming,
    emptyAction: upcoming.length
      ? null
      : { note: hadPast ? 'No classes coming up yet.' : 'No classes on the calendar yet.', label: CLASSES_LABEL, href: p.classesHref },
    details: detailsOf(p.row),
    contact: link ? { label: first ? `Learn with ${first}` : 'Learn more', value: linkText(link), href: link } : null,
    invite: showsJoinInvite(p.viewer) ? { label: INVITE_LABEL, href: buildSignInHref(p.pathname, 'signup') } : null,
  };
}
