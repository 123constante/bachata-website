// my_dancer_contact_v1 is not in the generated types yet (admin 20261111200000).
import { rpcLoose } from "@/integrations/supabase/rpcLoose";

/**
 * The caller's OWN contact (email, phone, whatsapp, show_contact_publicly).
 *
 * Contact lockdown step 2 (admin PR #770). Step 3 revokes `authenticated`'s
 * column SELECT on dancer_profiles email / phone / whatsapp / created_by /
 * claimed_by / meta_data, after which naming any of them in a dancer_profiles
 * select fails the WHOLE read with 42501. The

 * own-row contact is read through this DEFINER RPC instead, which resolves the
 * row server side (`_my_dancer_profile_id_v1`, the same persona as
 * lib/myPersona) and takes no argument.
 *
 * NEVER THROWS. "Unavailable" is not "empty": a failed call, no row, or a row
 * for a different persona than the screen loaded all mean we do not know the
 * stored value, and a caller must then neither show a blank as if it were the
 * truth nor send it back on a save (see buildDashboardSectionPayload).
 */
export const MY_DANCER_CONTACT_RPC = "my_dancer_contact_v1";

export type MyDancerContact = {
  profile_id: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  show_contact_publicly: boolean;
};

export type MyDancerContactResult =
  | { status: "loaded"; contact: MyDancerContact }
  | { status: "unavailable" };

const textOrNull = (value: unknown): string | null => (typeof value === "string" ? value : null);

export const fetchMyDancerContact = async (profileId: string): Promise<MyDancerContactResult> => {
  try {
    const { data, error } = await rpcLoose(MY_DANCER_CONTACT_RPC);
    if (error) return { status: "unavailable" };
    // RETURNS TABLE: PostgREST answers an array, zero or one row.
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null | undefined;
    if (!row || typeof row !== "object" || row.profile_id !== profileId) return { status: "unavailable" };
    return {
      status: "loaded",
      contact: {
        profile_id: profileId,
        email: textOrNull(row.email),
        phone: textOrNull(row.phone),
        whatsapp: textOrNull(row.whatsapp),
        show_contact_publicly: row.show_contact_publicly === true,
      },
    };
  } catch {
    return { status: "unavailable" };
  }
};
