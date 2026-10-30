import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rpcLoose } from "@/integrations/supabase/rpcLoose";
import { fetchMyPersonaId } from "@/lib/myPersona";
import { claimOrganisersAtSignIn, type ClaimedOrganiser } from "@/lib/claimMyOrganisers";
import { claimLandingPath, claimToastProps, shouldToastClaim } from "@/lib/claimSignInLanding";
import { toast } from "@/hooks/use-toast";
import { ORG_PATHS } from "@/modules/organiser/shell/paths";
import { claimAtSignIn, shouldArmFinishHop } from "@/lib/claimMyDancerProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { saveMyDancerProfile } from "@/lib/saveMyDancerProfile";
import { resolveCanonicalCity } from "@/lib/city-canonical";
import { AUTH_PENDING_RETURN_TO_KEY, sanitizeReturnTo } from "@/lib/authRouting";
import { signInDeletionTarget } from "@/lib/accountDeletion";
import { hasDancerProfileBasics, inferOnboardingStatusFromDancer } from "@/lib/onboardingStatus";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { flags } from "@/lib/featureFlags";
import { trackAuthStep, type AuthFunnelOutcome } from "@/lib/trackAuthStep";
import { acceptTerms } from "@/lib/termsConsent";
import {
  ALREADY_LISTED_BODY,
  ALREADY_LISTED_LINK_LABEL,
  ALREADY_LISTED_TITLE,
  ALREADY_LISTED_URL,
  PENDING_ROLE_INTENT_KEY,
  ROLE_INTENT_META_KEY,
  SET_MY_ROLE_INTENT_RPC,
  armPostLoginPrompt,
  choseTeacherOrDj,
  holdsSeatFromOrganiserHome,
  isDanceRoleValue,
  isFirstSignIn,
  landingPathAfterAuth,
  normalizeLandingRole,
  parseRoleIntentResult,
  readSignupRoles,
  shouldHonorReturnTo,
  isTaskReturnTo,
  showsAlreadyListedStep,
  signupIntentLanding,
  type SignupRole,
} from "@/lib/auth-otp-routing";

const VALID_ROLES: Record<string, string> = {
  organiser: "/",
  videographer: "/",
};

/** Neither sign-up read below holds a sign-in longer than this. */
const SIGNUP_READ_TIMEOUT_MS = 4000;

