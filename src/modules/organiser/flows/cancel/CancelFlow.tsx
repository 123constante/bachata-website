import WhichEvent from './WhichEvent';
import WhichDate from './WhichDate';
import Confirm from './Confirm';

export type CancelStep = 'event' | 'date' | 'confirm';

const STEPS = { event: WhichEvent, date: WhichDate, confirm: Confirm } as const;

/**
 * Cancel a date (S3, boards C11 -> C12 -> C13 -> Done with Put it back, D61).
 * One lazy chunk for the whole flow; the route names the step, the URL carries the ids.
 */
export default function CancelFlow({ step }: { step: CancelStep }) {
  const Screen = STEPS[step];
  return <Screen />;
}
