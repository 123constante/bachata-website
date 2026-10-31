import { useQuery } from '@tanstack/react-query';
import { Card } from '@/modules/organiser/ui';
import { LinkRow } from '../blocks';
import { useAuth } from '@/hooks/useAuth';
import { APP_ACCOUNT_SETTINGS_PATH, ACCOUNT_SETTINGS_LABEL } from '@/lib/accountRouting';
import { flags } from '@/lib/featureFlags';
import { organiserAreaHome } from '@/lib/organiserAreaHome';
import SignOutControl from './SignOutControl';

export const ORGANISER_AREA_LABEL = 'Go to my organiser area';

/**
 * selfServeApi's organiserHomeQueryKey, spelled here so the organiser API is not a static import of the
 * dancer-app chunk (pinned equal by journeyConsistency.test). The read itself loads on demand.
 */
export const organiserHomeKey = (userId: string | undefined) => ['organiser-home', userId] as const;
const fetchOrganiserHome = async () => (await import('@/modules/organiser/shared/selfServeApi')).fetchOrganiserHome();

/**
 * Walk bug 1 (PR #789): a signed-in person with no dancer profile (an organiser with no
 * dancer side included) saw only "message us" on Options and Home, with no way out.
 * Under that text both screens show this: Account settings, the one Sign out control,
 * and, only for an organiser, the way to their organiser area. Shared by both
 * screens; the organiser read's code loads only when this shows.
 */
const NoProfileWayOut = () => {
  const { user } = useAuth();
  // The same read (and cache key) the gate's organiser half uses. Loading or failed: no link.
  const home = useQuery({ queryKey: organiserHomeKey(user?.id), queryFn: fetchOrganiserHome, enabled: Boolean(user?.id) });
  const isOrganiser = (home.data?.organisers.length ?? 0) > 0;
  return (
    <Card className="mt-[8px]" testId="no-profile-way-out">
      {isOrganiser && <LinkRow to={organiserAreaHome(flags)} label={ORGANISER_AREA_LABEL} testId="no-profile-organiser" />}
      <LinkRow to={APP_ACCOUNT_SETTINGS_PATH} label={ACCOUNT_SETTINGS_LABEL} testId="no-profile-settings" />
      <SignOutControl />
    </Card>
  );
};

export default NoProfileWayOut;
