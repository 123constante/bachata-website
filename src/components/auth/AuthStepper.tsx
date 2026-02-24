import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, CheckCircle, Mail, MapPin, User } from "lucide-react";
import { motion, useAnimationControls } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { signInWithDevBypass, DEV_AUTH_BYPASS_HINT, createRandomDevAccount } from "@/lib/devAuthBypass";
import { checkAccountExistsByEmail, getEmailLookupTransition } from "@/lib/auth-intent";
import { getAuthStepperStage } from "@/lib/auth-signup-resolver";
import { useAuthForm, type EntryRole } from "@/contexts/AuthFormContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { CityPicker } from "@/components/ui/city-picker";

type AuthIntent = "returning" | "new";

type AuthStepperProps = {
  userType?: string;
  returnTo?: string;
  onAuthenticated?: () => void;
  initialIntent?: AuthIntent;
  showIntentSelect?: boolean;
  title?: string;
  subtitle?: string;
  prefilledEmail?: string;
  skipEmailStepWhenPrefilled?: boolean;
  requireSignupDetails?: boolean;
};

const emailPattern = /\S+@\S+\.\S+/;
const OTP_RESEND_COOLDOWN_SECONDS = 30;
const SIGNUPS_DISABLED_HINT = "Signups are disabled for OTP. Contact support or use an existing account.";

