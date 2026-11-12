import ProfileSwitcher from '@/components/account/profiles/ProfileSwitcher';
import { useProfileSides } from '@/components/account/profiles/useProfileSides';

const DANCER_SWITCHER = { area: 'dancer' } as const;

/**
 * D129 + admin 1534: the strip button reads "Switch" for a person with 2+ profiles (dancer + organiser) and
 * "Account" with one or none (no dancer profile yet, e.g. unclaimed: Account stays reachable, as on main). Hidden only until sides load.
 * Lazy-loaded by the shell, so the organiser reads stay off its first load.
 */
const SwitcherGate = () => {
  const { state } = useProfileSides();
  if (state.status !== 'ready') return null;
  return <ProfileSwitcher where={DANCER_SWITCHER} />;
};

export default SwitcherGate;
