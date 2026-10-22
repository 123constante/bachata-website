import WhichEvent from './WhichEvent';
import WhichDay from './WhichDay';
import Time from './Time';
import { SeriesLockGate } from '@/modules/organiser/events/ProfileLock';

export type AddStep = 'event' | 'day' | 'time';

const STEPS = { event: WhichEvent, day: WhichDay, time: Time } as const;

/**
 * Add a date (S3, boards C7 -> C8 -> C9 -> Done; C15 enters at C8). One lazy
 * chunk for the whole flow; the route names the step, the URL carries the ids.
 */
export default function AddFlow({ step }: { step: AddStep }) {
  const Screen = STEPS[step];
  // C14: adding a date to an event is locked while profiles are unfinished; choosing the event is not.
  return step === 'event' ? <Screen /> : <SeriesLockGate title="Add a date"><Screen /></SeriesLockGate>;
}
