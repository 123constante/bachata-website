import { supabase } from "@/integrations/supabase/client";

export type EnsureDancerProfileParams = {
  userId: string;
  email?: string | null;
  firstName?: string | null;
  surname?: string | null;
  city?: string | null;
  cityId?: string | null;
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
  cityId,
}: EnsureDancerProfileParams) => {
  const safeFirstName = normalizeText(firstName) || inferFirstName(email);
  const safeSurname = normalizeText(surname);
  const safeCity = normalizeText(city);
  const safeEmail = normalizeText(email);
  const safeCityId = normalizeText(cityId);

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
    .select("id, first_name, city")
    .eq("user_id", userId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.id) {
    const updatePayload: Record<string, unknown> = {};
    if (!normalizeText(existing.first_name)) updatePayload.first_name = safeFirstName;
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

  if (!safeCity && !safeCityId) {
    throw new Error("City is required to create a profile");
  }

  let finalCityId = safeCityId;

  // If no ID provided but we have a name, try to resolve it
  if (!finalCityId && safeCity) {
    const { data: cityRow, error: cityError } = await supabase
      .from("cities")
      .select("id")
      .ilike("name", safeCity)
      .maybeSingle();

    if (cityError) {
      console.error("Error looking up city:", cityError);
      // We don't throw; we proceed to try insert with just name if possible, 
      // but likely it will fail DB constraint if city_id is creating issues.
      // However, if the DB enforces NOT NULL on city_id, we must have it.
    }
    
    if (cityRow?.id) {
      finalCityId = cityRow.id;
    }
  }

  // If we still don't have a finalCityId, we can't create a valid profile if key constraints exist.
  // But let's try to proceed as legacy fallback if needed.
  if (!finalCityId) {
     throw new Error(`City '${safeCity || "unknown"}' not found in supported cities list`);
  }

  const insertPayload = {
    user_id: userId,
    first_name: safeFirstName,
    surname: safeSurname,
    city: safeCity,
    city_id: finalCityId,
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
