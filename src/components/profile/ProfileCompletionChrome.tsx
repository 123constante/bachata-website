import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { UserRound, X } from "lucide-react";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import {
  bannerModel,
  clearPostLoginPrompt,
  finishProfileHref,
  isFinishProfileSkipped,
  isPostLoginPromptArmed,
  postLoginDecision,
  profileGateValue,
} from "@/lib/profileCompletion";
import type { ProfileGateValue } from "@/hooks/useAuth";

const PILL =
  "inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full bg-primary px-4 text-[14px] font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

/**
 * Site-wide, signed-in only (AppChrome lazy-loads it once a user exists):
 *
 * - the reminder banner, on every page while the profile is unfinished. Its
 *   close button hides it for THIS page view (keyed on location.key), so the
 *   next navigation shows it again; it never shows once profile_complete_v1 is
 *   true.
 * - publishing the rating gate up to AppChrome (`onGate`), which provides it to
 *   the party-rating card through ProfileGateContext (hooks/useAuth) -- so the card reads the
 *   same completion as this banner without importing the hook itself.
 * - the one hop to /finish-profile right after a sign-in (the callback arms a
 *   session flag), unless "Skip for now" was pressed this session.
 */
const ProfileCompletionChrome = ({ onGate }: { onGate?: (value: ProfileGateValue) => void }) => {
  const location = useLocation();
  const onAuthPath = location.pathname === "/auth" || location.pathname.startsWith("/auth/");
  const completion = useProfileCompletion({ paused: onAuthPath });
  const missingKey = completion.missing.join(",");

  useEffect(() => {
    onGate?.(profileGateValue(completion));
    // completion is a fresh object each render; status + missing are its content.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onGate, completion.status, missingKey]);
  const navigate = useNavigate();
  const [dismissedKey, setDismissedKey] = useState<string | null>(null);
  const here = `${location.pathname}${location.search}${location.hash}`;

  // Right after sign-in the callback has just filled the stub, so decide on a
  // FRESH answer, never on one cached before (or during) the callback.
  useEffect(() => {
    if (onAuthPath || !isPostLoginPromptArmed()) return;
    let cancelled = false;
    void completion.refetch().then((fresh) => {
      if (cancelled) return;
      const decision = postLoginDecision({
        pending: isPostLoginPromptArmed(),
        skipped: isFinishProfileSkipped(),
        status: fresh.status,
        pathname: location.pathname,
      });
      if (decision === "clear") clearPostLoginPrompt();
      if (decision === "redirect") {
        clearPostLoginPrompt();
        navigate(finishProfileHref(here), { replace: true });
      }
    });
    return () => {
      cancelled = true;
    };
    // completion.refetch is a fresh closure each render; the path is the trigger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onAuthPath, location.pathname, here, navigate]);

  const model = bannerModel(completion, {
    dismissed: dismissedKey === location.key,
    pathname: location.pathname,
    returnTo: here,
  });
  if (!model) return null;

  return (
    <div className="mx-auto w-full max-w-4xl px-3 pt-3">
      <section
        data-testid="profile-completion-banner"
        aria-label={model.title}
        className="rounded-xl border border-border bg-card p-3"
      >
        <div className="flex items-start gap-3">
          <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-[14px] font-semibold text-foreground">{model.title}</p>
            <p className="text-[13px] text-muted-foreground">{model.body}</p>
          </div>
          <button
            type="button"
            aria-label="Hide this reminder on this page"
            onClick={() => setDismissedKey(location.key)}
            className="-mr-2 -mt-2 inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-full text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        <div className="mt-2 pl-8">
          {model.cta.kind === "link" ? (
            <Link to={model.cta.href} className={PILL}>
              {model.cta.label}
            </Link>
          ) : (
            <a href={model.cta.href} target="_blank" rel="noopener noreferrer" className={PILL}>
              {model.cta.label}
            </a>
          )}
        </div>
      </section>
    </div>
  );
};

export default ProfileCompletionChrome;
