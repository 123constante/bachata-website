import { useEffect } from 'react';
import { nightGoingKnown } from './goingRpc';
import { useNightsGoing } from './useNightGoing';

/** Known going counts by occurrence id. A night the read did not answer for is absent. */
export type CalendarGoingCounts = Record<string, number>;

type CalendarGoingFeedProps = {
  occurrenceIds: readonly string[];
  onCounts: (counts: CalendarGoingCounts) => void;
};

/**
 * The calendar's going count (Going P2): ONE batched get_nights_going_v1 read
 * through useNightsGoing (same keys, so a tap elsewhere invalidates it), handed
 * back as plain numbers. Renders nothing.
 *
 * Why a component, loaded lazily by EventCalendar: a static import of the going
 * hooks put the going module (and the profile-completion code it reads) into the
 * first load of /parties and /classes -- +3 first-load requests (perf-budget
 * chunk ratchet 48 vs 45) for a count that never shows while the switch is off.
 * EventCalendar mounts this only while GOING_CHECKIN_ENABLED is on.
 *
 * get_calendar_events_v2 returns COALESCE(legacy_occurrence_id, p5 id), and the
 * read silently drops an id that is not a P5 night: such a night gets NO count
 * (nightGoingKnown), never a made-up "0 going".
 */
const CalendarGoingFeed = ({ occurrenceIds, onCounts }: CalendarGoingFeedProps) => {
  const { data } = useNightsGoing(occurrenceIds);
  useEffect(() => {
    if (!data) return;
    const counts: CalendarGoingCounts = {};
    for (const [id, night] of Object.entries(data)) {
      if (nightGoingKnown(night)) counts[id] = night.going_count;
    }
    onCounts(counts);
  }, [data, onCounts]);
  return null;
};

export default CalendarGoingFeed;
