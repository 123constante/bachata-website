import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { APP_ACCOUNT_SETTINGS_PATH, ACCOUNT_SETTINGS_LABEL, ORGANISER_HOME_PATH } from '@/lib/accountRouting';
import { ROW } from './optionsUi';
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
    <div style={{ display: 'grid', gap: 8, marginTop: 8 }} data-testid="no-profile-way-out">
      {isOrganiser && (
        <Link to={ORGANISER_HOME_PATH} style={ROW} data-testid="no-profile-organiser">{ORGANISER_AREA_LABEL}</Link>
      )}
      <Link to={APP_ACCOUNT_SETTINGS_PATH} style={ROW} data-testid="no-profile-settings">{ACCOUNT_SETTINGS_LABEL}</Link>
      <SignOutControl />
    </div>
  );
};

export default NoProfileWayOut;
