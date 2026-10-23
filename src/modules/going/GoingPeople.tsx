import { Link } from 'react-router-dom';
import { emitProfileView } from '@/lib/profileViewEmit';
import { hrefFor } from '@/lib/searchEntities';
import { goingCountText, moreLabel, moreText, personLinkLabel } from './goingCopy';
import type { GoingPerson } from './goingRpc';
import { BENTO_GOING_THEME, type GoingTheme } from './goingTheme';

/** The most people a row shows (get_nights_going_v1's default p_limit). */
export const GOING_PEOPLE_MAX = 8;

/** The first letter of a first name, upper case; "?" when there is none. */
export const goingInitial = (firstName: string | null | undefined): string => {
  const ch = Array.from((firstName ?? '').trim().replace(/^[^\p{L}\p{N}]+/u, ''))[0];
  return ch ? ch.toUpperCase() : '?';
};

/**
 * The people actually shown, and "+N more" = going_count - shown. `peopleCount`
 * = the count the list was read with (useNightGoing): while a save is in flight
 * the count line moves at once but "+N more" stays on the list's own count, so
 * the viewer never shows up as "+1 more" before the list is re-read.
 */
export const goingPeopleModel = (count: number, people: readonly GoingPerson[], max = GOING_PEOPLE_MAX, peopleCount?: number) => {
  const shown = people.slice(0, max);
  if (peopleCount !== undefined) {
    return { shown, total: Math.max(0, count), extra: Math.max(0, Math.max(peopleCount, shown.length) - shown.length) };
  }
  const total = Math.max(count, shown.length);
  return { shown, total, extra: Math.max(0, total - shown.length) };
};

type Props = {
  count: number;
  /** useNightGoing's peopleCount: keeps "+N more" stable while a save is in flight. */
  peopleCount?: number;
  people: readonly GoingPerson[];
  /** An ended night: "5 went". */
  past?: boolean;
  max?: number;
  theme?: GoingTheme;
  /** For the profile-view telemetry of a tapped person. */
  context?: string;
  eventId?: string | null;
  /** Hide the count line (a surface that prints the count itself). */
  hideCount?: boolean;
};

const FACE = 32;

/**
 * The count and up to 8 people going to ONE night: first name always, photo
 * only when the dancer switched it on (photo_url non-null), an initials circle
 * otherwise. A person links to their dancer page only when dancer_profile_id is
 * non-null (a hidden public page is name only, no link). "+N more" is
 * going_count minus the people shown.
 */
export const GoingPeople = ({
  count,
  peopleCount,
  people,
  past = false,
  max = GOING_PEOPLE_MAX,
  theme = BENTO_GOING_THEME,
  context = 'going-people',
  eventId = null,
  hideCount = false,
}: Props) => {
  const { shown, total, extra } = goingPeopleModel(count, people, max, peopleCount);
  return (
    <div data-testid="going-people">
      {!hideCount && (
        <p className="text-[14px] font-semibold" style={{ color: total > 0 ? theme.fg : theme.muted }} data-testid="going-count">
          {goingCountText(total, past)}
        </p>
      )}
      {(shown.length > 0 || extra > 0) && (
        <ul className="mt-2 flex flex-wrap gap-1" aria-label={goingCountText(total, past)}>
          {shown.map((p, i) => {
            const inner = (
              <>
                {p.photo_url ? (
                  <img
                    src={p.photo_url}
                    alt=""
                    loading="lazy"
                    width={FACE}
                    height={FACE}
                    className="rounded-full object-cover"
                    style={{ width: FACE, height: FACE, border: theme.face.border }}
                    data-testid="going-photo"
                  />
                ) : (
                  <span
                    aria-hidden
                    className="flex items-center justify-center rounded-full text-[13px] font-bold"
                    style={{ width: FACE, height: FACE, ...theme.face }}
                    data-testid="going-initial"
                  >
                    {goingInitial(p.first_name)}
                  </span>
                )}
                <span className="block w-full truncate text-center text-[11px] leading-tight" style={{ color: theme.fg }}>
                  {p.first_name}
                </span>
              </>
            );
            const box = 'flex min-h-[48px] w-[52px] flex-col items-center justify-start gap-0.5 rounded-[10px] pt-0.5';
            return (
              <li key={`${p.dancer_profile_id ?? 'n'}-${i}`}>
                {p.dancer_profile_id ? (
                  <Link
                    to={hrefFor('dancer', p.dancer_profile_id)}
                    className={box}
                    aria-label={personLinkLabel(p.first_name)}
                    data-testid="going-person-link"
                    onClick={() =>
                      emitProfileView({ personId: p.dancer_profile_id as string, profileType: 'dancer', context, eventId })
                    }
                  >
                    {inner}
                  </Link>
                ) : (
                  <span className={box} data-testid="going-person">
                    {inner}
                  </span>
                )}
              </li>
            );
          })}
          {extra > 0 && (
            <li>
              <span className="flex min-h-[48px] w-[52px] flex-col items-center gap-0.5 pt-0.5" data-testid="going-more">
                <span
                  className="flex items-center justify-center rounded-full text-[11px] font-bold"
                  style={{ width: FACE, height: FACE, ...theme.face }}
                  aria-hidden
                >
                  {`+${extra}`}
                </span>
                <span className="text-[11px] leading-tight" style={{ color: theme.muted }}>
                  <span aria-hidden>{moreText(extra).replace(/^\+\d+ /, '')}</span>
                  <span className="sr-only">{moreLabel(extra)}</span>
                </span>
              </span>
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
