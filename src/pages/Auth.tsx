import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Calendar, Camera, Check, GraduationCap, Mail, MapPin, Music, ShoppingBag, Sparkles, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityPicker } from "@/components/ui/city-picker";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { checkAccountExistsByEmail, getEmailLookupTransition } from "@/lib/auth-intent";
import { signInWithDevBypass, DEV_AUTH_BYPASS_HINT, createRandomDevAccount } from "@/lib/devAuthBypass";
import MagicLinkConfirmation from "@/components/MagicLinkConfirmation";
import authLogo from "@/assets/bachata-calendar-logo-auth.png";
import { AuthFormProvider, useAuthForm, type EntryRole } from "@/contexts/AuthFormContext";
import { SIGNUP_STEPS, getNextStep, getPreviousStep, getStepIndex, type SignupStep } from "@/lib/auth-signup-resolver";

const ROLE_OPTIONS: { label: string; icon: typeof Sparkles; value: EntryRole; description: string }[] = [
  { label: "Dancer", icon: Sparkles, value: "dancer", description: "Find classes, partners, and events" },
  { label: "Organiser", icon: Calendar, value: "organiser", description: "Manage and promote your events" },
  { label: "Teacher", icon: GraduationCap, value: "teacher", description: "Reach students and share your schedule" },
  { label: "DJ", icon: Music, value: "dj", description: "Showcase mixes and get bookings" },
  { label: "Videographer", icon: Camera, value: "videographer", description: "Share your work and connect with organisers" },
  { label: "Vendor", icon: ShoppingBag, value: "vendor", description: "Sell products to the dance community" },
];

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 80 : -80, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (dir: number) => ({ x: dir > 0 ? -80 : 80, opacity: 0 }),
};

