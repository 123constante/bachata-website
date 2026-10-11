import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CityPicker } from "@/components/ui/city-picker";
import { AvatarUpload } from "@/components/profile/AvatarUpload";
import { DanceRolePicker } from "@/components/profile/DanceRolePicker";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { sanitizeReturnTo } from "@/lib/authRouting";
import { MY_DANCER_SUMMARY_ROOT } from "@/lib/myPersona";
import { DANCER_GATE_REASON } from "@/lib/accountRouting";
import type { DanceRoleValue } from "@/lib/auth-otp-routing";
import {
  NO_PROFILE_CONTACT_LABEL,
  NO_PROFILE_CONTACT_URL,
  FINISH_PROFILE_PATH,
  completenessFact,
  finishScreenMode,
  isGatedFinish,
  skipFinishProfileForSession,
  type ProfileField,
} from "@/lib/profileCompletion";
import { saveMyDancerProfile, type SaveMyDancerProfileInput } from "@/lib/saveMyDancerProfile";

type Draft = { first_name: string; based_city_id: string; dance_role: DanceRoleValue | ""; avatar_url: string };

/**
 * Only the fields this screen ASKED for, and only those actually filled in.
 * An untouched form is null: no command is sent (save_my_dancer_profile_v1
 * treats '' as "leave unchanged" anyway, but a no-op save should not exist).
 */
export const buildFinishProfileSave = (fields: readonly ProfileField[], draft: Draft): SaveMyDancerProfileInput | null => {
  const input: SaveMyDancerProfileInput = {};
  for (const field of fields) {
    const value = draft[field].trim();
    if (!value) continue;
    if (field === "dance_role") input.dance_role = value;
    else input[field] = value;
  }
  return Object.keys(input).length > 0 ? input : null;
};

const PILL = "w-full min-h-[44px] rounded-full font-semibold";

