import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useCalendarEvents } from '@/hooks/useCalendarEventsRpc';
import { buildCityPath } from '@/lib/cityPath';
import { londonDayRangeUtc, londonTodayKey } from '@/lib/londonDate';
import { wallClockTimeKey } from '@/lib/time/wallClock';
import { linkStyle } from '../nights/nightsStyles';
import { DateBlock } from '../nights/nightsUi';
import { ALL_CITIES_PATH, useDancerCitySlug } from '../nights/useBrowseHref';
import { editHref } from '../me/model';
import { BROWSE_EVENTS_LABEL } from './homeCopy';

const WEEK_DAYS = 7;
const MAX_ROWS = 3;

/**
 * "What's on this week": 3 upcoming events in the DANCER'S OWN city
 * (profile.based_city_id -> slug; audit M20), never the city the site was last
 * browsed in, through the hook the calendar already uses (useCalendarEvents).
 * No city: says what to do and links straight to the city field.
 */
export const WhatsOn = ({ cityId }: { cityId: string | null }) => {
  const hasCity = Boolean(cityId);
  const city = useDancerCitySlug(cityId);
  const citySlug = city.data ?? null;
  const todayKey = londonTodayKey();
  const range = useMemo(() => londonDayRangeUtc(todayKey, WEEK_DAYS), [todayKey]);
  const enabled = hasCity && Boolean(citySlug);
  const events = useCalendarEvents({ rangeStart: range.start, rangeEnd: range.end, citySlug, enabled });
  const { data } = events;
  const isLoading = city.isLoading || (enabled && events.isLoading);
  // A city we cannot resolve to a calendar is a failed read, never "nothing on".
  const isError = city.isError || events.isError || (city.isSuccess && !citySlug);

  const rows = useMemo(
    () =>
      (data ?? [])
        .filter((e) => !e.is_cancelled)
        .sort((a, b) => a.instance_date.localeCompare(b.instance_date) || (wallClockTimeKey(a.occurrence_starts_at) ?? '').localeCompare(wallClockTimeKey(b.occurrence_starts_at) ?? ''))
        .slice(0, MAX_ROWS),
    [data],
  );
  const browseHref = citySlug ? buildCityPath(citySlug, 'calendar') : ALL_CITIES_PATH;

  return (
    <section className="da-card" aria-label="What's on this week" data-testid="whats-on">
      <h2 style={{ fontSize: 16, fontWeight: 800, margin: '0 0 6px' }}>What&rsquo;s on this week</h2>
      {!hasCity ? (
        <p className="da-muted" style={{ margin: 0, fontSize: 14 }} data-testid="whats-on-no-city">
          Add your city to see what&rsquo;s on near you.{' '}
          <Link to={editHref('city')} style={linkStyle}>Add my city</Link>
        </p>
      ) : isLoading ? (
        <p className="da-muted" style={{ margin: 0, fontSize: 14 }}>Loading&hellip;</p>
      ) : isError ? (
        <p className="da-muted" style={{ margin: 0, fontSize: 14 }}>We couldn&rsquo;t load this week&rsquo;s events.</p>
      ) : rows.length === 0 ? (
        <p className="da-muted" style={{ margin: 0, fontSize: 14 }} data-testid="whats-on-empty">Nothing listed in your city this week yet.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: 8 }}>
          {rows.map((e) => (
            <li key={`${e.event_id}-${e.instance_date}`} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <DateBlock dateKey={String(e.instance_date).slice(0, 10)} />
              <a href={`/event/${e.event_id}`} style={{ color: 'var(--da-text)', minWidth: 0, minHeight: 44, display: 'block' }} data-testid="whats-on-row">
                <b style={{ display: 'block', fontSize: 15, overflowWrap: 'anywhere' }}>{e.name}</b>
                <span className="da-muted" style={{ fontSize: 13 }}>
                  {[e.location, wallClockTimeKey(e.occurrence_starts_at)].filter(Boolean).join(' \u00B7 ')}
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
      <a href={browseHref} style={linkStyle} data-testid="whats-on-browse">{BROWSE_EVENTS_LABEL} &#8599;</a>
    </section>
  );
};
