import { useEffect, useState, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchMyPersonaId } from "@/lib/myPersona";
import { claimAtSignIn, shouldArmFinishHop } from "@/lib/claimMyDancerProfile";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { saveMyDancerProfile } from "@/lib/saveMyDancerProfile";
import { resolveCanonicalCity } from "@/lib/city-canonical";
import { AUTH_PENDING_RETURN_TO_KEY, sanitizeReturnTo } from "@/lib/authRouting";
import { hasDancerProfileBasics, inferOnboardingStatusFromDancer } from "@/lib/onboardingStatus";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { flags } from "@/lib/featureFlags";
import {
  armPostLoginPrompt,
  isDanceRoleValue,
  isFirstSignIn,
  landingPathAfterAuth,
  needsOrganiserLookup,
  normalizeLandingRole,
  shouldHonorReturnTo,
} from "@/lib/auth-otp-routing";
import { fetchOrganiserHome } from "@/modules/organiser-self-serve/selfServeApi";

const VALID_ROLES: Record<string, string> = {
  organiser: "/create-organiser-profile",
  videographer: "/create-videographer-profile",
};

const AuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const [error] = useState<string | null>(null);
  const resolved = useRef(false);

  const safeReturnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const callbackMode = searchParams.get("mode");

  // Signed in, but the profile could not be filled in. This used to go to
  // /onboarding?authFallback=<reason>, and /onboarding was retired on
  // 2026-09-12 -- so a successful sign-in ended on "Page not found". The reason
  // was only ever read by that page. Carry on to where they were heading
  // (returnTo, then a stashed one), else home.
  const navigateToSignedInFallback = () => {
    const pendingReturnTo = sanitizeReturnTo(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY));
    localStorage.removeItem(AUTH_PENDING_RETURN_TO_KEY);
    navigate(safeReturnTo ?? pendingReturnTo ?? "/", { replace: true });
  };

  const navigateToSignInFallback = (reason: "expired" | "invalid" | "manual" | "timeout") => {
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

      const user = session.user;
      // Self-claim FIRST (every sign-in; never throws, never holds the sign-in
      // past its timeout), so the persona read below is the linked profile.
      const claim = await claimAtSignIn(queryClient);
      // The account's FIRST sign-in only: wherever this lands, ProfileCompletionChrome
      // then hops once to /finish-profile if profile_complete_v1 is false (and Skip
      // was not pressed). Every later sign-in gets the banner alone. Not on the
      // sign-in that just linked an admin-made profile: it may be complete already.
      if (shouldArmFinishHop({ firstSignIn: isFirstSignIn(user), claim })) armPostLoginPrompt();

      try {
        const pendingRole = localStorage.getItem("pending_profile_role");
        const isSignupFlow = callbackMode === "signup" || (callbackMode !== "signin" && Boolean(pendingRole));
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
          meta_data: unknown;
        } | null = null;
        if (personaId) {
          const { data, error: dancerError } = await supabase
            .from("dancer_profiles")
            .select("id, first_name, based_city_id, dance_role, meta_data")
            .eq("id", personaId)
            .maybeSingle();
          if (dancerError) throw dancerError;
          dancer = data;
        }

        // The routing tail, which used to be spelled out twice -- once per
        // branch -- and had to be kept in step by hand.
        const routeOnwards = async () => {
          // A sign-up honours returnTo too once self-serve is on, so "Sign in
          // to claim" -> new account lands back on the claim card (Lever 2 B3).
          if (safeReturnTo && shouldHonorReturnTo({ returnTo: safeReturnTo, isSignupFlow, organiserSelfServe: flags.organiserSelfServe })) {
            navigate(safeReturnTo, { replace: true });
            return;
          }

          const pendingReturnTo = sanitizeReturnTo(localStorage.getItem(AUTH_PENDING_RETURN_TO_KEY));
          if (pendingReturnTo) {
            localStorage.removeItem(AUTH_PENDING_RETURN_TO_KEY);
            navigate(pendingReturnTo, { replace: true });
            return;
          }

          // With self-serve on, only organiser-type roles land on /account
          // (its first run asks "Which organiser are you?"); a dancer goes
          // home. A sign-in with no role at all (older accounts) goes to
          // /account only if the user already manages an organiser.
          const landingRole = normalizeLandingRole(pendingRole) ?? normalizeLandingRole(meta.user_type);
          let managesOrganiser: boolean | null = null;
          if (needsOrganiserLookup({ organiserSelfServe: flags.organiserSelfServe, role: landingRole })) {
            try {
              managesOrganiser = (await fetchOrganiserHome()).organisers.length > 0;
            } catch {
              // A failed lookup is not "no organiser": /account handles its own load error.
              managesOrganiser = null;
            }
          }
          navigate(
            landingPathAfterAuth({ organiserSelfServe: flags.organiserSelfServe, role: landingRole, managesOrganiser }),
            { replace: true },
          );
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
      <GlobalLayout showSubheader={false}>
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

  return (
    <GlobalLayout showSubheader={false}>
      <div className="pt-20 px-4">
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
          <p className="text-center text-sm text-muted-foreground">Signing you in…</p>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default AuthCallback;