/** The screen itself; exported for tests. The route renders the guarded default export. */
export const FinishProfileScreen = () => {
  const completion = useProfileCompletion();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  // Never back to this screen itself: Skip and Continue would go nowhere.
  const returnTo = sanitizeReturnTo(searchParams.get("returnTo"), { exclude: FINISH_PROFILE_PATH }) ?? "/";
  // Reached through the dancer-first gate (an /account* page, or an organiser
  // claim the server refused): say why, and offer no Skip -- skipping would only
  // send the person back into the gate.
  const gated = isGatedFinish(searchParams);
  // Gated with a cached "complete": the server refused an organiser claim / create /
  // request for an unfinished profile, so re-ask it once on arrival. (The gate's own
  // redirects arrive with a fresh "incomplete": nothing to re-ask.)
  useEffect(() => {
    if (gated && completion.status === "complete") void completion.refetch();
    // Once per arrival; completion is a fresh object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gated]);

  const [draft, setDraft] = useState<Draft>({ first_name: "", based_city_id: "", dance_role: "", avatar_url: "" });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const mode = finishScreenMode(completion);
  const fields = mode.kind === "form" ? mode.fields : [];
  const pending = buildFinishProfileSave(fields, draft);

  const goBack = () => navigate(returnTo, { replace: true });
  const skip = () => {
    skipFinishProfileForSession();
    goBack();
  };

  const save = async () => {
    if (!pending || saving) return;
    setSaving(true);
    setSaveError(false);
    setNotice(null);
    try {
      await saveMyDancerProfile(pending);
      // The dancer home's summary (name, city, role, photo) read the row before this save.
      void queryClient.invalidateQueries({ queryKey: [MY_DANCER_SUMMARY_ROOT] });
      // The SAME cache the rating card's gate is published from (ProfileCompletionChrome):
      // refetching it here is what lets the card open on return, with no reload.
      const fresh = await completion.refetch();
      if (fresh.status === "complete") {
        goBack();
        return;
      }
      if (fresh.status === "incomplete") setNotice(`Saved. ${completenessFact(fresh).text}`);
      else setNotice("Saved. We couldn\u2019t re-check your profile just now \u2014 reload this page to see what is left.");
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((prev) => ({ ...prev, [key]: value }));

  let body;
  if (mode.kind === "loading") {
    body = (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  } else if (mode.kind === "error") {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">
          We couldn&rsquo;t check your profile just now. Check your connection and try again.
        </p>
        <Button className={PILL} onClick={() => void completion.refetch()}>Try again</Button>
        {!gated && (
          <Button variant="ghost" className="w-full min-h-[44px] rounded-full text-muted-foreground" onClick={skip}>
            Skip for now
          </Button>
        )}
      </div>
    );
  } else if (mode.kind === "done") {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-foreground">{completenessFact(completion).text}</p>
        <Button className={PILL} onClick={goBack}>Continue</Button>
      </div>
    );
  } else if (mode.kind === "no_profile") {
    body = (
      <div className="space-y-3">
        <p className="text-sm text-muted-foreground">{completenessFact(completion).text}</p>
        <a
          href={NO_PROFILE_CONTACT_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full min-h-[44px] items-center justify-center rounded-full bg-primary px-4 text-[14px] font-semibold text-black"
        >
          {NO_PROFILE_CONTACT_LABEL}
        </a>
        {/* Gated, "Continue" would only lead straight back into the gate: nothing to
            fill in here (no live dancer profile), so the contact is the way on. */}
        {!gated && (
          <Button variant="ghost" className="w-full min-h-[44px] rounded-full text-muted-foreground" onClick={goBack}>
            Continue
          </Button>
        )}
      </div>
    );
  } else {
    body = (
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <p className="text-sm text-muted-foreground">
          {completenessFact(completion).text}
          {!gated && " Everything else on the site works without it."}
        </p>

        {fields.includes("first_name") && (
          <div className="space-y-2">
            <Label htmlFor="finish-first-name" className="text-sm font-medium">First name</Label>
            <Input
              id="finish-first-name"
              autoComplete="given-name"
              placeholder="Your first name"
              className="min-h-[44px]"
              value={draft.first_name}
              onChange={(e) => set("first_name", e.target.value)}
            />
          </div>
        )}

        {fields.includes("based_city_id") && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Your city</Label>
            <CityPicker
              value={draft.based_city_id}
              onChange={(id) => set("based_city_id", id)}
              placeholder="Select your city&hellip;"
              className="min-h-[44px]"
            />
          </div>
        )}

        {fields.includes("dance_role") && (
          <div className="space-y-2">
            <p id="finish-dance-role-label" className="text-sm font-medium">Dance role</p>
            <DanceRolePicker
              labelId="finish-dance-role-label"
              value={draft.dance_role}
              onChange={(v) => set("dance_role", v)}
            />
          </div>
        )}

        {fields.includes("avatar_url") && completion.profileId && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Photo</p>
            <AvatarUpload
              value={draft.avatar_url}
              onChange={(url) => set("avatar_url", url)}
              userId={completion.profileId}
              initials={(draft.first_name.trim()[0] ?? "?").toUpperCase()}
            />
          </div>
        )}

        {notice && (
          <p role="status" className="text-sm text-foreground">{notice}</p>
        )}
        {saveError && (
          <p role="alert" className="text-sm text-destructive">
            We couldn&rsquo;t save your profile. Check your connection and try again.
          </p>
        )}

        <Button type="submit" className={PILL} disabled={!pending || saving} aria-describedby={!pending ? "finish-save-hint" : undefined}>
          {saving ? "Saving\u2026" : "Save"}
        </Button>
        {!pending && (
          <p id="finish-save-hint" className="text-center text-sm text-muted-foreground">
            Fill in at least one field above to save.
          </p>
        )}
        {!gated && (
          <Button type="button" variant="ghost" className="w-full min-h-[44px] rounded-full text-muted-foreground" onClick={skip}>
            Skip for now
          </Button>
        )}
      </form>
    );
  }

  // No breadcrumb: a sign-in step like Auth / AuthCallback / Onboarding
  // (.claude/rules/breadcrumbs.md), so showSubheader={false}.
  return (
    <GlobalLayout showSubheader={false}>
      {/* No background and no min-height here: GlobalLayout paints the page wash
          (fixed, full screen). An opaque bg-background block 70vh tall used to sit
          on top of it, so the page read as a black block with the wash showing
          below it as a purple band. */}
      <div className="px-4 pb-24 pt-6">
        <div className="mx-auto w-full max-w-md space-y-3">
          <h1 className="text-lg font-bold text-foreground">{gated && mode.kind !== "done" ? "Finish your dancer profile" : "Finish your profile"}</h1>
          {/* Not once the profile reads complete: "finish first" above "complete" would contradict itself. */}
          {gated && mode.kind !== "done" && (
            <p className="text-sm text-foreground" data-testid="finish-gate-reason">{DANCER_GATE_REASON}</p>
          )}
          <div className="rounded-xl border border-border bg-card p-3">{body}</div>
        </div>
      </div>
    </GlobalLayout>
  );
};

// Signed out -> /auth (sign-in) with returnTo, the same guard the account pages use.
const FinishProfile = () => (
  <AuthGuard>
    <FinishProfileScreen />
  </AuthGuard>
);

export default FinishProfile;
