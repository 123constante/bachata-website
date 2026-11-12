import { switcherItems } from '@/lib/accountRouting';
import ProfileSwitcher from '@/components/account/profiles/ProfileSwitcher';
import { useProfileSides } from '@/components/account/profiles/useProfileSides';

const DANCER_SWITCHER = { area: 'dancer' } as const;

/**
 * D129 + admin 1534: the strip button reads "Switch" for a person with 2+ profiles (dancer + organiser) and
 * "Account" with one (nothing to switch to; it opens the Account sheet, no Switch word). Hidden only until a side is known.
 * Lazy-loaded by the shell, so the organiser reads stay off its first load.
 */
const SwitcherGate = () => {
  const { state } = useProfileSides();
  if (state.status !== 'ready' || switcherItems(state.sides, DANCER_SWITCHER).length < 1) return null;
  return <ProfileSwitcher where={DANCER_SWITCHER} />;
};

export default SwitcherGate;
