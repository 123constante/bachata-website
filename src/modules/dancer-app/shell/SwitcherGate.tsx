import { Link } from 'react-router-dom';
import { APP_ACCOUNT_SETTINGS_PATH, switcherItems } from '@/lib/accountRouting';
import ProfileSwitcher from '@/components/account/profiles/ProfileSwitcher';
import { useProfileSides } from '@/components/account/profiles/useProfileSides';

const DANCER_SWITCHER = { area: 'dancer' } as const;

/**
 * D129 + admin #1534 (fix 7): the Switch-profile button shows ONLY for a person with 2+ profiles (dancer + organiser /
 * teacher / DJ). A one-profile account has nothing to switch to, so the same spot reads "Account" and opens account settings.
 * Lazy-loaded by the shell, so the organiser reads stay off its first load.
 */
const SwitcherGate = () => {
  const { state } = useProfileSides();
  if (state.status !== 'ready') return null;
  if (switcherItems(state.sides, DANCER_SWITCHER).length < 2) {
    return (
      <Link to={APP_ACCOUNT_SETTINGS_PATH} data-testid="header-account" className="flex h-[44px] shrink-0 items-center rounded-full px-[12px] text-[14px] font-bold" style={{ color: 'var(--da-text)' }}>
        Account
      </Link>
    );
  }
  return <ProfileSwitcher where={DANCER_SWITCHER} />;
};

export default SwitcherGate;
