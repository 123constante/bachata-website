import { useState } from "react";
import { Link } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { AuthGuard } from "@/components/auth/AuthGuard";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { CityPicker } from "@/components/ui/city-picker";
import { DanceRolePicker } from "@/components/profile/DanceRolePicker";
import { HideSurnameSwitch, hideSurnameDisabledReason } from "@/components/profile/HideSurnameSwitch";
import { useAuth } from "@/hooks/useAuth";
import { useNoindexMeta } from "@/hooks/useNoindexMeta";
import { useProfileCompletion } from "@/hooks/useProfileCompletion";
import { supabase } from "@/integrations/supabase/client";
import { buildBreadcrumbs } from "@/lib/breadcrumbs";
import { DANCER_HOME_PATH } from "@/lib/accountRouting";
import { isDanceRoleValue } from "@/lib/auth-otp-routing";
import { buildDancerEditSave, dancerEditSaveReason, type DancerEditFields } from "@/lib/dancerEditProfile";
import { MY_DANCER_SUMMARY_ROOT, myPersonaIdForReads } from "@/lib/myPersona";
import { NO_PROFILE_CONTACT_LABEL, NO_PROFILE_CONTACT_URL, completenessFact } from "@/lib/profileCompletion";
import { saveMyDancerProfile } from "@/lib/saveMyDancerProfile";

const editQueryKey = (userId: string | null | undefined) => ["my-dancer-edit", userId ?? null] as const;
const PILL =
  "inline-flex min-h-[44px] items-center justify-center rounded-full bg-primary px-[16px] text-[14px] font-semibold text-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white";

/** The person's OWN row (lib/myPersona), only the columns this screen edits. */
const fetchEditFields = async (resolvePersona: () => Promise<string | null>): Promise<DancerEditFields | null> => {
  const id = await resolvePersona();
  if (!id) return null;
  // The generated types predate hide_surname_publicly (HideSurnameCard reads it the same way).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("dancer_profiles")
    .select("first_name, surname, based_city_id, dance_role, hide_surname_publicly")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    firstName: typeof data.first_name === "string" ? data.first_name : "",
    surname: typeof data.surname === "string" ? data.surname : "",
    cityId: typeof data.based_city_id === "string" ? data.based_city_id : "",
    danceRole: isDanceRoleValue(data.dance_role) ? data.dance_role : "",
    hideSurname: typeof data.hide_surname_publicly === "boolean" ? data.hide_surname_publicly : null,
  };
};

/** The form, once the row is read. `initial` is the stored state; it moves only after a save lands. */
const EditForm = ({
  initial,
  saved,
  onSaved,
  onEdited,
}: {
  initial: DancerEditFields;
  saved: boolean;
  onSaved: () => Promise<void>;
  onEdited: () => void;
}) => {
  // The screen re-keys this form on the stored state, so a save's refetch resets the draft.
  const [draft, setDraft] = useState<DancerEditFields>(initial);

  const save = useMutation({
    mutationFn: () => {
      const input = buildDancerEditSave(initial, draft);
      if (!input) throw new Error("nothing to save");
      return saveMyDancerProfile(input);
    },
    onSuccess: async () => {
      await onSaved();
    },
  });

  const set = <K extends keyof DancerEditFields>(key: K, value: DancerEditFields[K]) => {
    onEdited();
    setDraft((d) => ({ ...d, [key]: value }));
  };
  const reason = dancerEditSaveReason(initial, draft, save.isPending);
  const switchReason = hideSurnameDisabledReason({
    isSaving: save.isPending,
    firstName: draft.firstName,
    cityId: draft.cityId,
    switchReadable: initial.hideSurname !== null,
  });

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (reason === null) save.mutate();
      }}
      data-testid="dancer-edit-form"
    >
      <div className="space-y-2">
        <Label htmlFor="edit-first-name" className="text-sm font-medium">First name</Label>
        <Input
          id="edit-first-name"
          autoComplete="given-name"
          className="min-h-[44px]"
          value={draft.firstName}
          onChange={(e) => set("firstName", e.target.value)}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="edit-surname" className="text-sm font-medium">Surname</Label>
        <Input
          id="edit-surname"
          autoComplete="family-name"
          placeholder="Optional"
          className="min-h-[44px]"
          value={draft.surname}
          onChange={(e) => set("surname", e.target.value)}
        />
      </div>
      <HideSurnameSwitch
        checked={draft.hideSurname ?? false}
        onChange={(next) => set("hideSurname", next)}
        disabledReason={switchReason}
      />

      <div className="space-y-2">
        <Label className="text-sm font-medium">Your city</Label>
        <CityPicker value={draft.cityId} onChange={(id) => set("cityId", id)} placeholder="Select your city&hellip;" className="min-h-[44px]" />
      </div>

      <div className="space-y-2">
        <p id="edit-dance-role-label" className="text-sm font-medium">Dance role</p>
        <DanceRolePicker labelId="edit-dance-role-label" value={draft.danceRole} onChange={(v) => set("danceRole", v)} />
      </div>

      {save.isError && (
        <p role="alert" className="text-sm text-destructive">
          We couldn&rsquo;t save your profile. Check your connection and try again.
        </p>
      )}
      {saved && reason !== null && (
        <p role="status" className="text-sm text-foreground" data-testid="dancer-edit-saved">Saved.</p>
      )}

      <button
        type="submit"
        className={`${PILL} w-full disabled:opacity-50`}
        disabled={reason !== null}
        aria-describedby={reason ? "dancer-edit-save-reason" : undefined}
        data-testid="dancer-edit-save"
      >
        {save.isPending ? <>Saving&hellip;</> : "Save"}
      </button>
      {reason && !save.isPending && !(saved && reason === "Nothing to save yet") && (
        <p id="dancer-edit-save-reason" className="text-center text-sm text-muted-foreground">{reason}</p>
      )}
      {saved && reason === "Nothing to save yet" && (
        <p id="dancer-edit-save-reason" className="text-center text-sm text-muted-foreground">Nothing more to save.</p>
      )}
    </form>
  );
};

