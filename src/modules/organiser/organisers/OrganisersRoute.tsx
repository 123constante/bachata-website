import { useParams } from 'react-router-dom';
import { useRebuildSwitch } from '@/modules/organiser/shell/rebuildSwitch';
import SeriesOrganisers from '../events/SeriesOrganisers';
import { useEventWorkspace } from '../events/eventsApi';
import OrganisersScreen from './OrganisersScreen';

/**
 * /account/o/events/:seriesId/organisers (ER-FIX2-S4, F1): main's SW1 screen stays the default;
 * the rebuilt co-organiser screen shows only when the rebuild switch is on for THIS event
 * (decision 2: its owner page is on the allowlist, so every organiser on it gets the same screen).
 * Until the event is read the SW1 screen shows its own loading state, never the rebuilt one first.
 */
export default function OrganisersRoute() {
  const { seriesId = '' } = useParams();
  const ws = useEventWorkspace(seriesId);
  const rebuilt = useRebuildSwitch(ws.data?.organiserIds ?? null);
  return rebuilt ? <OrganisersScreen /> : <SeriesOrganisers />;
}
