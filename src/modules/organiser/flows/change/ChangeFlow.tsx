import WhichEvent from './WhichEvent';
import WhichDate from './WhichDate';
import WhatChanges from './WhatChanges';
import Time from './Time';
import Venue from './Venue';
import Day from './Day';

export type ChangeStep = 'event' | 'date' | 'what' | 'time' | 'venue' | 'day';

const STEPS = { event: WhichEvent, date: WhichDate, what: WhatChanges, time: Time, venue: Venue, day: Day } as const;

/**
 * Change a date (S2, boards C2 -> C3 -> C4 -> C5/C5b/C5c -> Done). One lazy
 * chunk for the whole flow; the route names the step, the URL carries the ids.
 */
export default function ChangeFlow({ step }: { step: ChangeStep }) {
  const Screen = STEPS[step];
  return <Screen />;
}
