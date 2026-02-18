import { supabase } from "@/integrations/supabase/client";

export type EnsureDancerProfileParams = {
  userId: string;
  email?: string | null;
  firstName?: string | null;
  surname?: string | null;
  city?: string | null;
};

const normalizeText = (value?: string | null) => {
  const trimmed = (value || "").trim();
  return trimmed.length > 0 ? trimmed : null;
};

const inferFirstName = (email?: string | null) => {
  const normalizedEmail = normalizeText(email);
  if (!normalizedEmail) return "Member";
  const localPart = normalizedEmail.split("@")[0] || "";
  const cleaned = localPart.replace(/[^a-zA-Z0-9]+/g, " ").trim();
  const firstToken = cleaned.split(/\s+/)[0] || "Member";
  return firstToken.charAt(0).toUpperCase() + firstToken.slice(1);
};

export const ensureDancerProfile = async ({
  userId,
  email,
  firstName,
  surname,
  city,
}: EnsureDancerProfileParams) => {
  const safeFirstName = normalizeText(firstName) || inferFirstName(email);
  const safeSurname = normalizeText(surname);
  const safeCity = normalizeText(city);
  const safeEmail = normalizeText(email);

  try {
    const { data, error } = await (supabase as any).rpc("ensure_dancer_profile", {
      p_user_id: userId,
      p_email: safeEmail,
      p_first_name: safeFirstName,
      p_surname: safeSurname,
      p_city: safeCity,
    });

    if (!error && data) {
      return { dancerId: data as string, created: false };
    }
  } catch {
    // RPC may not be deployed in all environments yet; fallback below.
  }

  const { data: existing, error: existingError } = await supabase
    .from("dancers")
    .select("id, first_name, email, city")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const updatePayload: Record<string, unknown> = {};
    if (!normalizeText(existing.first_name)) updatePayload.first_name = safeFirstName;
    if (!normalizeText(existing.email) && safeEmail) updatePayload.email = safeEmail;
    if (!normalizeText(existing.city) && safeCity) updatePayload.city = safeCity;

    if (Object.keys(updatePayload).length > 0) {
      const { error: updateError } = await supabase
        .from("dancers")
        .update(updatePayload)
        .eq("id", existing.id);

      if (updateError) throw updateError;
    }

    return { dancerId: existing.id, created: false };
  }

  const insertPayload = {
    user_id: userId,
    first_name: safeFirstName,
    surname: safeSurname,
    email: safeEmail,
    city: safeCity,
    verified: false,
    is_public: false,
    hide_surname: false,
  };

  const { data: created, error: insertError } = await supabase
    .from("dancers")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError) throw insertError;

  return { dancerId: created.id, created: true };
};
