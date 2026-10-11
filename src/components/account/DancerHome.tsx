import { Suspense, useId, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Music, UserRound } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useCity } from "@/contexts/CityContext";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { useMyDancerSummary } from "@/hooks/useMyDancerSummary";
import { buildCityPath } from "@/lib/cityPath";
import { buildSignInHref } from "@/lib/authRouting";
import { danceRoleLabel } from "@/lib/auth-otp-routing";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { optimizedImageUrl, srcWidthFor } from "@/lib/imageCdn";
import { MY_ATTENDANCE_PATH, ACCOUNT_HOME_PATH, ORGANISER_HOME_PATH } from "@/lib/accountRouting";
import {
  NO_PROFILE_CONTACT_LABEL,
  NO_PROFILE_CONTACT_URL,
  PROFILE_FIELD_LABEL,
  completenessFact,
  finishProfileHref,
  type ProfileField,
} from "@/lib/profileCompletion";
import { ORGANISER_HOME_KEY, myAccessRequestsQueryKey, type MyAccessRequest } from "@/modules/organiser/shared/selfServeApi";

// The organiser onboarding (claim / request access / create) loads only when
// "I organise events" is opened: most dancers never open it.
const OrganiserOnboardingPanel = lazyWithRetry(() => import("./OrganiserOnboardingPanel"));

const PILL =
  "inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-[16px] text-[14px] font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";
const CARD = "rounded-xl border border-border bg-card p-3";
const AVATAR_PX = 56;

function Avatar({ url, name }: { url: string | null; name: string | null }) {
  if (url) {
    return (
      <img
        src={optimizedImageUrl(url, srcWidthFor(AVATAR_PX))}
        alt={name ? `${name}'s photo` : "Your photo"}
        width={AVATAR_PX}
        height={AVATAR_PX}
        loading="lazy"
        className="h-[56px] w-[56px] shrink-0 rounded-full object-cover"
        data-testid="dancer-home-photo"
      />
    );
  }
  const initial = name?.[0]?.toUpperCase();
  return (
    <span
      aria-hidden="true"
      className="flex h-[56px] w-[56px] shrink-0 items-center justify-center rounded-full border border-border bg-background text-[20px] font-bold text-muted-foreground"
      data-testid="dancer-home-photo-empty"
    >
      {initial ?? <UserRound className="h-5 w-5" />}
    </span>
  );
}

