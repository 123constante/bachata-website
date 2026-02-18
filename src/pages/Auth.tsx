import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Camera, Flame, GraduationCap, Mail, MapPin, Music, ShoppingBag, Sparkles, Target, User, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { ensureDancerProfile } from "@/lib/ensureDancerProfile";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { triggerGlobalConfetti } from "@/lib/confetti";
import { signInWithDevBypass, DEV_AUTH_BYPASS_HINT, createRandomDevAccount } from "@/lib/devAuthBypass";

type EntryRole = "dancer" | "vendor" | "organiser" | "teacher" | "dj" | "videographer";
type SignupStep = 1 | 2;

const AUTH_SIGNUP_DRAFT_KEY = "auth_signup_draft_v1";
const OTP_RESEND_COOLDOWN_SECONDS = 30;

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const userType = searchParams.get("userType");
  const mode = searchParams.get("mode") || "signup";

  const [signupStep, setSignupStep] = useState<SignupStep>(1);
  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [city, setCity] = useState("");
  const [signupCode, setSignupCode] = useState("");
  const [isSignupCodeSent, setIsSignupCodeSent] = useState(false);
  const [signupRoute, setSignupRoute] = useState<"returning" | "new" | null>(null);
  const [isCheckingSignupEmail, setIsCheckingSignupEmail] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  const [signInEmail, setSignInEmail] = useState("");
  const [signInCode, setSignInCode] = useState("");
  const [isSignInCodeSent, setIsSignInCodeSent] = useState(false);
  const [signInResendCooldown, setSignInResendCooldown] = useState(0);
  const [isExitOpen, setIsExitOpen] = useState(false);
  const [didRestoreDraft, setDidRestoreDraft] = useState(false);
  const [showRestoredBadge, setShowRestoredBadge] = useState(false);
  const [signupResendCooldown, setSignupResendCooldown] = useState(0);

  const roleOptions = useMemo(
    () => [
      {
        label: "Dancer",
        description: "Classes & events",
        route: "/create-dancers-profile",
        icon: Sparkles,
        value: "dancer" as const,
        bentoClass: "col-span-2 min-h-[96px]",
        cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20",
        activeClass: "border-cyan-300/85 bg-festival-teal/28",
        iconClass: "text-cyan-300",
        ctaClass: "bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95",
        progressClass: "bg-gradient-to-r from-festival-teal to-cyan-400",
      },
      {
        label: "Organiser",
        description: "Run events",
        route: "/create-organiser-profile",
        icon: Calendar,
        value: "organiser" as const,
        bentoClass: "row-span-2 min-h-[152px]",
        cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20",
        activeClass: "border-cyan-300/85 bg-festival-teal/28",
        iconClass: "text-cyan-300",
        ctaClass: "bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95",
        progressClass: "bg-gradient-to-r from-festival-teal to-cyan-400",
      },
      {
        label: "Teacher",
        description: "Teach",
        route: "/create-teacher-profile",
        icon: GraduationCap,
        value: "teacher" as const,
        bentoClass: "min-h-[72px]",
        cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20",
        activeClass: "border-cyan-300/85 bg-festival-teal/28",
        iconClass: "text-cyan-300",
        ctaClass: "bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95",
        progressClass: "bg-gradient-to-r from-festival-teal to-cyan-400",
      },
      {
        label: "DJ",
        description: "Play music",
        route: "/create-dj-profile",
        icon: Music,
        value: "dj" as const,
        bentoClass: "min-h-[72px]",
        cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20",
        activeClass: "border-cyan-300/85 bg-festival-teal/28",
        iconClass: "text-cyan-300",
        ctaClass: "bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95",
        progressClass: "bg-gradient-to-r from-festival-teal to-cyan-400",
      },
      {
        label: "Videographer",
        description: "Film events",
        route: "/create-videographer-profile",
        icon: Camera,
        value: "videographer" as const,
        bentoClass: "min-h-[72px]",
        cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20",
        activeClass: "border-cyan-300/85 bg-festival-teal/28",
        iconClass: "text-cyan-300",
        ctaClass: "bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95",
        progressClass: "bg-gradient-to-r from-festival-teal to-cyan-400",
      },
      {
        label: "Vendor",
        description: "Sell at events",
        route: "/create-vendor-profile",
        icon: ShoppingBag,
        value: "vendor" as const,
        bentoClass: "col-span-2 min-h-[84px]",
        cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20",
        activeClass: "border-cyan-300/85 bg-festival-teal/28",
        iconClass: "text-cyan-300",
        ctaClass: "bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95",
        progressClass: "bg-gradient-to-r from-festival-teal to-cyan-400",
      },
    ],
    []
  );

  const validRole = roleOptions.find((role) => role.value === userType)?.value;
  const [selectedRole, setSelectedRole] = useState<EntryRole>(() => {
    if (validRole) {
      return validRole as EntryRole;
    }
    const stored = localStorage.getItem("profile_entry_role") as EntryRole | null;
    if (stored && roleOptions.some((role) => role.value === stored)) {
      return stored;
    }
    return "dancer";
  });

  useEffect(() => {
    if (validRole && validRole !== selectedRole) {
      setSelectedRole(validRole as EntryRole);
    }
  }, [validRole, selectedRole]);

  useEffect(() => {
    if (mode === "signup" && validRole) {
      setSignupStep(2);
    }
  }, [mode, validRole]);

  useEffect(() => {
    trackAnalyticsEvent("auth_viewed", { mode: mode === "signin" ? "signin" : "signup", source: "auth_page" });
  }, [mode]);

  useEffect(() => {
    if (mode !== "signup") return;
    trackAnalyticsEvent("signup_step_viewed", {
      step: signupStep,
      role: selectedRole,
    });
  }, [mode, selectedRole, signupStep]);

  useEffect(() => {
    localStorage.setItem("profile_entry_role", selectedRole);
  }, [selectedRole]);

  useEffect(() => {
    if (mode !== "signup" || validRole) return;
    const rawDraft = localStorage.getItem(AUTH_SIGNUP_DRAFT_KEY);
    if (!rawDraft) return;

    try {
      const draft = JSON.parse(rawDraft) as {
        step?: number;
        email?: string;
        firstName?: string;
        city?: string;
        fullName?: string;
        selectedRole?: EntryRole;
      };

      if (typeof draft.step === "number" && draft.step >= 1 && draft.step <= 2) {
        setSignupStep(draft.step as SignupStep);
      }
      if (typeof draft.email === "string") setEmail(draft.email);
      if (typeof draft.firstName === "string") setFirstName(draft.firstName);
      else if (typeof draft.fullName === "string") setFirstName(draft.fullName);
      if (typeof draft.city === "string") setCity(draft.city);
      if (draft.selectedRole && roleOptions.some((role) => role.value === draft.selectedRole)) {
        setSelectedRole(draft.selectedRole);
      }
      setSignupStep((prev) => (Math.min(prev, 2) as SignupStep));
      setDidRestoreDraft(true);
      setShowRestoredBadge(true);
    } catch {
      // Ignore invalid draft payload
    }
  }, [mode, roleOptions, validRole]);

  useEffect(() => {
    if (!didRestoreDraft) return;
    toast({
      title: "Draft restored",
      description: "We restored your previous signup progress.",
    });
    setDidRestoreDraft(false);
  }, [didRestoreDraft, toast]);

  useEffect(() => {
    if (signInResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setSignInResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [signInResendCooldown]);

  useEffect(() => {
    if (signupResendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setSignupResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [signupResendCooldown]);

  const selectedRoleConfig = roleOptions.find((role) => role.value === selectedRole);
  const signupReturnTo = selectedRoleConfig?.route || "/";
  const signInAuthUrl = `/auth?mode=signin&returnTo=${encodeURIComponent(returnTo)}`;
  const signUpAuthUrl = `/auth?mode=signup&returnTo=${encodeURIComponent(returnTo)}${selectedRole ? `&userType=${encodeURIComponent(selectedRole)}` : ""}`;
  const hasSignupProgress =
    mode === "signup" &&
    (signupStep > 1 ||
      email.trim().length > 0 ||
      firstName.trim().length > 0 ||
      city.trim().length > 0);

  const signupTotalSteps = 2;
  const signupProgress = Math.round((signupStep / signupTotalSteps) * 100);

  const streakCount = Math.max(0, signupStep - 1);

  const profileStrength = useMemo(() => {
    let strength = 0;
    if (selectedRole) strength += 35;
    if (email.trim()) strength += 25;
    if (firstName.trim()) strength += 20;
    if (city.trim()) strength += 10;
    if (isSignupCodeSent) strength += 20;
    return Math.min(100, strength);
  }, [city, email, firstName, isSignupCodeSent, selectedRole]);

  const saveSignupDraft = () => {
    const draft = {
      step: signupStep,
      email,
      firstName,
      city,
      selectedRole,
      updatedAt: new Date().toISOString(),
    };
    localStorage.setItem(AUTH_SIGNUP_DRAFT_KEY, JSON.stringify(draft));
  };

  const clearSignupDraft = () => {
    localStorage.removeItem(AUTH_SIGNUP_DRAFT_KEY);
  };

  const handleSaveAndExit = () => {
    if (mode === "signup") {
      saveSignupDraft();
      toast({ title: "Progress saved", description: "You can continue signup later." });
    }
    setIsExitOpen(false);
    navigate(returnTo);
  };

  const handleExitWithoutSaving = () => {
    if (mode === "signup") {
      clearSignupDraft();
    }
    setIsExitOpen(false);
    setSignupRoute(null);
    setSignupCode("");
    navigate(returnTo);
  };

  const handleRoleContinue = () => {
    trackAnalyticsEvent("signup_step_completed", { step: 1, role: selectedRole });
    setSignupRoute(null);
    setSignupCode("");
    setIsSignupCodeSent(false);
    setSignupStep(2);
  };

  const checkAccountExistsByEmail = async (candidateEmail: string): Promise<boolean | null> => {
    try {
      const { data, error } = await supabase.rpc("account_exists_by_email" as any, {
        p_email: candidateEmail,
      });

      if (error) return null;
      if (typeof data !== "boolean") return null;
      return data;
    } catch {
      return null;
    }
  };

  const handleSignupEmailContinue = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      toast({
        title: "Enter a valid email",
        description: "Use an email like name@example.com.",
        variant: "destructive",
      });
      return;
    }

    setEmail(normalizedEmail);
    setIsCheckingSignupEmail(true);
    const exists = await checkAccountExistsByEmail(normalizedEmail);
    setIsCheckingSignupEmail(false);

    if (exists === true) {
      setSignupRoute("returning");
      return;
    }

    if (exists === false) {
      setSignupRoute("new");
      return;
    }

    setSignupRoute("returning");
  };

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const handleSendSignInCode = async () => {
    const candidateEmail = signInEmail.trim().toLowerCase();
    if (!isValidEmail(candidateEmail)) {
      toast({
        title: "Enter a valid email",
        description: "We will send a short sign-in code to this address.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: candidateEmail,
        options: {
          shouldCreateUser: false,
          emailRedirectTo: `${window.location.origin}/auth?mode=signin&returnTo=${encodeURIComponent(returnTo)}`,
        },
      });

      if (error) throw error;

      setSignInEmail(candidateEmail);
      setIsSignInCodeSent(true);
      setSignInResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      toast({
        title: "Code sent",
        description: "Check your email for a short sign-in code.",
      });
    } catch (error: any) {
      toast({
        title: "Unable to send code",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySignInCode = async () => {
    const candidateEmail = signInEmail.trim().toLowerCase();
    const candidateCode = signInCode.trim();

    if (!isValidEmail(candidateEmail) || !candidateCode) {
      toast({
        title: "Enter email and code",
        description: "Add the email and code from your inbox.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: candidateEmail,
        token: candidateCode,
        type: "email",
      });

      if (error) throw error;

      const { data: authState } = await supabase.auth.getUser();
      const authedUser = authState.user;
      if (authedUser?.id) {
        const metadata = (authedUser.user_metadata || {}) as Record<string, unknown>;
        const metadataFirstName = typeof metadata.first_name === "string" ? metadata.first_name : null;
        const metadataCity = typeof metadata.city === "string" ? metadata.city : null;
        await ensureDancerProfile({
          userId: authedUser.id,
          email: authedUser.email || candidateEmail,
          firstName: metadataFirstName,
          city: metadataCity,
        });
      }

      clearSignupDraft();
      navigate(returnTo);
    } catch (error: any) {
      toast({
        title: "Invalid code",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSendSignupCode = async () => {
    if (!isValidEmail(email)) {
      trackAnalyticsEvent("signup_failed", { step: 2, role: selectedRole, reason: "invalid_email" });
      toast({
        title: "Enter a valid email",
        description: "Use an email like name@example.com.",
        variant: "destructive",
      });
      return;
    }

    const resolvedRoute = signupRoute || "returning";

    if (resolvedRoute === "new" && !firstName.trim()) {
      trackAnalyticsEvent("signup_failed", { step: 2, role: selectedRole, reason: "missing_first_name" });
      toast({
        title: "Add your first name",
        description: "Enter your first name to continue.",
        variant: "destructive",
      });
      return;
    }

    if (resolvedRoute === "new" && !city.trim()) {
      trackAnalyticsEvent("signup_failed", { step: 2, role: selectedRole, reason: "missing_city" });
      toast({
        title: "Add your city",
        description: "Enter your city so we can set up your account foundation.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const trimmedFirstName = firstName.trim();
      const redirectUrl = `${window.location.origin}/auth?mode=signup&returnTo=${encodeURIComponent(signupReturnTo)}&userType=${encodeURIComponent(selectedRole)}`;

      const { error } = await supabase.auth.signInWithOtp({
        email,
        options: {
          shouldCreateUser: resolvedRoute === "new",
          emailRedirectTo: redirectUrl,
          data: {
            first_name: trimmedFirstName,
            city: city.trim() || null,
            surname: null,
            user_type: selectedRole,
          },
        },
      });

      if (error) throw error;

      setIsSignupCodeSent(true);
      setSignupResendCooldown(OTP_RESEND_COOLDOWN_SECONDS);
      toast({
        title: "Code sent",
        description: "Check your email for a short verification code.",
      });
    } catch (error: any) {
      trackAnalyticsEvent("signup_failed", { step: 2, role: selectedRole, reason: error?.message || "signup_failed" });
      toast({
        title: "Unable to send code",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifySignupCode = async () => {
    if (!isValidEmail(email)) {
      toast({
        title: "Enter a valid email",
        description: "Use an email like name@example.com.",
        variant: "destructive",
      });
      return;
    }

    if (!signupCode.trim()) {
      toast({
        title: "Enter your code",
        description: "Paste the short code from your email.",
        variant: "destructive",
      });
      return;
    }

    const resolvedRoute = signupRoute || "returning";

    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email,
        token: signupCode.trim(),
        type: "email",
      });

      if (error) throw error;

      const { data: authState } = await supabase.auth.getUser();
      const authedUser = authState.user;
      if (authedUser?.id) {
        const metadata = (authedUser.user_metadata || {}) as Record<string, unknown>;
        const metadataFirstName = typeof metadata.first_name === "string" ? metadata.first_name : null;
        const metadataCity = typeof metadata.city === "string" ? metadata.city : null;
        await ensureDancerProfile({
          userId: authedUser.id,
          email: authedUser.email || email,
          firstName: firstName.trim() || metadataFirstName,
          city: city.trim() || metadataCity,
        });
      }

      trackAnalyticsEvent("signup_step_completed", { step: 2, role: selectedRole });
      trackAnalyticsEvent("signup_completed", { role: selectedRole, verification: "email_confirmation" });
      triggerGlobalConfetti();
      clearSignupDraft();
      navigate(resolvedRoute === "returning" ? signupReturnTo : signupReturnTo);
    } catch (error: any) {
      toast({
        title: "Invalid code",
        description: error.message || "Please try again.",
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

      clearSignupDraft();
      navigate(destination);
    } catch (error: any) {
      toast({
        title: "Dev quick login unavailable",
        description: error?.message || DEV_AUTH_BYPASS_HINT,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateRandomDevAccount = async (destination: string, userTypeForAccount?: string) => {
    setIsSubmitting(true);
    try {
      const result = await createRandomDevAccount(userTypeForAccount);
      if (result.error) {
        throw new Error(`${result.error.message}${result.email ? ` | ${result.email}` : ""}${result.password ? ` | ${result.password}` : ""}`);
      }

      clearSignupDraft();
      toast({
        title: "Random test account created",
        description: `${result.email} / ${result.password}`,
      });
      navigate(destination);
    } catch (error: any) {
      toast({
        title: "Could not create random account",
        description: error?.message || "Please check dev auth settings.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleMockFillSignup = () => {
    const mockNames = ["Maria", "Leo", "Sofia", "Alex", "Nina", "Rafa"];
    const selectedName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const mockEmail = `dev-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.test`;

    if (signupStep === 1) {
      setSignupStep(2);
    }

    setEmail(mockEmail);
    setFirstName(selectedName);
    setSignupRoute("new");
    setSignupCode("");
    setIsSignupCodeSent(false);
    setSignupResendCooldown(0);

    toast({
      title: "Mock data filled",
      description: "Signup fields were populated with test values.",
    });
  };

  return (
    <div className="min-h-screen pt-[95px] pb-24 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute top-10 -left-20 h-64 w-64 rounded-full bg-festival-teal/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="w-full max-w-xl mx-auto space-y-4 relative z-10">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-festival-teal/30 to-cyan-400/30 border border-festival-teal/35 text-cyan-300 backdrop-blur-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-sm text-foreground/85">
              {mode === "signin" ? "Sign in to continue." : "Quick game: 5 taps to unlock your profile."}
            </p>
            {mode === "signup" && showRestoredBadge && (
              <div className="pt-1">
                <Badge variant="secondary" className="gap-1.5">
                  Draft restored
                  <button
                    type="button"
                    className="text-xs leading-none opacity-70 hover:opacity-100"
                    onClick={() => setShowRestoredBadge(false)}
                    aria-label="Dismiss draft restored badge"
                  >
                    ×
                  </button>
                </Badge>
              </div>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsExitOpen(true)}
            aria-label="Exit"
            title="Exit"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-festival-teal/45 bg-background/85 p-1 backdrop-blur-xl">
          <Button
            variant="ghost"
            className={mode === "signin" ? "bg-festival-teal/28 border border-festival-teal/40 text-foreground hover:bg-festival-teal/34" : "text-foreground/80 hover:text-foreground hover:bg-background/70"}
            onClick={() => navigate(signInAuthUrl)}
          >
            Sign in
          </Button>
          <Button
            variant="ghost"
            className={mode === "signup" ? "bg-festival-teal/28 border border-festival-teal/40 text-foreground hover:bg-festival-teal/34" : "text-foreground/80 hover:text-foreground hover:bg-background/70"}
            onClick={() => navigate(signUpAuthUrl)}
          >
            Create account
          </Button>
        </div>

          {mode === "signin" ? (
            <Card className="border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl">Sign in</CardTitle>
                <p className="text-sm text-foreground/80">Use your email to receive a short sign-in code.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                      value={signInEmail}
                      onChange={(event) => {
                        setSignInEmail(event.target.value);
                        setIsSignInCodeSent(false);
                        setSignInCode("");
                        setSignInResendCooldown(0);
                      }}
                    />
                  </div>
                </div>

                {!isSignInCodeSent ? (
                  <Button className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95" onClick={handleSendSignInCode} disabled={isSubmitting}>
                    {isSubmitting ? "Sending code..." : "Send sign-in code"}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="signin-code">Email code</Label>
                      <Input
                        id="signin-code"
                        type="text"
                        placeholder="Enter code"
                        className="bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                        value={signInCode}
                        onChange={(event) => setSignInCode(event.target.value)}
                      />
                    </div>
                    <Button className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95" onClick={handleVerifySignInCode} disabled={isSubmitting}>
                      {isSubmitting ? "Verifying..." : "Verify code"}
                    </Button>
                    <button
                      type="button"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setIsSignInCodeSent(false);
                        setSignInCode("");
                      }}
                    >
                      Use different email
                    </button>
                    <button
                      type="button"
                      className="w-full text-xs text-muted-foreground hover:text-foreground"
                      onClick={handleSendSignInCode}
                      disabled={isSubmitting || signInResendCooldown > 0}
                    >
                      {signInResendCooldown > 0 ? `Resend code in ${signInResendCooldown}s` : "Resend code"}
                    </button>
                  </>
                )}

                <button
                  type="button"
                  className="w-full text-xs text-muted-foreground hover:text-foreground"
                  onClick={() => navigate(signUpAuthUrl)}
                >
                  New here? Create an account
                </button>
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void handleDevQuickLogin(returnTo)}
                    disabled={isSubmitting}
                  >
                    Dev quick login
                  </button>
                )}
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => void handleCreateRandomDevAccount(returnTo)}
                    disabled={isSubmitting}
                  >
                    Create random test account
                  </button>
                )}
              </CardContent>
            </Card>
          ) : (
            <Card className="border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
              <CardHeader className="space-y-2">
                <CardTitle className="text-xl">
                  {signupStep === 1 && "Choose your role"}
                  {signupStep === 2 && "Secure your account"}
                </CardTitle>
                {(signupStep === 1 || signupStep === 2) && (
                  <p className="text-sm text-foreground/80">
                    {signupStep === 1 && "Choose your role."}
                    {signupStep === 2 && "Secure your account to save progress."}
                  </p>
                )}
                {import.meta.env.DEV && (
                  <button
                    type="button"
                    className="self-start text-xs text-muted-foreground hover:text-foreground"
                    onClick={handleMockFillSignup}
                  >
                    Mock fill signup
                  </button>
                )}
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="inline-flex items-center gap-1"><Zap className="h-3.5 w-3.5 text-cyan-300" /> XP {Math.max(20, profileStrength)}</span>
                  <span className="inline-flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-cyan-300" /> Streak {streakCount}/{signupTotalSteps}</span>
                </div>

                <div className="h-1.5 rounded-full bg-muted/70 overflow-hidden">
                  <div
                    className={`h-full transition-all ${selectedRoleConfig?.progressClass || 'bg-festival-teal'}`}
                    style={{ width: `${signupProgress}%` }}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>Profile strength</span>
                    <span>{profileStrength}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted/50 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-festival-teal to-cyan-400 transition-all" style={{ width: `${profileStrength}%` }} />
                  </div>
                </div>

                <AnimatePresence mode="wait">
                  {signupStep === 1 && (
                    <motion.div key="signup-role" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                      <div className="grid grid-cols-2 auto-rows-[72px] gap-3">
                        {roleOptions.map((role) => {
                          const Icon = role.icon;
                          const isActive = selectedRole === role.value;
                          return (
                            <motion.button
                              whileTap={{ scale: 0.98 }}
                              key={role.label}
                              type="button"
                              className={`w-full text-left rounded-xl border px-4 py-3 transition ${role.bentoClass || ''} ${isActive ? role.activeClass : role.cardClass}`}
                              onClick={() => setSelectedRole(role.value)}
                            >
                              <div className="flex items-center gap-3">
                                <div className={`h-10 w-10 rounded-full border border-white/15 bg-background/60 flex items-center justify-center ${role.iconClass}`}>
                                  <Icon className="w-5 h-5" />
                                </div>
                                <div>
                                  <p className="font-semibold">{role.label}</p>
                                </div>
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>
                      <Button className={`w-full font-semibold ${selectedRoleConfig?.ctaClass || 'bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95'}`} onClick={handleRoleContinue}>
                        Lock role
                      </Button>
                    </motion.div>
                  )}

                  {signupStep === 2 && (
                    <motion.div key="signup-account" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="signup-email">Email</Label>
                        <div className="relative">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                          <Input
                            id="signup-email"
                            type="email"
                            placeholder="you@example.com"
                            className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                            value={email}
                            onChange={(event) => {
                              setEmail(event.target.value);
                              if (signupRoute) {
                                setSignupRoute(null);
                                setSignupCode("");
                                setIsSignupCodeSent(false);
                              }
                            }}
                          />
                        </div>
                      </div>

                      {signupRoute === null ? (
                        <Button
                          className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95"
                          onClick={() => void handleSignupEmailContinue()}
                          disabled={isCheckingSignupEmail}
                        >
                          {isCheckingSignupEmail ? "Checking account..." : "Continue"}
                        </Button>
                      ) : (
                        <>
                          <div className="rounded-lg border border-festival-teal/35 bg-festival-teal/10 px-3 py-2 text-xs text-cyan-100">
                            {signupRoute === "returning"
                              ? "Account found. We will send a sign-in code."
                              : "No account found. Create your account details below."}
                          </div>

                          {signupRoute === "new" && (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor="signup-first-name">First name</Label>
                                <div className="relative">
                                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    id="signup-first-name"
                                    type="text"
                                    placeholder="Maria"
                                    className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                                    value={firstName}
                                    onChange={(event) => setFirstName(event.target.value)}
                                  />
                                </div>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="signup-city">City</Label>
                                <div className="relative">
                                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                                  <Input
                                    id="signup-city"
                                    type="text"
                                    placeholder="London"
                                    className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                                    value={city}
                                    onChange={(event) => setCity(event.target.value)}
                                  />
                                </div>
                              </div>
                            </>
                          )}

                          {!isSignupCodeSent ? (
                            <Button className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95" onClick={handleSendSignupCode} disabled={isSubmitting}>
                              {isSubmitting ? "Sending code..." : signupRoute === "returning" ? "Send sign-in code" : "Send account code"}
                            </Button>
                          ) : (
                            <>
                              <div className="space-y-2">
                                <Label htmlFor="signup-code">Email code</Label>
                                <Input
                                  id="signup-code"
                                  type="text"
                                  placeholder="Enter code"
                                  className="bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                                  value={signupCode}
                                  onChange={(event) => setSignupCode(event.target.value)}
                                />
                              </div>
                              <Button className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95" onClick={handleVerifySignupCode} disabled={isSubmitting}>
                                {isSubmitting ? "Verifying..." : "Verify code"}
                              </Button>
                              <button
                                type="button"
                                className="w-full text-xs text-muted-foreground hover:text-foreground"
                                onClick={handleSendSignupCode}
                                disabled={isSubmitting || signupResendCooldown > 0}
                              >
                                {signupResendCooldown > 0 ? `Resend code in ${signupResendCooldown}s` : "Resend code"}
                              </button>
                            </>
                          )}

                          <button
                            type="button"
                            className="w-full text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => {
                              setSignupRoute(null);
                              setSignupCode("");
                              setIsSignupCodeSent(false);
                              setSignupResendCooldown(0);
                            }}
                          >
                            Use different email
                          </button>
                          {import.meta.env.DEV && (
                            <button
                              type="button"
                              className="w-full text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => void handleDevQuickLogin(signupReturnTo)}
                              disabled={isSubmitting}
                            >
                              Dev quick login
                            </button>
                          )}
                          {import.meta.env.DEV && (
                            <button
                              type="button"
                              className="w-full text-xs text-muted-foreground hover:text-foreground"
                              onClick={() => void handleCreateRandomDevAccount(signupReturnTo, selectedRole)}
                              disabled={isSubmitting}
                            >
                              Create random test account
                            </button>
                          )}
                        </>
                      )}

                      <div className="flex items-center gap-2 text-xs text-cyan-100 bg-festival-teal/15 border border-festival-teal/35 rounded-lg px-3 py-2">
                        <Target className="h-3.5 w-3.5 text-cyan-300" />
                        You are one tap away from unlocking your profile.
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {signupStep > 1 && (
                  <button
                    type="button"
                    className="w-full text-xs text-muted-foreground hover:text-foreground"
                    onClick={() => setSignupStep((prev) => (Math.max(prev - 1, 1) as SignupStep))}
                  >
                    Back
                  </button>
                )}
              </CardContent>
            </Card>
          )}

          <Button variant="ghost" className="w-full" onClick={() => navigate(returnTo)}>
            Continue browsing
          </Button>

          <Dialog open={isExitOpen} onOpenChange={setIsExitOpen}>
            <DialogContent className="sm:max-w-sm">
              <DialogHeader>
                <DialogTitle>Leave this flow?</DialogTitle>
                <DialogDescription>
                  {mode === "signup" && hasSignupProgress
                    ? "Save your signup progress before leaving?"
                    : "Leave and return to browsing?"}
                </DialogDescription>
              </DialogHeader>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="ghost" onClick={() => setIsExitOpen(false)}>
                  Cancel
                </Button>
                {mode === "signup" && hasSignupProgress && (
                  <Button variant="outline" onClick={handleSaveAndExit}>
                    Save & Exit
                  </Button>
                )}
                <Button variant="destructive" onClick={handleExitWithoutSaving}>
                  {mode === "signup" && hasSignupProgress ? "Leave without saving" : "Leave"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
    </div>
  );
};

export default Auth;

