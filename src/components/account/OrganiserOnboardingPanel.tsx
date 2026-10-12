import '@/modules/organiser/theme.css';
import { OnboardingView } from '@/modules/organiser/home/onboarding/OnboardingView';
import { isMailboxProvenToken } from '@/modules/organiser/shared/sessionProof';
import type { MyAccessRequest } from '@/modules/organiser/shared/selfServeApi';

/**
 * The organiser onboarding, unchanged, inside the dancer home's "I organise
 * events" section. Its own lazy chunk (with the organiser theme), loaded on the
 * first open. The theme's tokens are scoped to .org-theme, so it is wrapped here
 * the way OrganiserShell wraps it on /account/o.
 */
export default function OrganiserOnboardingPanel({
  user,
  accessToken,
  requests,
  onChanged,
}: {
  user: { id: string; email: string | null };
  accessToken: string | null | undefined;
  requests: readonly MyAccessRequest[];
  onChanged: (confirmation: string) => void;
}) {
  return (
    <div className="org-theme rounded-[12px] p-[12px]" data-testid="dancer-home-organiser-onboarding">
      <OnboardingView
        user={user}
        mailboxProven={isMailboxProvenToken(accessToken)}
        myOrganiserIds={new Set()}
        requests={requests}
        firstRun
        onChanged={onChanged}
      />
    </div>
  );
}