function SignOut({ email }: { email: string | null }) {
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const go = async () => {
    setBusy(true);
    setFailed(false);
    const outcome = await signOut();
    setBusy(false);
    if (outcome === "failed") {
      setFailed(true);
      return;
    }
    navigate("/", { replace: true });
  };

  return (
    <div className="space-y-2 text-[13px] text-muted-foreground" data-testid="dancer-home-signout">
      <p className="break-all">{email ? <>Signed in as {email}.</> : <>Signed in.</>}</p>
      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <button type="button" className={PILL} onClick={() => void go()} disabled={busy} data-testid="dancer-home-signout-yes">
            {busy ? <>Signing out&hellip;</> : "Yes, sign out"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center px-[12px] text-[14px] font-semibold text-foreground"
            onClick={() => setConfirming(false)}
            disabled={busy}
          >
            Stay signed in
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-primary underline underline-offset-2"
          onClick={() => setConfirming(true)}
          data-testid="dancer-home-signout-start"
        >
          Sign out
        </button>
      )}
      {failed && (
        <p role="alert" className="text-destructive">
          Sign-out did not complete. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

export type DancerHomeProps = {
  /** An organiser read failed: the person MAY be an organiser, so the organiser area is offered by name. */
  organiserCheckFailed: boolean;
  /** A claim, create or request made HERE just made the person an organiser (or a requester). */
  nowOrganiser?: boolean;
  /** Called when the person claims, creates or requests from the onboarding section. */
  onOrganiserAction?: () => void;
  /** Their own access requests (declined ones show inside the onboarding). */
  requests: readonly MyAccessRequest[];
};

/**
 * /account for a signed-in person with no organiser and no open access request
 * (lib/accountRouting). The launch bar for the first dancers: finish the
 * profile, and get to the nights they can rate. The organiser onboarding is one
 * collapsed section below, unchanged.
 */
export function DancerHome({ organiserCheckFailed, nowOrganiser = false, onOrganiserAction, requests }: DancerHomeProps) {
  const { user, session } = useAuth();
  const { citySlug } = useCity();
  const queryClient = useQueryClient();
  const completion = useProfileCompletion();
  const summary = useMyDancerSummary();
  const fact = completenessFact(completion);
  const [organising, setOrganising] = useState(false);
  const panelId = useId();

  const s = summary.data ?? null;
  const missing = new Set(fact.missing);
  // A value the completeness fact calls missing reads "not set" here too, whatever a
  // slower or faster read says, so the card and the line under it never disagree.
  const shown = (field: ProfileField, value: string | null) => (missing.has(field) ? null : value);
  const name = shown("first_name", s?.firstName ?? null);
  const city = shown("based_city_id", s?.cityName ?? null);
  // The Finish screen's label for the stored value ("Both" for "Lead and Follow").
  const role = shown("dance_role", s?.danceRole ? danceRoleLabel(s.danceRole) : null);
  const photo = shown("avatar_url", s?.avatarUrl ?? null);
  const partiesPath = citySlug ? buildCityPath(citySlug, "parties") : "/parties";

  const onOrganiserChanged = () => {
    onOrganiserAction?.();
    // A claim, create or request makes this person an organiser (or a requester):
    // /account re-asks and moves them to the organiser home.
    void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
    void queryClient.invalidateQueries({ queryKey: myAccessRequestsQueryKey(user?.id) });
  };

  // isLoading, not isPending: a query that cannot run (an anonymous session) is pending forever.
  const loading = completion.status === "loading" || (summary.isLoading && fact.kind !== "no_profile");
  // The completeness answer arrived but the name / city / photo read did not: say so, never
  // "not set" for values that may well be there.
  // Paused offline with nothing cached counts as failed (as Account's settled() does).
  const detailsFailed =
    !loading && fact.kind !== "no_profile" && (summary.isError || (summary.isPending && summary.isPaused) || (summary.isSuccess && !s));

  return (
    <div className="space-y-3" data-testid="dancer-home">
      <section className={CARD} aria-labelledby="dancer-home-profile" data-testid="dancer-home-profile">
        <h2 id="dancer-home-profile" className="sr-only">Your profile</h2>
        {loading ? (
          <div className="flex items-center gap-3" aria-busy="true" data-testid="dancer-home-loading">
            <Skeleton className="h-[56px] w-[56px] rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ) : completion.status === "signed_out" ? (
          <div className="space-y-2" data-testid="dancer-home-signed-out">
            <p className="text-[14px] text-foreground">Sign in with your email to see and finish your profile.</p>
            <Link to={buildSignInHref(ACCOUNT_HOME_PATH)} className={PILL}>
              Sign in
            </Link>
          </div>
        ) : fact.kind === "no_profile" ? (
          <div className="space-y-2" data-testid="dancer-home-no-profile">
            <p className="text-[14px] text-foreground">{fact.text}</p>
            <p className="text-[13px] text-muted-foreground">Browsing parties works without it.</p>
            <a href={NO_PROFILE_CONTACT_URL} target="_blank" rel="noopener noreferrer" className={PILL}>
              {NO_PROFILE_CONTACT_LABEL}
            </a>
          </div>
        ) : (
          <div className="space-y-3">
            {detailsFailed ? (
              <div className="flex flex-wrap items-center gap-2" data-testid="dancer-home-details-failed">
                <p className="text-[13px] text-muted-foreground">We couldn&rsquo;t load your name, city and photo just now.</p>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-primary underline underline-offset-2"
                  onClick={() => void summary.refetch()}
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <Avatar url={photo} name={name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold text-foreground" data-testid="dancer-home-name">
                    {name ?? <span className="text-muted-foreground">Name not set</span>}
                  </p>
                  <p className="truncate text-[13px] text-muted-foreground" data-testid="dancer-home-details">
                    {city ?? "City not set"} &middot; {role ?? "Dance role not set"}
                  </p>
                </div>
              </div>
            )}
            {s?.archived && (
              <p className="text-[13px] text-muted-foreground" data-testid="dancer-home-archived">
                Your profile is hidden from the public dancer pages.{" "}
                <a href={NO_PROFILE_CONTACT_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-primary underline underline-offset-2">
                  Message us to show it again
                </a>
              </p>
            )}
            {fact.kind === "incomplete" && (
              <div className="space-y-2" data-testid="dancer-home-incomplete">
                <p className="text-[14px] text-foreground" data-testid="dancer-home-completeness">
                  {fact.text}
                </p>
                <ul className="sr-only">
                  {fact.missing.map((f) => (
                    <li key={f}>Missing: {PROFILE_FIELD_LABEL[f]}</li>
                  ))}
                </ul>
                <Link to={finishProfileHref(ACCOUNT_HOME_PATH)} className={`${PILL} w-full`} data-testid="dancer-home-finish">
                  Finish your profile
                </Link>
              </div>
            )}
            {fact.kind === "complete" && (
              <p className="text-[14px] text-foreground" data-testid="dancer-home-completeness">
                {fact.text}
              </p>
            )}
            {fact.kind === "unknown" && completion.status === "error" && (
              <div className="flex flex-wrap items-center gap-2" data-testid="dancer-home-check-failed">
                <p className="text-[13px] text-muted-foreground">We couldn&rsquo;t check your profile just now.</p>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-primary underline underline-offset-2"
                  onClick={() => void completion.refetch()}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <nav aria-label="Your nights" className="grid grid-cols-2 gap-3">
        <Link to={MY_ATTENDANCE_PATH} className={`${CARD} flex min-h-[44px] flex-col gap-1 hover:border-primary/50`} data-testid="dancer-home-attendance">
          <CalendarDays className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-[15px] font-semibold text-foreground">My attendance</span>
          <span className="text-[13px] text-muted-foreground">Nights you&rsquo;re going to, and rating the ones you went to</span>
        </Link>
        <Link to={partiesPath} className={`${CARD} flex min-h-[44px] flex-col gap-1 hover:border-primary/50`} data-testid="dancer-home-parties">
          <Music className="h-5 w-5 text-primary" aria-hidden="true" />
          <span className="text-[15px] font-semibold text-foreground">Browse parties</span>
          <span className="text-[13px] text-muted-foreground">Find your next night out</span>
        </Link>
      </nav>

      {organiserCheckFailed && (
        <p className="text-[13px] text-muted-foreground" data-testid="dancer-home-organiser-check-failed">
          We couldn&rsquo;t check whether you run an organiser just now.{" "}
          <Link to={ORGANISER_HOME_PATH} className="font-semibold text-primary underline underline-offset-2">
            Open the organiser area
          </Link>
        </p>
      )}

      {nowOrganiser && (
        <div className={`${CARD} space-y-2`} data-testid="dancer-home-now-organiser">
          {/* Not a status region: the open onboarding already announces its own confirmation. */}
          <p className="text-[14px] text-foreground">
            Done &mdash; your organiser area has the details.
          </p>
          <Link to={ORGANISER_HOME_PATH} className={`${PILL} w-full`}>
            Open the organiser area
          </Link>
        </div>
      )}

      <section className={CARD} data-testid="dancer-home-organise">
        <button
          type="button"
          aria-expanded={organising}
          aria-controls={panelId}
          onClick={() => setOrganising((v) => !v)}
          className="flex min-h-[44px] w-full items-center justify-between gap-2 text-left"
          data-testid="dancer-home-organise-toggle"
        >
          <span>
            <span className="block text-[15px] font-semibold text-foreground">I organise events</span>
            <span className="block text-[13px] text-muted-foreground">Claim your organiser, ask to join one, or create one</span>
          </span>
          <ChevronDown className={`h-5 w-5 shrink-0 text-muted-foreground transition-transform ${organising ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <div id={panelId} hidden={!organising} className="mt-3">
          {organising && user && (
            <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
              <OrganiserOnboardingPanel
                user={{ id: user.id, email: user.email ?? null }}
                accessToken={session?.access_token}
                requests={requests}
                onChanged={onOrganiserChanged}
              />
            </Suspense>
          )}
        </div>
      </section>

      {/* The open onboarding has its own "Signed in as ... Sign out" line: one per screen. */}
      {!organising && <SignOut email={user?.email ?? null} />}
    </div>
  );
}
