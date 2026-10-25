import { EmptyState } from '@/modules/organiser/ui';
import { MoonArt } from '../art';
import { ScreenTitle } from '../blocks';
import { FIND_A_NIGHT } from '../../copy/sharedCopy';
import { NIGHTS_OFF_LINE } from './nightsDates';

/**
 * The Nights screen while the going switch is off: nothing about going renders, no
 * going RPC runs, and none of the going module is loaded (NightsRoute.tsx). Only the
 * way to find a night (the home link top left, D130).
 */
export const NightsOff = () => (
  <div data-testid="dancer-screen-nights" className="grid gap-[12px]">
    <ScreenTitle>Nights</ScreenTitle>
    <EmptyState
      testId="nights-empty"
      icon={<MoonArt />}
      title={NIGHTS_OFF_LINE}
      body={<span className="block">{FIND_A_NIGHT}</span>}
    />
  </div>
);
