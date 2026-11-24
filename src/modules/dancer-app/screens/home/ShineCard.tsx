import { useState } from 'react';
import { Link } from 'react-router-dom';
import { X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/modules/organiser/ui';
import type { MyDancerEdit } from '../../api/types';
import { LINK_PRIMARY } from '../blocks';

/** Home card (layout C, onboarding v3 slice 3): nudges anyone missing a bio or a link. Same screen as onboarding's last step. */

export const SHINE_ADD_PATH = '/app/welcome?step=bio&returnTo=/app/home';
export const SHINE_DISMISS_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export const shineKey = (userId: string): string => `dancer_app_shine_dismissed:${userId}`;

const filled = (v: string | null | undefined): boolean => (v ?? '').trim() !== '';

/** Bio empty OR no link at all (instagram, facebook, website). */
export const shineMissing = (p: Pick<MyDancerEdit, 'bio' | 'instagram' | 'facebook' | 'website_url'>): boolean =>
  !filled(p.bio) || !(filled(p.instagram) || filled(p.facebook) || filled(p.website_url));

/** Hidden while the stored timestamp is under 30 days old. Blocked storage or a bad value = not dismissed. */
export const shineDismissed = (userId: string, now: number = Date.now()): boolean => {
  try {
    const at = Number(window.localStorage.getItem(shineKey(userId)));
    return Number.isFinite(at) && at > 0 && now - at < SHINE_DISMISS_DAYS * DAY_MS;
  } catch {
    return false;
  }
};

const ShineCard = ({ profile }: { profile: MyDancerEdit | null | undefined }) => {
  const { user } = useAuth();
  const userId = user?.id ?? '';
  const [hidden, setHidden] = useState(false);
  if (!profile || !shineMissing(profile) || hidden || (userId !== '' && shineDismissed(userId))) return null;
  const dismiss = () => {
    setHidden(true);
    try {
      if (userId !== '') window.localStorage.setItem(shineKey(userId), String(Date.now()));
    } catch {
      /* storage blocked: hidden for this visit only */
    }
  };
  return (
    <section aria-label="Make your profile shine" data-testid="home-shine" className="relative">
      <Card variant="padded">
        <p className="m-0 pr-[44px] text-[15px] [overflow-wrap:anywhere]">Add a bio and a link so dancers know you.</p>
        <Link to={SHINE_ADD_PATH} data-testid="home-shine-add" className={`${LINK_PRIMARY} mt-[12px]`}>
          Add
        </Link>
      </Card>
      <button
        type="button"
        aria-label="Dismiss"
        data-testid="home-shine-dismiss"
        onClick={dismiss}
        className="absolute right-0 top-0 inline-flex h-[44px] w-[44px] cursor-pointer items-center justify-center border-0 bg-transparent p-0 text-[var(--mut)]"
      >
        <X size={18} aria-hidden />
      </button>
    </section>
  );
};

export default ShineCard;