const withTimeout = async <T,>(work: PromiseLike<T>): Promise<T | "timeout"> => {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      work,
      new Promise<"timeout">((resolve) => {
        timer = setTimeout(() => resolve("timeout"), SIGNUP_READ_TIMEOUT_MS);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
};

// The sign-up's "What do you do?" answer, recorded ONCE. Never throws and never holds the
// sign-up: while set_my_role_intent_v1 is not on the database (or on any failure) the
// account still lands. Logs no roles and no account detail.
const recordRoleIntent = async (roles: SignupRole[]) => {
  try {
    const result = await withTimeout(rpcLoose(SET_MY_ROLE_INTENT_RPC, { p_roles: roles }));
    if (result === "timeout" || result.error || !parseRoleIntentResult(result.data)) {
      console.debug("[set_my_role_intent] not recorded");
    }
  } catch {
    console.debug("[set_my_role_intent] not recorded");
  }
};

// Does this account hold an owner/manager seat (C12)? null when it cannot be told.
const readHoldsOrganiserSeat = async (): Promise<boolean | null> => {
  try {
    const result = await withTimeout(supabase.rpc("organiser_home_v1"));
    if (result === "timeout" || result.error) return null;
    return holdsSeatFromOrganiserHome(result.data);
  } catch {
    return null;
  }
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [error] = useState<string | null>(null);
  const resolved = useRef(false);
  // Funnel counter: callback and landing each record at most once per page load (a ref survives the
  // StrictMode double effect). Fire-and-forget; carries no e-mail or id.
  const funnelDone = useRef<{ callback: boolean; landing: boolean }>({ callback: false, landing: false });
  const recordCallback = (outcome: AuthFunnelOutcome) => {
    if (funnelDone.current.callback) return;
    funnelDone.current.callback = true;
    trackAuthStep({ step: "callback", outcome });
  };
  const recordLanding = () => {
    if (funnelDone.current.landing) return;
    funnelDone.current.landing = true;
    trackAuthStep({ step: "landing", outcome: "ok" });
  };

  const safeReturnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const callbackMode = searchParams.get("mode");

  // Signed in, but the profile could not be filled in. This used to go to
  // /onboarding?authFallback=<reason>, and /onboarding was retired on
  // 2026-09-12 -- so a successful sign-in ended on "Page not found". The reason
  // was only ever read by that page. Carry on to where they were heading
  // (returnTo, then a stashed one), else home.
  const claimedRef = useRef<ClaimedOrganiser[]>([]);
  const claimNoticeShown = useRef(false);
  // C13: armed by a Teacher/DJ sign-up the dancer claim found no person for. The first landing
  // then shows "Already listed?" instead, and its Continue lands where that landing was going.
  const alreadyListedPending = useRef(false);
  const [alreadyListedTo, setAlreadyListedTo] = useState<string | null>(null);

  // Pages claimed at this sign-in: kept for organiser Home, which draws the notice in its own
  // flow with a 44 px Close until it is closed ("Tell us" is the only way to undo a claim that
  // skipped the confirm screen). Returns where to land when there is no return path: /account/o
  // after a claim, else null.
  const claimLanding = (): string | null => claimLandingPath(claimedRef.current, claimNoticeShown.current);

  // Every signed-in landing goes through here. On Home the notice is Home's own line, so no toast
  // covers its rows (review finding 7). Anywhere else (a return path wins, D37) a SHORT toast says
  // it on that page too; never Infinity, because the shared toast sits mid-screen.
  const land = (path: string) => {
    if (alreadyListedPending.current) {
      alreadyListedPending.current = false;
      setAlreadyListedTo(path);
      return;
    }
    const claimed = claimedRef.current;
    if (shouldToastClaim(claimed, claimNoticeShown.current, path)) toast(claimToastProps(claimed));
    if (claimed.length > 0) claimNoticeShown.current = true;
    recordLanding();
    navigate(path, { replace: true });
  };

  const navigateToSignedInFallback = () => {
    const claimPath = claimLanding();
    const pendingReturnTo = sanitizeReturnTo(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY));
    localStorage.removeItem(AUTH_PENDING_RETURN_TO_KEY);
    land(safeReturnTo ?? pendingReturnTo ?? claimPath ?? "/");
  };

  const navigateToSignInFallback = (reason: "expired" | "invalid" | "manual" | "timeout") => {
    recordCallback(reason === "timeout" ? "timeout" : "error");
    const returnToParam = safeReturnTo ? `&returnTo=${encodeURIComponent(safeReturnTo)}` : "";
    navigate(`/auth?mode=signin&callbackError=${reason}${returnToParam}`, { replace: true });
  };

  const resolveRolePreference = (pendingRole: string | null, metaRoleRaw: unknown) => {
    const normalizedMetaRole = typeof metaRoleRaw === "string" ? metaRoleRaw.trim().toLowerCase() : "";
    const metaRole = normalizedMetaRole === "dancer" || VALID_ROLES[normalizedMetaRole] ? normalizedMetaRole : null;
    const preferredRole = pendingRole || metaRole;

    if (!pendingRole && preferredRole) {
      localStorage.setItem("pending_profile_role", preferredRole);
    }

    return preferredRole;
  };

  useEffect(() => {
    if (resolved.current) return;

    const timeout = setTimeout(() => {
      if (!resolved.current) {
        resolved.current = true;
        navigateToSignInFallback("timeout");
      }
    }, 15000);

    const resolveSession = async (session: any) => {
      if (resolved.current) return;
      if (!session?.user) return;

      resolved.current = true;
      clearTimeout(timeout);
      recordCallback("ok");

      const user = session.user;
      // Self-claim FIRST (every sign-in; never throws, never holds the sign-in
      // past its timeout), so the persona read below is the linked profile.
      const claim = await claimAtSignIn(queryClient);
      // The account's FIRST sign-in only: wherever this lands, ProfileCompletionChrome
      // then hops once to /finish-profile if profile_complete_v1 is false (and Skip
      // was not pressed). Every later sign-in gets the banner alone. Not on the
      // sign-in that just linked an admin-made profile: it may be complete already.
      if (shouldArmFinishHop({ firstSignIn: isFirstSignIn(user), claim })) armPostLoginPrompt();

      // A deleted (= hidden) account restores BEFORE anything else: before any returnTo is followed
      // and before the profile read (a hidden profile reads as missing). The returnTo rides along
      // so the restore page's Continue still gets there. A failed read carries on (lib/accountDeletion).
      const restoreTo = await signInDeletionTarget(safeReturnTo ?? sanitizeReturnTo(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY)));
      if (restoreTo) {
        localStorage.removeItem(AUTH_PENDING_RETURN_TO_KEY);
        recordLanding();
        navigate(restoreTo, { replace: true });
        return;
      }

      // Then, and only for an account that is not hidden (review finding 15), the organiser pages an
      // admin recorded this email against (automatic, no confirm screen). Never throws and never
      // holds the sign-in; empty on any failure.
      claimedRef.current = await claimOrganisersAtSignIn(user.id);

      try {
        const pendingRole = localStorage.getItem("pending_profile_role");
        const isSignupFlow = callbackMode === "signup" || (callbackMode !== "signin" && Boolean(pendingRole));
        // "What do you do?" (B-WEB4): a sign-up only, after both claims. Recorded once; it changes
        // where the account lands and nothing else (Organiser grants nothing, C12). The seat is
        // read only when a Teacher/DJ landing depends on it; claimed pages are a seat already.
        let pendingRoles: string | null = null;
        try {
          pendingRoles = localStorage.getItem(PENDING_ROLE_INTENT_KEY);
          localStorage.removeItem(PENDING_ROLE_INTENT_KEY);
        } catch { /* unreadable: the metadata still carries them */ }
        const signupRoles = isSignupFlow ? readSignupRoles(pendingRoles, user.user_metadata?.[ROLE_INTENT_META_KEY]) : null;
        let holdsOrganiserSeat: boolean | null = claimedRef.current.length > 0 ? true : null;
        if (signupRoles) {
          // Only the account's FIRST sign-in records: set_my_role_intent_v1 replaces the stored roles, and the
          // sign-up form used again on an existing account must not overwrite what it chose then.
          if (isFirstSignIn(user)) await recordRoleIntent(signupRoles);
          if (holdsOrganiserSeat === null && choseTeacherOrDj(signupRoles)) holdsOrganiserSeat = await readHoldsOrganiserSeat();
          alreadyListedPending.current = showsAlreadyListedStep({ roles: signupRoles, claimStatus: claim.status });
        }
        // An e-mailed-link sign-up saw the clickwrap but never passed the typed-code screen, so record the
        // consent here (idempotent server-side, so a typed-code sign-up that already did is harmless).
        // Not awaited: it never holds the person back; acceptTerms has its own timeout and never throws.
        let alreadyRecorded = false;
        try {
          alreadyRecorded = sessionStorage.getItem("terms_recorded_this_signup") === "1";
          sessionStorage.removeItem("terms_recorded_this_signup");
        } catch { /* unreadable: record again, harmless */ }
        if (callbackMode === "signup" && !alreadyRecorded) void acceptTerms();
        const meta = user.user_metadata || {};
        // Called for its side effect (it persists a metadata role); routing reads the role itself.
        resolveRolePreference(pendingRole, meta.user_type);

        // The RESOLVED persona, not the row keyed on auth.uid(): the save below
        // goes through resolve_my_person_id_v1 -> _my_dancer_profile_id_v1, which
        // is a linked admin-made profile when the account has one (claimed_by).
        // Judging the account's own stub instead wrote the sign-up name, city and
        // role over that admin profile on every sign-in while the stub was empty.
        // A read that FAILED is not a row that is missing: fetchMyPersonaId
        // throws on a failed call. Without that, a 5xx or a dropped connection
        // told the user we could not create their profile -- a claim about the
        // write path, made on the evidence of a broken read. Fresh, not cached:
        // the claim above may have just changed the answer.
        const personaId = await fetchMyPersonaId();

        let dancer: {
          id: string;
          first_name: string | null;
          based_city_id: string | null;
          dance_role: string | null;
        } | null = null;
        if (personaId) {
          // No meta_data: authenticated loses SELECT on it (contact lockdown step
          // 3, admin #770), and the routing below never needs it -- a stamp can
          // not make inferOnboardingStatusFromDancer answer "completed".
          const { data, error: dancerError } = await supabase
            .from("dancer_profiles")
            .select("id, first_name, based_city_id, dance_role")

            .eq("id", personaId)
            .maybeSingle();
          if (dancerError) throw dancerError;
          dancer = data;
        }

        // The routing tail, which used to be spelled out twice -- once per
        // branch -- and had to be kept in step by hand.
        const routeOnwards = async () => {
          // An explicit returnTo, then the stashed path, still wins over the claim landing (D37).
          const claimPath = claimLanding();
          // A sign-up honours returnTo too once self-serve is on, so "Sign in
          // to claim" -> new account lands back on the claim card (Lever 2 B3).
          // W2 walk fix 7: an Organiser sign-up from a plain public page goes on to the organiser onboarding.
          const organiserSignup = !!signupRoles?.includes('organiser') || (normalizeLandingRole(pendingRole) ?? normalizeLandingRole(meta.user_type)) === 'organiser';
          const honours = (rt: string) => shouldHonorReturnTo({ returnTo: rt, isSignupFlow, organiserSelfServe: flags.organiserSelfServe, organiserSignup });
          if (safeReturnTo && honours(safeReturnTo)) {
            land(safeReturnTo);
            return;
          }

          const pendingReturnTo = sanitizeReturnTo(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY));
          if (pendingReturnTo) {
            localStorage.removeItem(AUTH_PENDING_RETURN_TO_KEY);
            if (!isSignupFlow || !organiserSignup || isTaskReturnTo(pendingReturnTo)) {
              land(pendingReturnTo);
              return;
            }
          }

          // No returnTo: lib/auth-otp-routing decides. A sign-in (and a dancer
          // sign-up) goes to /account/continue, which reads the person's sides
          // and goes straight to the only one or shows "Continue as..."; an
          // organiser-type sign-up goes to the organiser onboarding as before.
          // Pages claimed at this sign-in land where they are managed.
          // A sign-up's roles then move it: an organiser seat keeps this landing, else Teacher,
          // else DJ, else this landing (lib/auth-otp-routing signupIntentLanding).
          // An Organiser ticked in the sign-up's multi-select counts as the organiser role (fix 7), even with Dancer kept as the entry role.
          const landingRole = isSignupFlow && organiserSignup ? 'organiser' : normalizeLandingRole(pendingRole) ?? normalizeLandingRole(meta.user_type);
          const todays = claimPath ?? landingPathAfterAuth({ organiserSelfServe: flags.organiserSelfServe, organiserP3: flags.organiserP3, role: landingRole, isSignup: isSignupFlow });
          land(signupIntentLanding({ roles: signupRoles, holdsOrganiserSeat, todays }));
          localStorage.removeItem("pending_profile_role");
        };

        // `if (dancer?.id)` is no longer a useful question -- the signup trigger
        // means the answer is always yes. Whether the profile is FILLED IN is
        // the question that still discriminates.
        if (inferOnboardingStatusFromDancer(dancer) === "completed") {
          await routeOnwards();
          return;
        }

        // Trimmed: '   ' is truthy, and the function's NULLIF only rejects the
        // EMPTY string -- so whitespace would be stored, hasDancerProfileBasics
        // would trim it back to false, and AuthGuard would bounce the user
        // straight to /onboarding. Exactly what this block exists to avoid.
        const firstName = (meta.first_name as string | undefined)?.trim() || undefined;
        const city = meta.city as string | undefined;
        const cityId = meta.city_id as string | undefined;
        // Asked on both sign-up screens since 2026-10-10. Metadata is
        // attacker-shaped, so only a value dancer_profiles_dance_role_check
        // admits is passed on; anything else is left for /finish-profile.
        const danceRole = isDanceRoleValue(meta.dance_role) ? meta.dance_role : null;

        // Send ONLY what is empty on the persona: the RPC overwrites name and city
        // with any non-empty value sent, and dance_role whenever the key is present.
        const isBlank = (value: string | null | undefined) => !value?.trim();
        const needsName = isBlank(dancer?.first_name);
        const needsCity = isBlank(dancer?.based_city_id);
        const sendRole = isBlank(dancer?.dance_role) ? danceRole : null;

        // The persona exists but is not filled in. `ensureDancerProfile` used to
        // run here and is now deleted: its RPC had 404'd for every user since it
        // was written -- it targeted `public.dancers`, which is not a table in
        // this database -- and its fallback INSERT could never run without an
        // INSERT grant. Creation belongs to the signup trigger; all that is left
        // to do here is fill the stub in from what was collected at sign-up, so
        // the user is not asked for it twice.
        //
        // The block this replaces also re-read the profile WITHOUT
        // `.maybeSingle()` and then UPDATEd `[0]` of the result. Keyed on
        // created_by, that was an unordered pick among ten strangers' rows for
        // the one account that had authored any.
        if (dancer?.id && (!needsName || firstName) && (!needsCity || city || cityId)) {
          try {
            // Both go through the resolver. user_metadata is attacker-shaped
            // input from the sign-up payload, and it is never validated
            // elsewhere: an unresolvable id would 22P02 the save, while a
            // valid-but-stale one (a merged city) would stamp the wrong city AND
            // mark onboarding complete, since completion only tests that
            // based_city_id is non-null. resolveCanonicalCity already accepts a
            // UUID and returns null for one it cannot find.
            // Try the id, then fall back to the NAME. `cityId || city` alone
            // short-circuits: a stale metadata city_id (a merged or deleted city)
            // resolves to nothing and the name we also hold is never tried, so
            // the user is re-asked for a city they already gave us.
            const basedCityId = needsCity
              ? (await resolveCanonicalCity(cityId))?.cityId ?? (await resolveCanonicalCity(city))?.cityId
              : null;
            if (needsCity && !basedCityId) {
              navigateToSignedInFallback();
              return;
            }

            // No meta_data stamp: `inferOnboardingStatusFromDancer` derives
            // completion from exactly the two fields written here, and the RPC
            // has no meta_data arm to stamp with in any case.
            const saved = await saveMyDancerProfile({
              ...(needsName ? { first_name: firstName } : {}),
              ...(basedCityId ? { based_city_id: basedCityId } : {}),
              ...(sendRole ? { dance_role: sendRole } : {}),
            });

            // Do not route as if setup worked without checking that it did. The
            // RPC reports success for a payload it decided to ignore, and the
            // next gate re-reads the row -- so an unverified hop here becomes a
            // bounce a moment later.
            if (!hasDancerProfileBasics(saved as { first_name?: string | null; based_city_id?: string | null })) {
              navigateToSignedInFallback();
              return;
            }

            await routeOnwards();
            return;
          } catch (profileErr) {
            navigateToSignedInFallback();
            return;
          }
        }

        // Either the signup metadata is too thin to fill the stub with, or there
        // is no stub at all -- which is now a genuine failure, since nothing else
        // creates one. Both used to land on the retired /onboarding; see
        // navigateToSignedInFallback.
        navigateToSignedInFallback();
      } catch (err) {
        navigateToSignedInFallback();
      }
    };

    void supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        void resolveSession(session);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        void resolveSession(session);
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [callbackMode, navigate, safeReturnTo, queryClient]);

  useEffect(() => {
    if (resolved.current) return;

    const fallbackTimer = setTimeout(async () => {
      if (resolved.current) return;

      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) return;

      resolved.current = true;
      const hasAuthParams = Boolean(window.location.hash) || Boolean(searchParams.get("code"));
      navigateToSignInFallback(hasAuthParams ? "expired" : "manual");
      // Must stay ABOVE AUTH_RESOLVE_TIMEOUT_MS (src/lib/authResolution.ts,
      // currently 8000). Both clocks start on mount, so the provider settles
      // first and the two cannot reach opposite verdicts about the same
      // sign-in. Lowering this below that constant would let the callback
      // declare a link expired while auth resolution was still in progress --
      // telling a correctly-authenticated user their link failed, which is the
      // exact outcome the supabase-defer arc's P5 exists to prevent.
    }, 9000);

    return () => clearTimeout(fallbackTimer);
  }, [navigate, searchParams]);

  if (error) {
    return (
      <GlobalLayout showSubheader={false} showGradientBg={false}>
        <div className="pt-20 px-4">
          <div className="max-w-sm mx-auto text-center space-y-4">
            <h1 className="text-xl font-semibold text-foreground">Authentication failed</h1>
            <p className="text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => navigate("/auth?mode=signin", { replace: true })}>
              Try again
            </Button>
          </div>
        </div>
      </GlobalLayout>
    );
  }

  if (alreadyListedTo) {
    return (
      <GlobalLayout showSubheader={false} showGradientBg={false}>
        <div className="pt-20 px-4">
          <section className="max-w-sm mx-auto space-y-3 rounded-xl border bg-card p-3" aria-labelledby="already-listed-title">
            <h1 id="already-listed-title" className="text-lg font-semibold text-foreground">{ALREADY_LISTED_TITLE}</h1>
            <p className="text-sm text-muted-foreground">{ALREADY_LISTED_BODY}</p>
            <a
              href={ALREADY_LISTED_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[44px] w-full items-center justify-center rounded-full border border-primary px-3 text-[15px] font-semibold text-primary"
            >
              {ALREADY_LISTED_LINK_LABEL}
            </a>
            <Button className="w-full min-h-[44px] rounded-full font-semibold" onClick={() => land(alreadyListedTo)}>
              Continue
            </Button>
          </section>
        </div>
      </GlobalLayout>
    );
  }

  return (
    <GlobalLayout showSubheader={false} showGradientBg={false}>
      <div className="pt-20 px-4">
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <p className="text-center text-sm text-muted-foreground">Signing you in&hellip;</p>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default AuthCallback;