export const AuthStepper = ({
  userType,
  returnTo,
  onAuthenticated,
  initialIntent,
  showIntentSelect = true,
  title,
  subtitle,
  prefilledEmail,
  skipEmailStepWhenPrefilled = false,
  requireSignupDetails = true,
}: AuthStepperProps) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { formState, setFirstName, setSurname, setCityId, setCityName, setOtpCode, setRole, updateEmail } = useAuthForm();
  const [intent, setIntent] = useState<AuthIntent | null>(initialIntent || (showIntentSelect ? null : "returning"));
  const rememberedEmail = (() => {
    try {
      return localStorage.getItem("auth_last_email") || "";
    } catch {
      return "";
    }
  })();
  const normalizedPrefilledEmail = (prefilledEmail || rememberedEmail || "").trim();
  const canSkipEmailStep = skipEmailStepWhenPrefilled && emailPattern.test((formState.email || normalizedPrefilledEmail).trim());
  const [emailConfirmed, setEmailConfirmed] = useState(false);
  const [isCodeSent, setIsCodeSent] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [flowNotice, setFlowNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{
    email?: string;
    code?: string;
    firstName?: string;
    city?: string;
  }>({});
  const shakeControls = useAnimationControls();
  const { email, firstName, surname, cityId, cityName, otpCode } = formState;

  const totalSteps = intent === "new" ? 3 : 2;
  const derivedStage = intent
    ? getAuthStepperStage({
        formState,
        intent,
        emailConfirmed,
        otpSent: isCodeSent,
        skipEmailStep: canSkipEmailStep,
        requireSignupDetails,
      })
    : "intent";
  const currentStepIndex = useMemo(() => {
    if (derivedStage === "email") return 1;
    if (derivedStage === "name") return 2;
    if (derivedStage === "code") return intent === "new" ? 3 : 2;
    return 0;
  }, [intent, derivedStage]);
  const progressValue = intent ? Math.round((currentStepIndex / totalSteps) * 100) : 0;

  const resolvedReturnTo = returnTo || "/";

  useEffect(() => {
    if (!normalizedPrefilledEmail) return;
    if (!email.trim()) {
      updateEmail(normalizedPrefilledEmail);
    }
  }, [normalizedPrefilledEmail]);

  useEffect(() => {
    if (!userType) return;
    setRole(userType as EntryRole);
  }, [setRole, userType]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const triggerValidationFeedback = () => {
    void shakeControls.start({
      x: [0, -8, 8, -6, 6, -3, 3, 0],
      transition: { duration: 0.35, ease: "easeOut" },
    });
  };

  const handleAuthSuccess = async () => {
    const { data } = await supabase.auth.getSession();
    const session = data.session;
    if (!session?.user) return;

    const currentType = session.user.user_metadata?.user_type;
    if (userType && currentType !== userType) {
      await supabase.auth.updateUser({
        data: {
          user_type: userType,
        },
      });
    }

    if (onAuthenticated) {
      onAuthenticated();
      return;
    }

    if (intent === "new" && userType) {
      navigate("/profile");
      return;
    }

    navigate(resolvedReturnTo);
  };

  const handleEmailNext = async () => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!emailPattern.test(normalizedEmail)) {
      trackAnalyticsEvent("auth_email_checked", { source: "auth_stepper", result: "invalid" });
      setFieldErrors((prev) => ({
        ...prev,
        email: "Use an email like name@example.com.",
      }));
      triggerValidationFeedback();
      return;
    }

    trackAnalyticsEvent("auth_email_checked", { source: "auth_stepper", result: "valid" });

    updateEmail(normalizedEmail);
    setEmailConfirmed(false);
    try {
      localStorage.setItem("auth_last_email", normalizedEmail);
    } catch {
      // Ignore localStorage errors
    }
    setFieldErrors((prev) => ({ ...prev, email: undefined }));

    setIsCheckingEmail(true);
    const lookup = await checkAccountExistsByEmail(normalizedEmail);
    setIsCheckingEmail(false);

    const transition = getEmailLookupTransition({
      lookup,
      currentIntent: intent,
      fallbackIntent: "returning",
      source: "auth_stepper",
    });

    setIntent(transition.nextIntent);
    setFlowNotice(transition.notice);
    setEmailConfirmed(true);
    transition.analytics.forEach((event) => trackAnalyticsEvent(event.event, event.payload));
  };

  const handleSendCode = async () => {
    trackAnalyticsEvent("auth_code_send_clicked", {
      source: "auth_stepper",
      route: intent || "unknown",
    });

    if (!emailPattern.test(email)) {
      setFieldErrors((prev) => ({
        ...prev,
        email: "Use an email like name@example.com.",
      }));
      triggerValidationFeedback();
      return;
    }

    if (intent === "new" && requireSignupDetails && !firstName.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        firstName: "First name is required.",
      }));
      triggerValidationFeedback();
      return;
    }

    if (intent === "new" && requireSignupDetails && !cityId.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        city: "City is required.",
      }));
      triggerValidationFeedback();
      return;
    }

    setIsLoading(true);
    try {
      const redirectUrl = `${window.location.origin}/auth/callback?returnTo=${encodeURIComponent(resolvedReturnTo)}`;
      const trimmedFirstName = firstName.trim();
      const trimmedSurname = surname.trim();
      const shouldCreateUser = intent === "new";

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser,
          emailRedirectTo: redirectUrl,
          data: {
            ...(intent === "new" && requireSignupDetails ? { first_name: trimmedFirstName } : {}),
            ...(intent === "new" && requireSignupDetails ? { surname: trimmedSurname || null } : {}),
            ...(intent === "new" && requireSignupDetails ? { city: cityName.trim() } : {}),
            ...(userType ? { user_type: userType } : {}),
          },
        },
      });

      if (error) throw error;

      setIsCodeSent(true);
      setResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      toast({
        title: "Code sent",
        description: "Check your email for the short verification code.",
      });
    } catch (error: any) {
      const message = String(error?.message || "");
      const isSignupDisabled = message.toLowerCase().includes("signups not allowed") || message.toLowerCase().includes("signup not allowed");
      toast({
        title: "Unable to send code",
        description: isSignupDisabled ? SIGNUPS_DISABLED_HINT : "We could not send the code. Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyCode = async () => {
    if (!otpCode.trim()) {
      setFieldErrors((prev) => ({
        ...prev,
        code: "Enter the code from your email.",
      }));
      triggerValidationFeedback();
      return;
    }
    setFieldErrors((prev) => ({ ...prev, code: undefined }));

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: otpCode.trim(),
        type: "email",
      });

      if (error) throw error;

      trackAnalyticsEvent("auth_code_verified", {
        source: "auth_stepper",
        route: intent || "unknown",
      });

      toast({
        title: "Welcome",
        description: "You are in.",
      });
      await handleAuthSuccess();
    } catch (error: any) {
      const message = String(error?.message || "").toLowerCase();
      const isInvalid = message.includes("invalid") || message.includes("expired");
      toast({
        title: "Invalid code",
        description: isInvalid ? "That code is invalid or expired. Request a new one." : "We could not verify that code. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDevQuickLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await signInWithDevBypass();
      if (error) throw error;
      await handleAuthSuccess();
    } catch (error: any) {
      toast({
        title: "Dev quick login unavailable",
        description: error?.message || DEV_AUTH_BYPASS_HINT,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateRandomDevAccount = async () => {
    setIsLoading(true);
    try {
      const result = await createRandomDevAccount({
        userType,
        firstName: requireSignupDetails ? (firstName.trim() || "Dev") : "Dev",
        surname: requireSignupDetails ? (surname.trim() || "Tester") : "Tester",
        city: requireSignupDetails ? (cityName.trim() || "London") : "London",
      });
      if (result.error) {
        throw new Error(`${result.error.message}${result.email ? ` | ${result.email}` : ""}${result.password ? ` | ${result.password}` : ""}`);
      }

      toast({
        title: "Random test account created",
        description: `${result.email} / ${result.password}`,
      });
      await handleAuthSuccess();
    } catch (error: any) {
      toast({
        title: "Could not create random account",
        description: error?.message || DEV_AUTH_BYPASS_HINT,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleMockFillSignup = () => {
    const mockNames = ["Maria", "Leo", "Sofia", "Alex", "Nina", "Rafa"];
    const selectedName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const mockEmail = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;

    setIntent("new");
    updateEmail(mockEmail);
    setFirstName(selectedName);
    setSurname("Tester");
    setCityId("London");
    setCityName("London");
    setOtpCode("");
    setIsCodeSent(false);
    setResendCooldown(0);
    setEmailConfirmed(true);

    toast({
      title: "Mock data filled",
      description: "Signup fields were populated with test values.",
    });
  };

  return (
    <motion.div className="space-y-5" animate={shakeControls} initial={false}>
      <div className="text-center space-y-2">
        {title && <h3 className="text-xl font-semibold">{title}</h3>}
        {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
        {flowNotice && (
          <div className="mt-2 flex items-start gap-2 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-100">
            <AlertCircle className="mt-0.5 h-4 w-4 text-emerald-300" />
            <span>{flowNotice}</span>
          </div>
        )}
        {import.meta.env.DEV && (
          <div className="flex gap-2 justify-center">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/20 text-xs"
              onClick={handleMockFillSignup}
            >
              🎲 Mock fill
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/20 text-xs"
              onClick={() => void handleCreateRandomDevAccount()}
              disabled={isLoading}
            >
              ⚡ Instant login
            </Button>
          </div>
        )}
      </div>

      {intent && showIntentSelect && (
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Step {currentStepIndex} of {totalSteps}</span>
            <span>{intent === "new" ? "Fresh start" : "Welcome back"}</span>
          </div>
          <Progress value={progressValue} />
        </div>
      )}

      {derivedStage === "intent" && showIntentSelect && (
        <div className="grid gap-1.5 rounded-xl border border-border/60 bg-muted/40 p-1">
          <Button
            type="button"
            className="w-full h-9 text-xs"
            onClick={() => {
              setIntent("returning");
              setEmailConfirmed(false);
            }}
          >
            I already have an account
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="w-full h-9 text-xs"
            onClick={() => {
              setIntent("new");
              setEmailConfirmed(false);
            }}
          >
            I need an account
          </Button>
        </div>
      )}

      {derivedStage === "email" && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className={fieldErrors.email ? "text-destructive" : undefined}>Email</Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="email"
                className="pl-10"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => {
                  const update = updateEmail(event.target.value);
                  setIsCodeSent(false);
                  setOtpCode("");
                  setResendCooldown(0);
                  setEmailConfirmed(false);
                  if (update.changed) setFlowNotice(null);
                  if (fieldErrors.email) {
                    setFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }
                }}
              />
            </div>
            {fieldErrors.email ? (
              <p className="text-xs text-destructive">{fieldErrors.email}</p>
            ) : (
              <p className="text-xs text-muted-foreground">We’ll use this to continue securely.</p>
            )}
          </div>
          <Button type="button" className="w-full h-9 text-xs" onClick={() => void handleEmailNext()} disabled={isCheckingEmail}>
            {isCheckingEmail ? "Checking account..." : "Continue"}
          </Button>
        </div>
      )}

      {derivedStage === "name" && intent === "new" && requireSignupDetails && (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label className={fieldErrors.firstName ? "text-destructive" : undefined}>First name</Label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="text"
                className="pl-10"
                placeholder="Your first name"
                value={firstName}
                onChange={(event) => {
                  setFirstName(event.target.value);
                  if (fieldErrors.firstName) {
                    setFieldErrors((prev) => ({ ...prev, firstName: undefined }));
                  }
                }}
              />
            </div>
            {fieldErrors.firstName && (
              <p className="text-xs text-destructive">{fieldErrors.firstName}</p>
            )}
          </div>
          <div className="space-y-2">
            <Label>Surname (optional)</Label>
            <Input
              type="text"
              placeholder="Your surname"
              value={surname}
              onChange={(event) => setSurname(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label className={fieldErrors.city ? "text-destructive" : undefined}>
              <span className="flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5" />
                Your city
              </span>
            </Label>
            <CityPicker
              value={cityId}
              onChange={(val, cityOption) => {
                setCityId(val);
                setCityName(cityOption?.name || "");
                if (fieldErrors.city) {
                  setFieldErrors((prev) => ({ ...prev, city: undefined }));
                }
              }}
              placeholder="Select your city..."
            />
            {fieldErrors.city && (
              <p className="text-xs text-destructive">{fieldErrors.city}</p>
            )}
          </div>
          <Button
            type="button"
            className="w-full h-9 text-xs"
            onClick={() => {
              if (!firstName.trim()) {
                setFieldErrors((prev) => ({
                  ...prev,
                  firstName: "First name is required.",
                }));
                triggerValidationFeedback();
                return;
              }
              if (!cityId.trim()) {
                setFieldErrors((prev) => ({
                  ...prev,
                  city: "City is required.",
                }));
                triggerValidationFeedback();
                return;
              }
              setFieldErrors((prev) => ({ ...prev, firstName: undefined, city: undefined }));
              setEmailConfirmed(true);
            }}
          >
            Continue
          </Button>
        </div>
      )}

      {derivedStage === "code" && intent && (
        <div className="space-y-4">
          {!isCodeSent ? (
            <Button type="button" className="w-full h-9 text-xs" onClick={handleSendCode} disabled={isLoading}>
              {isLoading ? "Sending code..." : "Send code"}
            </Button>
          ) : (
            <>
              <div className="space-y-2">
                <Label className={fieldErrors.code ? "text-destructive" : undefined}>Email code</Label>
                <Input
                  type="text"
                  placeholder="Enter code"
                  value={otpCode}
                  onChange={(event) => {
                    setOtpCode(event.target.value);
                    if (fieldErrors.code) {
                      setFieldErrors((prev) => ({ ...prev, code: undefined }));
                    }
                  }}
                />
                {fieldErrors.code && (
                  <p className="text-xs text-destructive">{fieldErrors.code}</p>
                )}
              </div>

              <Button type="button" className="w-full h-9 text-xs" onClick={handleVerifyCode} disabled={isLoading}>
                {isLoading ? "Verifying..." : "Verify code"}
              </Button>

              <Button type="button" variant="ghost" className="w-full" onClick={handleSendCode} disabled={isLoading || resendCooldown > 0}>
                {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : "Resend code"}
              </Button>
            </>
          )}

          <Button
            type="button"
            variant="ghost"
            className="w-full"
            onClick={() => {
              trackAnalyticsEvent("auth_change_email_clicked", { source: "auth_stepper" });
              setOtpCode("");
              setIsCodeSent(false);
              setResendCooldown(0);
              setEmailConfirmed(false);
            }}
          >
            Use different email
          </Button>

          {import.meta.env.DEV && (
            <div className="space-y-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
              <p className="text-xs font-semibold text-yellow-300">🛠 Dev Tools</p>
              <Button
                type="button"
                variant="outline"
                className="w-full border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/20"
                onClick={() => void handleCreateRandomDevAccount()}
                disabled={isLoading}
              >
                {isLoading ? "Creating account..." : "⚡ Instant Dev Login (random account)"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full text-xs text-yellow-300/70 hover:text-yellow-200"
                onClick={() => void handleDevQuickLogin()}
                disabled={isLoading}
              >
                Dev login (env credentials)
              </Button>
            </div>
          )}

          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            You are moments away from your profile.
          </div>
        </div>
      )}
    </motion.div>
  );
};
