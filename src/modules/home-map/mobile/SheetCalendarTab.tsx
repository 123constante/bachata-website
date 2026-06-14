// Festival Map mobile feed -- "Calendar" tab. The month grid + selected-day
// list now live in the shared cards/CalendarPanel (reused by the desktop list
// rail too); this file just slots it into the mobile sheet's tab routing.

import type { UseMapListResult } from '../useMapList';
import { CalendarPanel } from '../cards/CalendarPanel';

export function SheetCalendarTab({ state }: { state: UseMapListResult }) {
  return <CalendarPanel state={state} />;
}
