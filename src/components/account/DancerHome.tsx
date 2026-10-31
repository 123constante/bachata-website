import { Suspense, useId, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, ChevronDown, Music } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useSignOutToHome } from "@/components/account/profiles/signOutToHome";
import { useCity } from "@/contexts/CityContext";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { useMyDancerSummary } from "@/hooks/useMyDancerSummary";
import { useMyProfileVisibility } from "@/hooks/useMyProfileVisibility";
import { buildCityPath } from "@/lib/cityPath";
import { buildSignInHref } from "@/lib/authRouting";
import { danceRoleLabel } from "@/lib/auth-otp-routing";
import { lazyWithRetry } from "@/lib/lazyWithRetry";
import { optimizedImageUrl, srcWidthFor } from "@/lib/imageCdn";
import {
  ACCOUNT_SETTINGS_LABEL,
  ACCOUNT_SETTINGS_PATH,
  HIDDEN_STATE_LINE,
  MY_ATTENDANCE_PATH,
  SHOW_AGAIN_LABEL,
} from "@/lib/accountRouting";
import { flags } from "@/lib/featureFlags";
import { organiserAreaHome } from "@/lib/organiserAreaHome";

/** F-01: every organiser link here opens the organiser area's Home (P3 while live). */
const ORGANISER_HOME_PATH = organiserAreaHome(flags);
import {
  NO_PROFILE_CONTACT_LABEL,
  NO_PROFILE_CONTACT_URL,
  completenessFact,
  finishProfileHref,
  type ProfileField,
} from "@/lib/profileCompletion";
import { ORGANISER_HOME_KEY, myAccessRequestsQueryKey, type MyAccessRequest } from "@/modules/organiser/shared/selfServeApi";
import { NationalityFlag } from "@/components/people/NationalityFlag";
import { AccountAreasRow } from "@/modules/areas/home/AccountAreasRow";
import { HideSurnameCard } from "./HideSurnameCard";
import { PersonAvatar } from "./profiles/PersonAvatar";

// The organiser onboarding (claim / request access / create) loads only when
// "I organise events" is opened: most dancers never open it.
const OrganiserOnboardingPanel = lazyWithRetry(() => import("./OrganiserOnboardingPanel"));

const PILL =
  "inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-ctl)] bg-[var(--btn)] px-[16px] text-[14px] font-semibold text-[var(--btnfg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)]";
// S3, one filled action: "Finish your profile" is the filled one whenever it shows; the hidden banner's link is
// always outlined, and the organiser link is outlined while Finish shows.
const OUTLINE =
  "inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-ctl)] border border-[var(--line)] px-[16px] text-[14px] font-semibold text-[var(--fg)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--fg)]";
const CARD = "rounded-[var(--r-card)] border border-[var(--line)] bg-[var(--card)] p-[16px]";
const AVATAR_PX = 56;

/** The ONE PersonAvatar (its no-photo disc is the site's muted tone, never the black background). */
function Avatar({ url, name }: { url: string | null; name: string | null }) {
  return (
    <PersonAvatar
      photoUrl={url ? optimizedImageUrl(url, srcWidthFor(AVATAR_PX)) : null}
      name={name}
      size={AVATAR_PX}
      loading="eager"
      alt={name ? `${name}'s photo` : "Your photo"}
      imgTestId="dancer-home-photo"
      placeholderTestId="dancer-home-photo-empty"
    />
  );
}

export function SignOut({ email }: { email: string | null }) {
  // Review #789 B1: the one sign-out path (leave first), or AuthGuard lands the person on "Welcome back".
  const { signOutToHome, busy } = useSignOutToHome();
  const [confirming, setConfirming] = useState(false);
  const [failed, setFailed] = useState(false);

  const go = async () => {
    setFailed(false);
    if ((await signOutToHome()) === "failed") setFailed(true);
  };

  return (
    <div className="space-y-[8px] text-[13px] text-[var(--mut)]" data-testid="dancer-home-signout">
      <p className="break-all">{email ? <>Signed in as {email}.</> : <>Signed in.</>}</p>
      {confirming ? (
        <div className="flex flex-wrap gap-[8px]">
          <button type="button" className={PILL} onClick={() => void go()} disabled={busy} data-testid="dancer-home-signout-yes">
            {busy ? <>Signing out&hellip;</> : "Yes, sign out"}
          </button>
          <button
            type="button"
            className="inline-flex min-h-[44px] items-center px-[12px] text-[14px] font-semibold text-[var(--fg)]"
            onClick={() => setConfirming(false)}
            disabled={busy}
          >
            Stay signed in
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--gold-fg)] underline underline-offset-2"
          onClick={() => setConfirming(true)}
          data-testid="dancer-home-signout-start"
        >
          Sign out
        </button>
      )}
      {failed && (
        <p role="alert" className="text-[var(--danger)]">
          Sign-out did not complete. Check your connection and try again.
        </p>
      )}
    </div>
  );
}