/** The screen itself; exported for tests. The route renders the guarded default export. */
export const EditDancerProfileScreen = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const completion = useProfileCompletion();
  const noProfile = completenessFact(completion).kind === "no_profile";
  const q = useQuery({
    queryKey: editQueryKey(user?.id),
    queryFn: () => fetchEditFields(() => myPersonaIdForReads(queryClient, user!.id)),
    enabled: Boolean(user?.id) && !user?.is_anonymous && !noProfile,
  });

  const [saved, setSaved] = useState(false);

  // After a save: the dancer home's summary, the completion cache (as FinishProfile does), the hide card, and this form.
  const afterSave = async () => {
    void queryClient.invalidateQueries({ queryKey: [MY_DANCER_SUMMARY_ROOT] });
    void queryClient.invalidateQueries({ queryKey: ["my-hide-surname"] });
    await Promise.all([completion.refetch(), queryClient.invalidateQueries({ queryKey: editQueryKey(user?.id) })]);
    setSaved(true);
  };

  let body;
  if (noProfile || (q.isSuccess && q.data === null)) {
    body = (
      <div className="space-y-3" data-testid="dancer-edit-no-profile">
        <p className="text-sm text-foreground">{completenessFact(completion).text}</p>
        <a href={NO_PROFILE_CONTACT_URL} target="_blank" rel="noopener noreferrer" className={`${PILL} w-full`}>
          {NO_PROFILE_CONTACT_LABEL}
        </a>
      </div>
    );
  } else if (q.isError) {
    body = (
      <div className="space-y-3" data-testid="dancer-edit-failed">
        <p className="text-sm text-muted-foreground">We couldn&rsquo;t load your profile just now. Check your connection and try again.</p>
        <button type="button" className={`${PILL} w-full`} onClick={() => void q.refetch()}>Try again</button>
      </div>
    );
  } else if (q.data) {
    body = <EditForm key={JSON.stringify(q.data)} initial={q.data} saved={saved} onSaved={afterSave} onEdited={() => setSaved(false)} />;
  } else {
    body = (
      <div className="space-y-3" aria-busy="true">
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
        <Skeleton className="h-11 w-full" />
      </div>
    );
  }

  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs("dancerProfile.edit")}>
      <div className="px-4 pb-24 pt-3">
        <div className="mx-auto w-full max-w-md space-y-3">
          <h1 className="text-lg font-bold text-foreground">Edit my profile</h1>
          <div className="rounded-xl border border-border bg-card p-3">{body}</div>
          <p className="text-[13px] text-muted-foreground">Photo, bio and social links are coming to this screen later.</p>
          <Link
            to={DANCER_HOME_PATH}
            className="flex min-h-[44px] items-center justify-center text-[14px] font-semibold text-primary underline underline-offset-2"
            data-testid="dancer-edit-back"
          >
            Back to your profile
          </Link>
        </div>
      </div>
    </GlobalLayout>
  );
};

// Signed out -> /auth with returnTo. Not behind the dancer-first gate: an unfinished profile is exactly who needs this.
const EditDancerProfile = () => {
  useNoindexMeta(true);
  return (
    <AuthGuard>
      <EditDancerProfileScreen />
    </AuthGuard>
  );
};

export default EditDancerProfile;
