import WhichEvent from './WhichEvent';
import WhichDay from './WhichDay';
import Time from './Time';

export type AddStep = 'event' | 'day' | 'time';

const STEPS = { event: WhichEvent, day: WhichDay, time: Time } as const;

/**
 * Add a date (S3, boards C7 -> C8 -> C9 -> Done; C15 enters at C8). One lazy
 * chunk for the whole flow; the route names the step, the URL carries the ids.
 */
export default function AddFlow({ step }: { step: AddStep }) {
  const Screen = STEPS[step];
  return <Screen />;
}
