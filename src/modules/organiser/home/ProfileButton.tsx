// C15 / D50: Home's ONE "Complete your profile" button, with the ring and the
// level name read from my_profile_progress_v1 (the same numbers the wizard and
// the go-live lock read). It opens the wizard by itself while required answers
// are missing, unless Finish later was tapped in the last 24 h. After the
// required part, "Not now" hides it for 30 days, twice at most. Loading or a
// failed read shows nothing and blocks nothing.
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { PROFILE_WIZARD_PATH, useProfileProgress } from '@/modules/organiser/shared/profileProgress';
import { ProgressRing } from '../wizard/LevelTrack';
import { markNotNow, readNudge } from '../wizard/nudgeStore';
import { canSayNotNow, levelName, levelOf, shouldAutoOpen, showHomeButton } from '../wizard/wizardModel';

export const PROFILE_BUTTON_LABEL = 'Complete your profile';

export function ProfileButton({ organiserId, userId, now = Date.now }: { organiserId: string | null; userId: string; now?: () => number }) {
  const navigate = useNavigate();
  const progress = useProfileProgress(organiserId);
  const [nudge, setNudge] = useState(() => readNudge(userId));
  const opened = useRef(false);
  const p = progress.data;

  useEffect(() => {
    if (!p || opened.current || !shouldAutoOpen(p, readNudge(userId), now())) return;
    opened.current = true;
    navigate(PROFILE_WIZARD_PATH);
  }, [p, userId, navigate, now]);

  if (!p || !showHomeButton(p, nudge, now())) return null;
  const level = levelName(levelOf(p));
  // C14's words while required answers are missing; the level name after.
  const sub = p.requiredLeft > 0 ? `${level}. Finish your profiles, ${p.requiredLeft} left` : level;
  return (
    <div className="space-y-[4px]" data-testid="home-profile">
      <button
        type="button"
        onClick={() => navigate(PROFILE_WIZARD_PATH)}
        data-testid="home-profile-button"
        data-percent={p.percent}
        className="flex min-h-[64px] w-full items-center gap-[12px] rounded-[16px] border border-[var(--gold)] bg-[var(--card)] px-[16px] py-[8px] text-left"
      >
        <ProgressRing percent={p.percent} testId="home-profile-ring" />
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-semibold leading-[20px] text-[var(--fg)]">{PROFILE_BUTTON_LABEL}</span>
          <span className="block text-[13px] text-[var(--mut)]" data-testid="home-profile-level">{sub}</span>
        </span>
        <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
      </button>
      {canSayNotNow(p, nudge) && (
        <button type="button" data-testid="home-profile-not-now" onClick={() => setNudge(markNotNow(userId, now()))} className="h-[44px] w-full text-[14px] font-semibold text-[var(--mut)]">
          Not now
        </button>
      )}
    </div>
  );
}
