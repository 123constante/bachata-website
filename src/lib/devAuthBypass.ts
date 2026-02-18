import { supabase } from "@/integrations/supabase/client";

export const DEV_AUTH_BYPASS_HINT =
  "Set VITE_DEV_AUTH_EMAIL and VITE_DEV_AUTH_PASSWORD in your local .env, or enable anonymous auth in Supabase for development.";

const getDevCreds = () => ({
  email: (import.meta.env.VITE_DEV_AUTH_EMAIL || "").trim(),
  password: import.meta.env.VITE_DEV_AUTH_PASSWORD || "",
});

const randomToken = () => Math.random().toString(36).slice(2, 8);

export const createRandomDevAccount = async (userType?: string) => {
  if (!import.meta.env.DEV) {
    return { error: new Error("Random dev account creation is available in development only.") };
  }

  const email = `dev-${Date.now()}-${randomToken()}@example.test`;
  const password = `Dev!${randomToken()}${randomToken()}`;

  const signUpResult = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        first_name: "Dev",
        surname: "Tester",
        ...(userType ? { user_type: userType } : {}),
      },
    },
  });

  if (signUpResult.error) {
    return { error: signUpResult.error };
  }

  if (signUpResult.data.session) {
    return { email, password };
  }

  const signInResult = await supabase.auth.signInWithPassword({ email, password });
  if (!signInResult.error) {
    return { email, password };
  }

  return {
    error: new Error(
      "Account created, but email confirmation is enabled in Supabase. Disable Confirm email in your dev project to auto-login random accounts."
    ),
    email,
    password,
  };
};

export const signInWithDevBypass = async () => {
  if (!import.meta.env.DEV) {
    return { error: new Error("Dev auth bypass is available in development only.") };
  }

  const failureReasons: string[] = [];

  const { email, password } = getDevCreds();

  if (email && password) {
    const passwordLoginResult = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (!passwordLoginResult.error) {
      return passwordLoginResult;
    }

    failureReasons.push(`configured credentials failed: ${passwordLoginResult.error.message}`);
  } else {
    failureReasons.push("configured credentials missing");
  }

  const anonymousLoginResult = await supabase.auth.signInAnonymously();
  if (!anonymousLoginResult.error) {
    return anonymousLoginResult;
  }

  failureReasons.push(`anonymous sign-in failed: ${anonymousLoginResult.error.message}`);

  const randomAccountResult = await createRandomDevAccount();
  if (!randomAccountResult.error) {
    return { error: null };
  }

  failureReasons.push(`random account failed: ${randomAccountResult.error.message}`);

  return {
    error: new Error(`${DEV_AUTH_BYPASS_HINT} Details: ${failureReasons.join(" | ")}`),
  };
};