const AuthContent = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const { formState, setFirstName, setCityId, setCityName, setRole, updateEmail } = useAuthForm();
  const sanitizeReturnTo = (value: string | null) => {
    if (!value) return null;
    const trimmed = value.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null;
    if (trimmed === "/auth" || trimmed.startsWith("/auth/")) return null;
    return trimmed;
  };

  const explicitReturnTo = sanitizeReturnTo(searchParams.get("returnTo"));
  const returnTo = explicitReturnTo || "/";
  const userType = searchParams.get("userType");
  const mode = searchParams.get("mode") || "signup";

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isExitOpen, setIsExitOpen] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);

  const [stepDirection, setStepDirection] = useState(1);
  const [step2Touched, setStep2Touched] = useState(false);
  const [manualStep, setManualStep] = useState<SignupStep | null>(null);
  const [lastStep, setLastStep] = useState<SignupStep>(() => getNextStep(formState));

  const { email, firstName, cityId, cityName, role: selectedRole } = formState;

  const validRole = ROLE_OPTIONS.find((r) => r.value === userType)?.value;
  const selectedRoleValue = selectedRole && ROLE_OPTIONS.some((r) => r.value === selectedRole) ? selectedRole : null;

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

  const goToStep = (step: number) => {
    setStepDirection(step > signupStep ? 1 : -1);
    setSignupStep(step);
  };

  const persistRoleSelection = (role: EntryRole) => {
    localStorage.setItem("profile_entry_role", role);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("userType", role);
    setSearchParams(nextParams, { replace: true });
  };

  const handleRoleSelect = (role: EntryRole) => {
    setRole(role);
    persistRoleSelection(role);
    if (mode === "signup") {
      setManualStep(null);
    }
  };

  const handleSendMagicLink = async () => {
    const normalizedEmail = normalizeEmail(email);
    if (!isValidEmail(normalizedEmail)) {
      toast({ title: "Enter a valid email", description: "Use an email like name@example.com.", variant: "destructive" });
      return;
    }
    if (mode === "signup" && !firstName.trim()) {
      toast({ title: "Enter your first name", variant: "destructive" });
      return;
    }
    if (mode === "signup" && !cityId) {
      toast({ title: "Select your city", variant: "destructive" });
      return;
    }
    if (mode === "signup" && !selectedRole) {
      toast({ title: "Choose a role", description: "Pick a role to continue.", variant: "destructive" });
      return;
    }
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
        const nextParams = new URLSearchParams(searchParams);
        nextParams.set("mode", "signup");
        if (selectedRole) {
          nextParams.set("userType", selectedRole);
        }
        setSearchParams(nextParams, { replace: true });
        setStep2Touched(false);
        setManualStep("role");
        setAuthNotice(transition.notice || null);
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
      const message = String(error?.message || "").toLowerCase();
      const isSignupDisabled = message.includes("signups not allowed") || message.includes("signup not allowed");
      toast({
        title: "Unable to send link",
        description: isSignupDisabled
          ? "Signups are disabled for OTP. Contact support or use an existing account."
          : "We could not send the link. Please try again in a moment.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
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
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: "linear-gradient(135deg, #0a1a14 0%, #0d1f17 50%, #0a1a14 100%)" }}>
        <div className="pointer-events-none absolute top-1/4 -left-20 w-80 h-80 rounded-full bg-emerald-500/15 blur-[120px]" />
        <div className="pointer-events-none absolute bottom-1/4 -right-20 w-72 h-72 rounded-full bg-amber-400/10 blur-[100px]" />
        <div className="w-full max-w-md relative z-10">
          <Card className="border-emerald-500/20 bg-[rgba(16,42,32,0.85)] backdrop-blur-2xl shadow-[0_30px_80px_rgba(16,185,129,0.12)]">
            <CardContent className="pt-6">
              <MagicLinkConfirmation
                email={email}
                onResend={handleSendMagicLink}
                onChangeEmail={() => setMagicLinkSent(false)}
                extraAction={{ label: 'Continue browsing', onClick: () => navigate(returnTo) }}
              />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const stepLabelIndex = activeStepIndex + 1;

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-start pt-8 sm:pt-12 pb-24 px-4 relative overflow-hidden"
      style={{ background: "linear-gradient(135deg, #0a1a14 0%, #0d1f17 50%, #0a1a14 100%)" }}
    >
      {/* Ambient glow orbs — emerald & gold */}
      <div className="pointer-events-none absolute top-[-10%] left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-emerald-500/8 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-5%] right-[-10%] h-[400px] w-[400px] rounded-full bg-amber-400/6 blur-[100px]" />
      <div className="pointer-events-none absolute top-[60%] left-[-8%] h-[300px] w-[300px] rounded-full bg-emerald-600/5 blur-[120px]" />

      <div className="w-full max-w-md space-y-6 relative z-10">
        {/* Logo + Brand */}
        <motion.div
          className="flex flex-col items-center gap-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <img
            src={authLogo}
            alt="Bachata Calendar"
            className="w-24 h-24 object-contain drop-shadow-[0_0_30px_rgba(52,211,153,0.4)]"
          />
          <h1
            className="text-xl font-bold tracking-tight bg-clip-text text-transparent"
            style={{ backgroundImage: "linear-gradient(135deg, #34d399, #fbbf24)" }}
          >
            {mode === "signin" ? "Welcome back" : "Join the community"}
          </h1>
          <p className="text-sm text-emerald-200/50 text-center">
            {mode === "signin" ? "Sign in with a magic link." : "Create your account in 3 easy steps."}
          </p>
        </motion.div>

        {/* Tab toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-full border border-emerald-500/20 bg-[rgba(16,42,32,0.6)] p-1 backdrop-blur-xl">
          <button
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              mode === "signin"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-[0_4px_20px_rgba(16,185,129,0.35)]"
                : "text-emerald-200/50 hover:text-emerald-100/80"
            }`}
            onClick={() => navigate(signInAuthUrl)}
          >
            Sign in
          </button>
          <button
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              mode === "signup"
                ? "bg-gradient-to-r from-emerald-500 to-emerald-400 text-white shadow-[0_4px_20px_rgba(16,185,129,0.35)]"
                : "text-emerald-200/50 hover:text-emerald-100/80"
            }`}
            onClick={() => navigate(signUpAuthUrl)}
          >
            Create account
          </button>
        </div>

        {/* Progress bar for signup */}
        {mode === "signup" && (
          <motion.div
            className="space-y-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <div className="flex items-center justify-between text-xs text-emerald-200/50">
              <span>Step {stepLabelIndex} of {SIGNUP_STEPS.length}</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-emerald-900/40 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              />
            </div>
          </motion.div>
        )}

        {authNotice && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-start gap-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-100"
          >
            <AlertCircle className="mt-0.5 h-4 w-4 text-emerald-300" />
            <div>
              <p className="font-medium">No account found</p>
              <p className="text-xs text-emerald-200/70">{authNotice}</p>
            </div>
          </motion.div>
        )}

        {mode === "signin" ? (
          /* ─── SIGN IN ─── */
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
          >
            <Card className="border-emerald-500/20 bg-[rgba(16,42,32,0.85)] backdrop-blur-2xl shadow-[0_24px_60px_rgba(16,185,129,0.08)]">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-lg text-white">Sign in</CardTitle>
                <p className="text-sm text-emerald-200/50">Enter your email and we'll send you a magic link.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-xs font-medium text-emerald-300/60 uppercase tracking-wider">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/40" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 bg-emerald-950/40 border-emerald-500/20 text-white placeholder:text-emerald-200/30 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40 transition-all"
                      value={email}
                      onChange={(e) => {
                        const update = updateEmail(e.target.value);
                        if (update.changed) {
                          setMagicLinkSent(false);
                          setAuthNotice(null);
                        }
                      }}
                    />
                  </div>
                </div>
                <Button
                  className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 text-white font-semibold shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  onClick={handleSendMagicLink}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending…" : "Send magic link"}
                </Button>
                <button type="button" className="w-full text-xs text-emerald-200/40 hover:text-emerald-100/70 transition-colors" onClick={() => navigate(signUpAuthUrl)}>
                  New here? Create an account
                </button>
                {import.meta.env.DEV && (
                  <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <p className="text-xs font-semibold text-yellow-300/80">🛠 Dev Tools</p>
                    <Button variant="outline" className="w-full border-yellow-500/30 text-yellow-200/80 hover:bg-yellow-500/10" onClick={() => void handleCreateRandomDevAccount(returnTo)} disabled={isSubmitting}>
                      ⚡ Instant Dev Login (random account)
                    </Button>
                    <Button variant="ghost" className="w-full text-xs text-yellow-300/50 hover:text-yellow-200/70" onClick={() => void handleDevQuickLogin(returnTo)} disabled={isSubmitting}>
                      Dev login (env credentials)
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        ) : (
          /* ─── SIGN UP WIZARD ─── */
          <Card className="border-emerald-500/20 bg-[rgba(16,42,32,0.85)] backdrop-blur-2xl shadow-[0_24px_60px_rgba(16,185,129,0.08)] overflow-hidden">
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
                  <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-lg text-white">What brings you here?</CardTitle>
                    <p className="text-sm text-emerald-200/50">You can always add more roles later.</p>
                  </CardHeader>
                  <CardContent className="space-y-3 pb-6">
                    <div className="space-y-2">
                      {ROLE_OPTIONS.map((role) => {
                        const Icon = role.icon;
                        const isActive = selectedRole === role.value;
                        return (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            key={role.value}
                            type="button"
                            className={`w-full text-left rounded-xl border px-4 py-3 transition-all duration-200 ${
                              isActive
                                ? "border-emerald-500/50 bg-emerald-500/10 shadow-[0_0_20px_rgba(16,185,129,0.12)]"
                                : "border-emerald-500/10 bg-emerald-950/30 hover:border-emerald-500/25 hover:bg-emerald-950/50"
                            }`}
                            aria-pressed={isActive}
                            onClick={() => handleRoleSelect(role.value)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                                isActive
                                  ? "bg-emerald-500/20 text-emerald-400"
                                  : "bg-emerald-900/30 text-emerald-300/40"
                              }`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div className="flex-1">
                                <p className="font-medium text-sm text-white">{role.label}</p>
                                <p className="text-xs text-emerald-200/40">{role.description}</p>
                              </div>
                              {isActive && (
                                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-2 py-1 text-[10px] font-semibold text-emerald-200">
                                  <Check className="h-3 w-3" />
                                  Selected
                                </span>
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    <Button
                      className="w-full rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 text-white font-semibold shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                      disabled={!selectedRoleValue}
                      onClick={() => setManualStep(null)}
                    >
                      {selectedRoleValue
                        ? `Continue as ${ROLE_OPTIONS.find((role) => role.value === selectedRoleValue)?.label ?? "Selected role"}`
                        : "Choose a role to continue"}
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
                  <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-lg text-white">A little about you</CardTitle>
                    <p className="text-sm text-emerald-200/50">Just two things and we're done.</p>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-6">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-xs font-medium text-emerald-300/60 uppercase tracking-wider">First name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/40" />
                        <Input
                          id="signup-firstname"
                          type="text"
                          placeholder="Your first name"
                          className="pl-10 bg-emerald-950/40 border-emerald-500/20 text-white placeholder:text-emerald-200/30 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40 transition-all"
                          value={firstName}
                          onChange={(e) => {
                            setFirstName(e.target.value);
                            if (step2Touched) setStep2Touched(false);
                          }}
                        />
                      </div>
                      {step2Touched && !firstName.trim() && (
                        <p className="text-xs text-red-400">First name is required.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-emerald-300/60 uppercase tracking-wider">City</Label>
                      <CityPicker 
                        value={cityId} 
                        onChange={(id, obj) => {
                          setCityId(id);
                          setCityName(obj?.name || "");
                          if (step2Touched) setStep2Touched(false);
                        }} 
                        placeholder="Select your city…" className="bg-emerald-950/40 border-emerald-500/20 text-white placeholder:text-emerald-200/30" 
                      />
                      {step2Touched && !cityId && (
                        <p className="text-xs text-red-400">City is required.</p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" className="flex-1 rounded-full text-emerald-200/60 hover:text-emerald-100 hover:bg-emerald-500/10" onClick={() => setManualStep(getPreviousStep(activeStep))}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button
                        className="flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 text-white font-semibold shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        disabled={!firstName.trim() || !cityId}
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
                  <CardHeader className="space-y-1 pb-3">
                    <CardTitle className="text-lg text-white">Last step — your email</CardTitle>
                    <p className="text-sm text-emerald-200/50">We'll send you a magic link to sign in.</p>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-6">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-xs font-medium text-emerald-300/60 uppercase tracking-wider">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-emerald-400/40" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10 bg-emerald-950/40 border-emerald-500/20 text-white placeholder:text-emerald-200/30 focus-visible:ring-emerald-500/40 focus-visible:border-emerald-500/40 transition-all"
                          value={email}
                          onChange={(e) => {
                            const update = updateEmail(e.target.value);
                            if (update.changed) {
                              setMagicLinkSent(false);
                              setAuthNotice(null);
                            }
                          }}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" className="flex-1 rounded-full text-emerald-200/60 hover:text-emerald-100 hover:bg-emerald-500/10" onClick={() => setManualStep(getPreviousStep(activeStep))}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button
                        className="flex-1 rounded-full bg-gradient-to-r from-emerald-500 to-amber-400 text-white font-semibold shadow-[0_8px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_40px_rgba(16,185,129,0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        onClick={handleSendMagicLink}
                        disabled={isSubmitting || !isValidEmail(normalizeEmail(email))}
                      >
                        {isSubmitting ? "Sending…" : "Send magic link"}
                      </Button>
                    </div>

                    {import.meta.env.DEV && (
                      <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                        <p className="text-xs font-semibold text-yellow-300/80">🛠 Dev Tools</p>
                        <Button variant="outline" className="w-full border-yellow-500/30 text-yellow-200/80 hover:bg-yellow-500/10" onClick={() => void handleCreateRandomDevAccount("/profile", selectedRoleValue || undefined)} disabled={isSubmitting}>
                          ⚡ Instant Dev Login
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        )}

        <Button variant="ghost" className="w-full text-emerald-200/40 hover:text-emerald-100/70 hover:bg-emerald-500/10 rounded-full" onClick={() => navigate(returnTo)}>
          Continue browsing
        </Button>

        {/* Exit dialog */}
        <Dialog open={isExitOpen} onOpenChange={setIsExitOpen}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Leave this flow?</DialogTitle>
              <DialogDescription>Leave and return to browsing?</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="ghost" onClick={() => setIsExitOpen(false)}>Cancel</Button>
              <Button variant="destructive" onClick={() => { setIsExitOpen(false); navigate(returnTo); }}>Leave</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
};

const Auth = () => (
  <AuthFormProvider>
    <AuthContent />
  </AuthFormProvider>
);

export default Auth;