export type DancerHomeProps = {
  /**
   * The bottom section. `onboarding`: the collapsed "I organise events" (claim /
   * request / create) for someone with no organiser. `link`: an organiser who
   * opened their dancer profile from the account menu -- a link back instead.
   * `hidden`: not known yet.
   */
  organiserSection: "onboarding" | "link" | "hidden";
  /** An organiser read failed: the person MAY be an organiser, so the organiser area is offered by name. */
  organiserCheckFailed: boolean;
  /** A claim, create or request made HERE just made the person an organiser (or a requester): its confirmation. */
  nowOrganiser?: string | null;
  /** Called with the onboarding's confirmation when the person claims, creates or requests from it. */
  onOrganiserAction?: (confirmation: string) => void;
  /** Their own access requests (declined ones show inside the onboarding). */
  requests: readonly MyAccessRequest[];
};

/**
 * /account for a signed-in person with no organiser and no open access request,
 * and /account/dancer for anyone (lib/accountRouting). The launch bar for the
 * first dancers: finish the profile, and get to the nights they can rate. The
 * organiser onboarding is one collapsed section below, unchanged.
 */
export function DancerHome({ organiserSection, organiserCheckFailed, nowOrganiser = null, onOrganiserAction, requests }: DancerHomeProps) {
  const { user, session } = useAuth();
  const { pathname } = useLocation();
  const { citySlug } = useCity();
  const queryClient = useQueryClient();
  const completion = useProfileCompletion();
  const summary = useMyDancerSummary();
  const visibility = useMyProfileVisibility();
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
  const partiesPath = buildCityPath(citySlug, "parties");

  const onOrganiserChanged = (confirmation: string) => {
    onOrganiserAction?.(confirmation);
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
    <div className="space-y-[12px]" data-testid="dancer-home">
      {visibility.status === "hidden" && (
        <div className={`${CARD} space-y-[8px] border-[var(--gold)]`} role="status" data-testid="dancer-home-hidden-banner">
          <p className="text-[14px] font-semibold text-[var(--fg)]">{HIDDEN_STATE_LINE}</p>
          <p className="text-[13px] text-[var(--mut)]">You can show it again in {ACCOUNT_SETTINGS_LABEL}.</p>
          <Link to={ACCOUNT_SETTINGS_PATH} className={OUTLINE} data-testid="dancer-home-hidden-settings">
            {SHOW_AGAIN_LABEL}
          </Link>
        </div>
      )}

      <section className={CARD} aria-labelledby="dancer-home-profile" data-testid="dancer-home-profile">
        <h2 id="dancer-home-profile" className="sr-only">Your profile</h2>
        {loading ? (
          <div className="flex items-center gap-[12px]" aria-busy="true" data-testid="dancer-home-loading">
            <Skeleton className="h-[56px] w-[56px] rounded-full" />
            <div className="flex-1 space-y-[8px]">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-48" />
            </div>
          </div>
        ) : completion.status === "signed_out" ? (
          <div className="space-y-[8px]" data-testid="dancer-home-signed-out">
            <p className="text-[14px] text-[var(--fg)]">Sign in with your email to see and finish your profile.</p>
            <Link to={buildSignInHref(pathname)} className={PILL}>
              Sign in
            </Link>
          </div>
        ) : fact.kind === "no_profile" ? (
          <div className="space-y-[8px]" data-testid="dancer-home-no-profile">
            <p className="text-[14px] text-[var(--fg)]">{fact.text}</p>
            <p className="text-[13px] text-[var(--mut)]">Browsing parties works without it.</p>
            <a href={NO_PROFILE_CONTACT_URL} target="_blank" rel="noopener noreferrer" className={PILL}>
              {NO_PROFILE_CONTACT_LABEL}
            </a>
          </div>
        ) : (
          <div className="space-y-[12px]">
            {detailsFailed ? (
              <div className="flex flex-wrap items-center gap-[8px]" data-testid="dancer-home-details-failed">
                <p className="text-[13px] text-[var(--mut)]">We couldn&rsquo;t load your name, city and photo just now.</p>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--gold-fg)] underline underline-offset-2"
                  // Both reads: when the summary found no row but the completeness answer
                  // did, one of the two cached answers is stale; re-asking only one could not fix it.
                  onClick={() => {
                    void summary.refetch();
                    void completion.refetch();
                  }}
                >
                  Try again
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-[12px]">
                {/* mr-2: room for the nationality sticker, which stands out past the photo's right. */}
                <span className="relative mr-2 shrink-0">
                  <Avatar url={photo} name={name} />
                  <NationalityFlag code={s?.nationalityCode} size={AVATAR_PX} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] font-semibold text-[var(--fg)]" data-testid="dancer-home-name">
                    {name ?? <span className="text-[var(--mut)]">Name not set</span>}
                  </p>
                  <p className="truncate text-[13px] text-[var(--mut)]" data-testid="dancer-home-details">
                    {city ?? "City not set"} &middot; {role ?? "Dance role not set"}
                  </p>
                </div>
              </div>
            )}
            {fact.kind === "incomplete" && (
              <div className="space-y-[8px]" data-testid="dancer-home-incomplete">
                <p className="text-[14px] text-[var(--fg)]" data-testid="dancer-home-completeness">
                  {fact.text}
                </p>
                <Link to={finishProfileHref(pathname)} className={`${PILL} w-full`} data-testid="dancer-home-finish">
                  Finish your profile
                </Link>
              </div>
            )}
            {fact.kind === "complete" && (
              <p className="text-[14px] text-[var(--fg)]" data-testid="dancer-home-completeness">
                {fact.text}
              </p>
            )}
            {fact.kind === "unknown" && completion.status === "error" && (
              <div className="flex flex-wrap items-center gap-[8px]" data-testid="dancer-home-check-failed">
                <p className="text-[13px] text-[var(--mut)]">We couldn&rsquo;t check your profile just now.</p>
                <button
                  type="button"
                  className="inline-flex min-h-[44px] items-center text-[14px] font-semibold text-[var(--gold-fg)] underline underline-offset-2"
                  onClick={() => void completion.refetch()}
                >
                  Try again
                </button>
              </div>
            )}
          </div>
        )}
      </section>

      <nav aria-label="Your nights" className="grid grid-cols-2 gap-[12px]">
        <Link to={MY_ATTENDANCE_PATH} className={`${CARD} flex min-h-[44px] flex-col gap-[4px] hover:border-[var(--gold)]`} data-testid="dancer-home-attendance">
          <CalendarDays className="h-[20px] w-[20px] text-[var(--gold)]" aria-hidden="true" />
          <span className="text-[15px] font-semibold text-[var(--fg)]">My attendance</span>
          <span className="text-[13px] text-[var(--mut)]">Nights you&rsquo;re going to, and rating the ones you went to</span>
        </Link>
        <Link to={partiesPath} className={`${CARD} flex min-h-[44px] flex-col gap-[4px] hover:border-[var(--gold)]`} data-testid="dancer-home-parties">
          <Music className="h-[20px] w-[20px] text-[var(--gold)]" aria-hidden="true" />
          <span className="text-[15px] font-semibold text-[var(--fg)]">Browse parties</span>
          <span className="text-[13px] text-[var(--mut)]">Find your next night out</span>
        </Link>
      </nav>

      {!loading && completion.status !== "signed_out" && fact.kind !== "no_profile" && <AccountAreasRow />}

      {organiserCheckFailed && (
        <p className="text-[13px] text-[var(--mut)]" data-testid="dancer-home-organiser-check-failed">
          We couldn&rsquo;t check whether you run an organiser just now.{" "}
          <Link to={ORGANISER_HOME_PATH} className="font-semibold text-[var(--gold-fg)] underline underline-offset-2">
            Open the organiser area
          </Link>
        </p>
      )}

      {nowOrganiser && (
        <div className={`${CARD} space-y-[8px]`} data-testid="dancer-home-now-organiser">
          {/* The onboarding that said this is replaced by this card, so the card announces it. */}
          <p role="status" className="text-[14px] text-[var(--fg)]">
            {nowOrganiser} Your organiser area has the details.
          </p>
          <Link to={ORGANISER_HOME_PATH} className={`${fact.kind === "incomplete" ? OUTLINE : PILL} w-full`} data-testid="dancer-home-open-organiser">
            Open the organiser area
          </Link>
        </div>
      )}

      {!loading && completion.status !== "signed_out" && fact.kind !== "no_profile" && <HideSurnameCard />}

      {organiserSection === "link" && (
        <Link
          to={ORGANISER_HOME_PATH}
          className="flex min-h-[44px] items-center justify-center text-[14px] font-semibold text-[var(--gold-fg)] underline underline-offset-2"
          data-testid="dancer-home-organiser-link"
        >
          Back to your organiser home
        </Link>
      )}

      {organiserSection === "onboarding" && (
      <section className={CARD} data-testid="dancer-home-organise">
        <button
          type="button"
          aria-expanded={organising}
          aria-controls={panelId}
          onClick={() => setOrganising((v) => !v)}
          className="flex min-h-[44px] w-full items-center justify-between gap-[8px] text-left"
          data-testid="dancer-home-organise-toggle"
        >
          <span>
            <span className="block text-[15px] font-semibold text-[var(--fg)]">I organise events</span>
            <span className="block text-[13px] text-[var(--mut)]">Claim your organiser, ask to join one, or create one</span>
          </span>
          <ChevronDown className={`h-[20px] w-[20px] shrink-0 text-[var(--mut)] transition-transform ${organising ? "rotate-180" : ""}`} aria-hidden="true" />
        </button>
        <div id={panelId} hidden={!organising} className="mt-[12px]">
          {organising && user && (
            <Suspense fallback={<Skeleton className="h-28 w-full rounded-[var(--r-card)]" />}>
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
      )}

      <Link
        to={ACCOUNT_SETTINGS_PATH}
        className="flex min-h-[44px] items-center justify-center text-[14px] font-semibold text-[var(--gold-fg)] underline underline-offset-2"
        data-testid="dancer-home-settings"
      >
        {ACCOUNT_SETTINGS_LABEL}: email, your data, hide or delete account
      </Link>

      {/* The open onboarding has its own "Signed in as ... Sign out" line: one per screen. */}
      {!(organising && organiserSection === "onboarding") && <SignOut email={user?.email ?? null} />}
    </div>
  );
}
