import { switcherItems } from '@/lib/accountRouting';
import ProfileSwitcher from '@/components/account/profiles/ProfileSwitcher';
import { useProfileSides } from '@/components/account/profiles/useProfileSides';

const DANCER_SWITCHER = { area: 'dancer' } as const;

/**
 * D129: the Switch-profile button shows ONLY for a person with 2+ profiles (dancer + organiser / teacher / DJ).
 * One profile has nothing to switch to, so nothing renders (account settings and sign out stay in Options).
 * Lazy-loaded by the shell, so the organiser reads stay off its first load.
 */
const SwitcherGate = () => {
  const { state } = useProfileSides();
  if (state.status !== 'ready' || switcherItems(state.sides, DANCER_SWITCHER).length < 2) return null;
  return <ProfileSwitcher where={DANCER_SWITCHER} />;
};

export default SwitcherGate;
