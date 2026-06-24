// Festival Map mobile feed -- "All Events" tab (the homepage default). Renders
// the shared AllEventsList: today's local group is highlighted, later days are
// muted, and festivals abroad collapse into a "further afield" section at the
// bottom. Navigational search lives in the header omnibox on mobile, so there is
// no in-feed search field here (the q filter stays wired for desktop).

import type { UseMapListResult } from '../useMapList';
import { AllEventsList } from '../cards/AllEventsList';

export function SheetAllTab({ state }: { state: UseMapListResult }) {
  return <AllEventsList state={state} stickyHeaders />;
}
