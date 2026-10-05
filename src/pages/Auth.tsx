import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, MotionConfig, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Calendar, Camera, Check, ChevronDown, GraduationCap, Mail, Music, ShoppingBag, Sparkles, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityPicker } from "@/components/ui/city-picker";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { checkAccountExistsByEmail, getEmailLookupTransition } from "@/lib/auth-intent";
import { OTP_NO_ACCOUNT_NOTICE, callbackErrorCopy, isOtpSignupDisabledError } from "@/lib/auth-otp-routing";
import { sanitizeReturnTo } from "@/lib/authRouting";
import { signInWithDevBypass, DEV_AUTH_BYPASS_HINT, createRandomDevAccount } from "@/lib/devAuthBypass";
import MagicLinkConfirmation from "@/components/MagicLinkConfirmation";
import authLogo from "@/assets/bachata-calendar-logo-auth.png";
import { AuthFormProvider, useAuthForm, type EntryRole } from "@/contexts/AuthFormContext";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { flags } from "@/lib/featureFlags";
import { SIGNUP_STEPS, getNextStep, getPreviousStep, getStepIndex, type SignupStep } from "@/lib/auth-signup-resolver";

const ROLE_OPTIONS: { label: string; icon: typeof Sparkles; value: EntryRole; description: string }[] = [
  { label: "Dancer", icon: Sparkles, value: "dancer", description: "Find classes, partners, and events" },
  { label: "Organiser", icon: Calendar, value: "organiser", description: "Manage and promote your events" },
  { label: "Teacher", icon: GraduationCap, value: "teacher", description: "Reach students and share your schedule" },
  { label: "DJ", icon: Music, value: "dj", description: "Showcase mixes and get bookings" },
  { label: "Videographer", icon: Camera, value: "videographer", description: "Share your work and connect with organisers" },
  { label: "Vendor", icon: ShoppingBag, value: "vendor", description: "Sell products to the dance community" },
];

const DANCER_ROLE = ROLE_OPTIONS[0];
const OTHER_ROLES = ROLE_OPTIONS.slice(1);

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

type FieldErrors = {
  email?: string;
  firstName?: string;
  city?: string;
  role?: string;
  send?: string;
};

const SEND_ERROR_ID = "auth-send-error";

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <p id={id} role="alert" className="text-sm text-destructive">
      {message}
    </p>
  ) : null;

const invalidProps = (id: string, message?: string) =>
  message ? { "aria-invalid": true as const, "aria-describedby": id } : {};

const AuthContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formState, setFirstName, setCityId, setCityName, setRole, updateEmail } = useAuthForm();

  const explicitReturnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  // With organiser self-serve on, a sign-in with no destination lands on
  // /account (Lever 2 W1) instead of the homepage.
  const returnTo = explicitReturnTo || (flags.organiserSelfServe ? "/account" : "/");
  const userType = searchParams.get("userType");
  const mode = searchParams.get("mode") || "signup";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const callbackNotice = mode === "signin" ? callbackErrorCopy(searchParams.get("callbackError")) : null;
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const [stepDirection, setStepDirection] = useState(1);
  const [step2Touched, setStep2Touched] = useState(false);
  const [manualStep, setManualStep] = useState<SignupStep | null>(null);
  const [lastStep, setLastStep] = useState<SignupStep>(() => getNextStep(formState));

  const { email, firstName, cityId, cityName, role: selectedRole } = formState;

  const validRole = ROLE_OPTIONS.find((r) => r.value === userType)?.value;
  const selectedRoleValue = selectedRole && ROLE_OPTIONS.some((r) => r.value === selectedRole) ? selectedRole : null;

  // The role step shows Dancer pre-selected. The choice is only committed to
  // the form (and the URL) on Continue, so the pre-selection does not skip
  // the step the way a stored role would.
  const [roleDraft, setRoleDraft] = useState<EntryRole>(selectedRoleValue ?? "dancer");
  const [otherRolesOpen, setOtherRolesOpen] = useState(Boolean(selectedRoleValue && selectedRoleValue !== "dancer"));

  useEffect(() => {
    if (selectedRoleValue) {
      setRoleDraft(selectedRoleValue);
      if (selectedRoleValue !== "dancer") setOtherRolesOpen(true);
    }
  }, [selectedRoleValue]);

  useEffect(() => {
    if (validRole && validRole !== selectedRole) {
      setRole(validRole as EntryRole);
      localStorage.setItem("profile_entry_role", validRole as EntryRole);
    }
  }, [validRole, selectedRole, setRole]);

  useEffect(() => {
    trackAnalyticsEvent("auth_viewed", { mode: mode === "signin" ? "signin" : "signup", source: "auth_page" });
  }, [mode]);

  const autoStep = getNextStep(formState);
  const activeStep = manualStep ?? autoStep;
  const activeStepIndex = getStepIndex(activeStep);
  const progressPercent = mode === "signup" ? Math.round(((activeStepIndex + 1) / SIGNUP_STEPS.length) * 100) : 0;

  useEffect(() => {
    if (manualStep && manualStep === autoStep) {
      setManualStep(null);
    }
  }, [autoStep, manualStep]);

  useEffect(() => {
    if (activeStep === lastStep) return;
    const nextDir = getStepIndex(activeStep) > getStepIndex(lastStep) ? 1 : -1;
    setStepDirection(nextDir);
    setLastStep(activeStep);
  }, [activeStep, lastStep]);

  useEffect(() => {
    if (mode === "signin") {
      setAuthNotice(null);
    }
  }, [mode]);

  const signInAuthUrl = `/auth?mode=signin${explicitReturnTo ? `&returnTo=${encodeURIComponent(explicitReturnTo)}` : ""}`;
  const signUpAuthUrl = `/auth?mode=signup${explicitReturnTo ? `&returnTo=${encodeURIComponent(explicitReturnTo)}` : ""}${selectedRoleValue ? `&userType=${encodeURIComponent(selectedRoleValue)}` : ""}`;

  const normalizeEmail = (value: string) =>
    value
      .trim()
      .toLowerCase()
      .replace(/^mailto:/i, "")
      .replace(/^<+|>+$/g, "")
      .replace(/\s+/g, "");

  const isValidEmail = (value: string) =>
    /^[a-z0-9](?:[a-z0-9._%+-]{0,62}[a-z0-9])?@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i.test(
      value
    );

  const persistRoleSelection = (role: EntryRole) => {
    localStorage.setItem("profile_entry_role", role);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("userType", role);
    setSearchParams(nextParams, { replace: true });
  };

  const handleRoleContinue = () => {
    setRole(roleDraft);
    persistRoleSelection(roleDraft);
    setFieldErrors((prev) => ({ ...prev, role: undefined }));
    if (mode === "signup") {
      setManualStep(null);
    }
  };

  // Keeps every other query param (returnTo above all), so the sign-up that
  // follows still ends where the sign-in would have.
  const switchToSignup = (notice: string | null) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("mode", "signup");
    if (selectedRole) {
      nextParams.set("userType", selectedRole);
    }
    setSearchParams(nextParams, { replace: true });
    setStep2Touched(false);
    setManualStep("role");
    setAuthNotice(notice);
  };

  const clearEmailFeedback = () => {
    setFieldErrors((prev) => ({ ...prev, email: undefined, send: undefined }));
  };

  const handleSendMagicLink = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      setFieldErrors({ email: "Enter a valid email, like name@example.com." });
      return;
    }
    if (mode === "signup" && !selectedRole) {
      setFieldErrors({ role: "Choose a role to continue." });
      setManualStep("role");
      return;
    }
    if (mode === "signup" && (!firstName.trim() || !cityId)) {
      setStep2Touched(true);
      setFieldErrors({});
      setManualStep("details");
      return;
    }
    setFieldErrors({});
    const emailUpdate = updateEmail(normalizedEmail);
    if (emailUpdate.changed) {
      setMagicLinkSent(false);
      setAuthNotice(null);
    }
    if (mode === "signin") {
      const lookup = await checkAccountExistsByEmail(normalizedEmail);
      const transition = getEmailLookupTransition({
        lookup,
        currentIntent: "returning",
        fallbackIntent: "returning",
        source: "auth_page",
      });
      transition.analytics.forEach((event) => trackAnalyticsEvent(event.event, event.payload));
      if (transition.nextIntent === "new") {
        switchToSignup(transition.notice || null);
        return;
      }
    }
    const isCreateAccount = mode === "signup";
    if (isCreateAccount) {
      localStorage.setItem("pending_profile_role", selectedRole as EntryRole);
    } else {
      localStorage.removeItem("pending_profile_role");
    }
    setIsSubmitting(true);
    try {
      const callbackUrl = new URL("/auth/callback", window.location.origin);
      callbackUrl.searchParams.set("mode", isCreateAccount ? "signup" : "signin");
      if (explicitReturnTo) {
        callbackUrl.searchParams.set("returnTo", explicitReturnTo);
      }
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: isCreateAccount,
          emailRedirectTo: callbackUrl.toString(),
          data: isCreateAccount ? {
            user_type: selectedRole,
            first_name: firstName.trim(),
            city_id: cityId,
            city: cityName // Retain for debugging/analytics, but city_id is primary
          } : undefined,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      localStorage.setItem("auth_last_email", normalizedEmail);
      trackAnalyticsEvent("auth_viewed", { mode: isCreateAccount ? "signup" : "signin", source: "magic_link_sent" });
    } catch (error: any) {
      const isSignupDisabled = isOtpSignupDisabledError(error);
      // Sign-in for an email with no account. The pre-lookup above can't catch
      // it (account_exists_by_email is not anon-callable, so it answers
      // "unknown"), and this 422 is the first time we learn it. Move to
      // "Create account" with the email kept instead of a dead-end toast.
      if (isSignupDisabled && !isCreateAccount) {
        trackAnalyticsEvent("auth_auto_switched_to_signup", { source: "auth_page", reason: "email_not_found" });
        switchToSignup(OTP_NO_ACCOUNT_NOTICE);
        return;
      }
      setFieldErrors({
        send: isSignupDisabled
          ? "We can't create new accounts right now. If you already have an account, sign in instead."
          : "We couldn't send your email. Please try again in a moment.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // A verified code leaves a session behind, exactly as the emailed link does.
  // Hand over to /auth/callback so both routes share one post-login resolution
  // (returnTo, pending role, profile stub) instead of a second copy of it here.
  const handleCodeVerified = () => {
    const callbackUrl = new URLSearchParams({ mode: mode === "signup" ? "signup" : "signin" });
    if (explicitReturnTo) {
      callbackUrl.set("returnTo", explicitReturnTo);
    }
    navigate(`/auth/callback?${callbackUrl.toString()}`, { replace: true });
  };

  const handleDevQuickLogin = async (destination: string) => {
    setIsSubmitting(true);
    try {
      const { error } = await signInWithDevBypass();
      if (error) throw error;
      navigate(destination);
    } catch (error: any) {
      toast({ title: "Dev quick login unavailable", description: error?.message || DEV_AUTH_BYPASS_HINT, variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRandomDevAccount = async (destination: string, userTypeForAccount?: string) => {
    setIsSubmitting(true);
    try {
      const result = await createRandomDevAccount({
        userType: userTypeForAccount,
        firstName: firstName.trim() || "Dev",
        city: cityName || "London",
      });
      if (result.error) throw new Error(result.error.message);
      toast({ title: "Random test account created", description: `${result.email} / ${result.password}` });
      navigate(destination);
    } catch (error: any) {
      toast({ title: "Could not create random account", description: error?.message || "Please check dev auth settings.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4 bg-background">
        <div className="w-full max-w-md">
          <Card className="shadow-none">
            <CardContent className="pt-6">
              <MagicLinkConfirmation
                email={email}
                onResend={handleSendMagicLink}
                onChangeEmail={() => setMagicLinkSent(false)}
                onVerified={handleCodeVerified}
                extraAction={{ label: "Continue browsing", onClick: () => navigate(returnTo) }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stepLabelIndex = activeStepIndex + 1;
  const draftRoleLabel = ROLE_OPTIONS.find((role) => role.value === roleDraft)?.label ?? "Dancer";

  const primaryButtonClass = "w-full min-h-[44px] rounded-full font-semibold";
  const emailErrorId = "auth-email-error";
  const sendError = <FieldError id={SEND_ERROR_ID} message={fieldErrors.send} />;

  const devTools = (children: ReactNode) =>
    import.meta.env.DEV ? (
      <div className="space-y-2 rounded-lg border border-dashed border-border p-3">
        <p className="text-sm font-medium text-muted-foreground">Dev tools</p>
        {children}
      </div>
    ) : null;

  return (
    <GlobalLayout showSubheader={false}>
    <MotionConfig reducedMotion="user">
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 sm:pt-12 pb-24 px-4 bg-background">
      <div className="w-full max-w-md space-y-6">
        {/* Logo + Brand */}
        <div className="flex flex-col items-center gap-2">
          <img
            src={authLogo}
            alt="Bachata Calendar"
            loading="eager"
            fetchPriority="high"
            className="w-24 h-24 object-contain"
          />
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            {mode === "signin" ? "Welcome back" : "Join the community"}
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            {mode === "signin" ? "Sign in with a link or a code." : "Create your account in 3 easy steps."}
          </p>
        </div>

        {/* Tab toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-full bg-secondary p-1">
          <button
            type="button"
            aria-current={mode === "signin" ? "page" : undefined}
            className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              mode === "signin"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => navigate(signInAuthUrl)}
          >
            Sign in
          </button>
          <button
            type="button"
            aria-current={mode === "signup" ? "page" : undefined}
            className={`min-h-[44px] rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              mode === "signup"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => navigate(signUpAuthUrl)}
          >
            Create account
          </button>
        </div>

        {/* Progress bar for signup */}
        {mode === "signup" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Step {stepLabelIndex} of {SIGNUP_STEPS.length}</span>
              <span>{progressPercent}%</span>
            </div>
            <div
              className="h-1 w-full rounded-full bg-secondary overflow-hidden"
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              aria-label="Sign-up progress"
            >
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {callbackNotice && (
          <div
            role="alert"
            data-testid="auth-callback-notice"
            className="flex items-start gap-3 rounded-xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 text-amber-300" />
            <p>{callbackNotice}</p>
          </div>
        )}

        {authNotice && (
          <div role="status" className="flex items-start gap-3 rounded-xl border bg-secondary px-3 py-3 text-sm">
            <AlertCircle className="mt-0.5 h-4 w-4 text-primary" aria-hidden="true" />
            <div>
              <p className="font-medium">No account found</p>
              <p className="text-sm text-muted-foreground">{authNotice}</p>
            </div>
          </div>
        )}

        {mode === "signin" ? (
          /* --- SIGN IN --- */
          <Card className="shadow-none">
            <CardHeader className="space-y-1 p-3 pb-3">
              <CardTitle className="text-lg">Sign in</CardTitle>
              <p className="text-sm text-muted-foreground">Enter your email and we&rsquo;ll send you a link and a code.</p>
            </CardHeader>
            <CardContent className="space-y-3 p-3 pt-0">
              <div className="space-y-2">
                <Label htmlFor="signin-email" className="text-sm font-medium">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                  <Input
                    id="signin-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@example.com"
                    className="min-h-[44px] pl-10"
                    value={email}
                    {...invalidProps(emailErrorId, fieldErrors.email)}
                    onChange={(e) => {
                      const update = updateEmail(e.target.value);
                      clearEmailFeedback();
                      if (update.changed) {
                        setMagicLinkSent(false);
                        setAuthNotice(null);
                      }
                    }}
                  />
                </div>
                <FieldError id={emailErrorId} message={fieldErrors.email} />
              </div>
              <Button
                className={primaryButtonClass}
                onClick={handleSendMagicLink}
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending\u2026" : "Email me a sign-in link"}
              </Button>
              {sendError}
              <Button type="button" variant="ghost" className="w-full min-h-[44px] text-muted-foreground" onClick={() => navigate(signUpAuthUrl)}>
                New here? Create an account
              </Button>
              {devTools(
                <>
                  <Button variant="outline" className="w-full min-h-[44px]" onClick={() => void handleCreateRandomDevAccount(returnTo)} disabled={isSubmitting}>
                    Instant dev login (random account)
                  </Button>
                  <Button variant="ghost" className="w-full min-h-[44px] text-muted-foreground" onClick={() => void handleDevQuickLogin(returnTo)} disabled={isSubmitting}>
                    Dev login (env credentials)
                  </Button>
                </>
              )}
            </CardContent>
          </Card>
        ) : (
          /* --- SIGN UP WIZARD --- */
          <Card className="shadow-none overflow-hidden">
            <AnimatePresence mode="wait" custom={stepDirection}>
              {activeStep === "role" && (
                <motion.div
                  key="step1"
                  custom={stepDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <CardHeader className="space-y-1 p-3 pb-3">
                    <CardTitle className="text-lg">What brings you here?</CardTitle>
                    <p className="text-sm text-muted-foreground">You can always add more roles later.</p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3 pt-0">
                    {[DANCER_ROLE].map((role) => {
                      const Icon = role.icon;
                      const isActive = roleDraft === role.value;
                      return (
                        <button
                          key={role.value}
                          type="button"
                          className={`w-full min-h-[44px] text-left rounded-xl border px-3 py-3 transition-colors ${
                            isActive ? "border-primary bg-secondary" : "bg-card hover:bg-secondary"
                          }`}
                          aria-pressed={isActive}
                          onClick={() => setRoleDraft(role.value)}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center bg-secondary ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                              <Icon className="w-4 h-4" aria-hidden="true" />
                            </div>
                            <div className="flex-1">
                              <p className="font-medium text-sm">{role.label}</p>
                              <p className="text-sm text-muted-foreground">{role.description}</p>
                            </div>
                            {isActive && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                          </div>
                        </button>
                      );
                    })}

                    <button
                      type="button"
                      className="flex w-full min-h-[44px] items-center justify-between rounded-xl px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground"
                      aria-expanded={otherRolesOpen}
                      aria-controls="other-roles"
                      onClick={() => setOtherRolesOpen((open) => !open)}
                    >
                      <span>I&rsquo;m also an organiser / teacher / DJ / videographer / vendor</span>
                      <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${otherRolesOpen ? "rotate-180" : ""}`} aria-hidden="true" />
                    </button>

                    {otherRolesOpen && (
                      <div id="other-roles" className="space-y-2">
                        {OTHER_ROLES.map((role) => {
                          const Icon = role.icon;
                          const isActive = roleDraft === role.value;
                          return (
                            <button
                              key={role.value}
                              type="button"
                              className={`w-full min-h-[44px] text-left rounded-xl border px-3 py-3 transition-colors ${
                                isActive ? "border-primary bg-secondary" : "bg-card hover:bg-secondary"
                              }`}
                              aria-pressed={isActive}
                              onClick={() => setRoleDraft(isActive ? DANCER_ROLE.value : role.value)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center bg-secondary ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                                  <Icon className="w-4 h-4" aria-hidden="true" />
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{role.label}</p>
                                  <p className="text-sm text-muted-foreground">{role.description}</p>
                                </div>
                                {isActive && <Check className="h-4 w-4 text-primary" aria-hidden="true" />}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <FieldError id="auth-role-error" message={fieldErrors.role} />
                    <Button className={primaryButtonClass} onClick={handleRoleContinue}>
                      Continue as {draftRoleLabel}
                    </Button>
                  </CardContent>
                </motion.div>
              )}

              {activeStep === "details" && (
                <motion.div
                  key="step2"
                  custom={stepDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <CardHeader className="space-y-1 p-3 pb-3">
                    <CardTitle className="text-lg">A little about you</CardTitle>
                    <p className="text-sm text-muted-foreground">Just two things and we&rsquo;re done.</p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3 pt-0">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-sm font-medium">First name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        <Input
                          id="signup-firstname"
                          type="text"
                          autoComplete="given-name"
                          placeholder="Your first name"
                          className="min-h-[44px] pl-10"
                          value={firstName}
                          {...invalidProps("signup-firstname-error", step2Touched && !firstName.trim() ? "x" : undefined)}
                          onChange={(e) => {
                            setFirstName(e.target.value);
                            if (step2Touched) setStep2Touched(false);
                          }}
                        />
                      </div>
                      <FieldError id="signup-firstname-error" message={step2Touched && !firstName.trim() ? "First name is required." : undefined} />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">City</Label>
                      <div>
                        <CityPicker
                          value={cityId}
                          onChange={(id, obj) => {
                            setCityId(id);
                            setCityName(obj?.name || "");
                            if (step2Touched) setStep2Touched(false);
                          }}
                          placeholder="Select your city&hellip;"
                          className="min-h-[44px]"
                        />
                      </div>
                      <FieldError id="signup-city-error" message={step2Touched && !cityId ? "City is required." : undefined} />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" className="flex-1 min-h-[44px] rounded-full text-muted-foreground" onClick={() => setManualStep(getPreviousStep(activeStep))}>
                        <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" /> Back
                      </Button>
                      <Button
                        className="flex-1 min-h-[44px] rounded-full font-semibold"
                        onClick={() => {
                          setStep2Touched(true);
                          if (firstName.trim() && cityId) setManualStep(null);
                        }}
                      >
                        Continue
                      </Button>
                    </div>
                  </CardContent>
                </motion.div>
              )}

              {activeStep === "email" && (
                <motion.div
                  key="step3"
                  custom={stepDirection}
                  variants={slideVariants}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.25, ease: "easeInOut" }}
                >
                  <CardHeader className="space-y-1 p-3 pb-3">
                    <CardTitle className="text-lg">Last step &mdash; your email</CardTitle>
                    <p className="text-sm text-muted-foreground">We&rsquo;ll email you a link and a code to sign in.</p>
                  </CardHeader>
                  <CardContent className="space-y-3 p-3 pt-0">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-sm font-medium">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" aria-hidden="true" />
                        <Input
                          id="signup-email"
                          type="email"
                          autoComplete="email"
                          placeholder="you@example.com"
                          className="min-h-[44px] pl-10"
                          value={email}
                          {...invalidProps(emailErrorId, fieldErrors.email)}
                          onChange={(e) => {
                            const update = updateEmail(e.target.value);
                            clearEmailFeedback();
                            if (update.changed) {
                              setMagicLinkSent(false);
                              setAuthNotice(null);
                            }
                          }}
                        />
                      </div>
                      <FieldError id={emailErrorId} message={fieldErrors.email} />
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" className="flex-1 min-h-[44px] rounded-full text-muted-foreground" onClick={() => setManualStep(getPreviousStep(activeStep))}>
                        <ArrowLeft className="w-4 h-4 mr-1" aria-hidden="true" /> Back
                      </Button>
                      <Button
                        className="flex-1 min-h-[44px] rounded-full font-semibold"
                        onClick={handleSendMagicLink}
                        disabled={isSubmitting}
                      >
                        {isSubmitting ? "Sending\u2026" : "Email me a link"}
                      </Button>
                    </div>
                    {sendError}

                    {devTools(
                      <Button variant="outline" className="w-full min-h-[44px]" onClick={() => void handleCreateRandomDevAccount("/profile", selectedRoleValue || undefined)} disabled={isSubmitting}>
                        Instant dev login
                      </Button>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        )}

        <Button variant="ghost" className="w-full min-h-[44px] rounded-full text-muted-foreground" onClick={() => navigate(returnTo)}>
          Continue browsing
        </Button>
      </div>
    </div>
    </MotionConfig>
    </GlobalLayout>
  );
};

const Auth = () => (
  <AuthFormProvider>
    <AuthContent />
  </AuthFormProvider>
);

export default Auth;
