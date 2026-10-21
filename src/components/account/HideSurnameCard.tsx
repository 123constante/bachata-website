import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { myPersonaIdForReads } from "@/lib/myPersona";
import { saveMyDancerProfile } from "@/lib/saveMyDancerProfile";
import { HideSurnameSwitch, hideSurnameDisabledReason } from "@/components/profile/HideSurnameSwitch";

const hideSurnameQueryKey = (userId: string | null | undefined) => ["my-hide-surname", userId ?? null] as const;

type HideSurnameRead = { firstName: string; cityId: string; hidden: boolean | null };

/** The person's OWN row (lib/myPersona): the switch, read on its own so an unreadable column cannot take anything else down. */
const fetchHideSurname = async (resolvePersona: () => Promise<string | null>): Promise<HideSurnameRead | null> => {
  const id = await resolvePersona();
  if (!id) return null;
  // The generated types predate hide_surname_publicly (EditProfile reads it the same way).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase as any)
    .from("dancer_profiles")
    .select("first_name, based_city_id, hide_surname_publicly")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    firstName: typeof data.first_name === "string" ? data.first_name : "",
    cityId: typeof data.based_city_id === "string" ? data.based_city_id : "",
    hidden: typeof data.hide_surname_publicly === "boolean" ? data.hide_surname_publicly : null,
  };
};

/**
 * "Hide my surname" on the dancer home (/account, /account/dancer) -- the one screen
 * a signed-in dancer reliably reaches; the old edit-profile page has no route.
 * Saves through save_my_dancer_profile_v1 and sends ONLY the switch, and only when
 * the person changed it: an untouched card has nothing to save.
 */
export function HideSurnameCard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const q = useQuery({
    queryKey: hideSurnameQueryKey(user?.id),
    queryFn: () => fetchHideSurname(() => myPersonaIdForReads(queryClient, user!.id)),
    enabled: Boolean(user?.id) && !user?.is_anonymous,
  });
  const [draft, setDraft] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);

  const save = useMutation({
    mutationFn: (hide: boolean) => saveMyDancerProfile({ hide_surname_publicly: hide }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: hideSurnameQueryKey(user?.id) });
      setDraft(null);
      setSaved(true);
    },
  });

  if (q.isLoading) return null;
  const read = q.data ?? null;
  const stored = read?.hidden ?? null;
  const checked = draft ?? stored ?? false;
  const changed = stored !== null && draft !== null && draft !== stored;
  const reason = hideSurnameDisabledReason({
    isSaving: save.isPending,
    firstName: read?.firstName ?? "",
    cityId: read?.cityId ?? "",
    switchReadable: stored !== null,
  });

  return (
    <section className="space-y-2" data-testid="dancer-home-hide-surname">
      <HideSurnameSwitch
        checked={checked}
        onChange={(next) => {
          setSaved(false);
          setDraft(next === stored ? null : next);
        }}
        disabledReason={reason}
      />
      <button
        type="button"
        className="inline-flex min-h-[44px] items-center justify-center rounded-[var(--r-ctl)] border border-[var(--line-strong)] bg-transparent px-[16px] text-[14px] font-semibold text-[var(--fg)] disabled:opacity-50"
        disabled={!changed || reason !== null}
        onClick={() => changed && save.mutate(draft!)}
        data-testid="hide-surname-save"
      >
        {save.isPending ? <>Saving&hellip;</> : "Save"}
      </button>
      {!changed && reason === null && !saved && (
        <p className="text-xs text-[var(--mut)]">Change the switch, then save.</p>
      )}
      {saved && !changed && (
        <p role="status" className="text-xs text-[var(--mut)]">Saved.</p>
      )}
      {save.isError && (
        <p role="alert" className="text-xs text-[var(--danger)]">
          We could not save that. Check your connection and try again.
        </p>
      )}
    </section>
  );
}
