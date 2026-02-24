import { supabase } from "@/integrations/supabase/client";

export type AccountLookupResult = "existing" | "missing" | "unknown";
export type AuthLookupIntent = "returning" | "new";

type EmailLookupAnalyticsEvent =
  | { event: "auth_auto_switched_to_signup"; payload: { source?: string; reason: "email_not_found" } }
  | { event: "auth_email_lookup_routed"; payload: { source?: string; route: "returning" | "new" | "fallback" } };

type EmailLookupTransition = {
  nextIntent: AuthLookupIntent;
  notice: string | null;
  analytics: EmailLookupAnalyticsEvent[];
};

const NO_ACCOUNT_NOTICE = "No account found for that email. Let’s create one now.";

export const checkAccountExistsByEmail = async (email: string): Promise<AccountLookupResult> => {
  try {
    const { data, error } = await supabase.rpc("account_exists_by_email" as any, {
      p_email: email,
    });

    if (error) return "unknown";
    if (typeof data !== "boolean") return "unknown";
    return data ? "existing" : "missing";
  } catch {
    return "unknown";
  }
};

export const getEmailLookupTransition = (input: {
  lookup: AccountLookupResult;
  currentIntent: AuthLookupIntent | null;
  fallbackIntent: AuthLookupIntent;
  source?: string;
}): EmailLookupTransition => {
  const { lookup, currentIntent, fallbackIntent, source } = input;

  if (lookup === "existing") {
    return {
      nextIntent: "returning",
      notice: null,
      analytics: [
        { event: "auth_email_lookup_routed", payload: { source, route: "returning" } },
      ],
    };
  }

  if (lookup === "missing") {
    return {
      nextIntent: "new",
      notice: NO_ACCOUNT_NOTICE,
      analytics: [
        { event: "auth_auto_switched_to_signup", payload: { source, reason: "email_not_found" } },
        { event: "auth_email_lookup_routed", payload: { source, route: "new" } },
      ],
    };
  }

  const nextIntent = currentIntent ?? fallbackIntent;

  return {
    nextIntent,
    notice: null,
    analytics: [
      { event: "auth_email_lookup_routed", payload: { source, route: "fallback" } },
    ],
  };
};
