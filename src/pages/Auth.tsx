import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Calendar, Camera, GraduationCap, Mail, MapPin, Music, ShoppingBag, Sparkles, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CityPicker } from "@/components/ui/city-picker";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { signInWithDevBypass, DEV_AUTH_BYPASS_HINT, createRandomDevAccount } from "@/lib/devAuthBypass";
import MagicLinkConfirmation from "@/components/MagicLinkConfirmation";
import authLogo from "@/assets/bachata-calendar-logo-auth.png";

type EntryRole = "dancer" | "vendor" | "organiser" | "teacher" | "dj" | "videographer";

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

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const userType = searchParams.get("userType");
  const mode = searchParams.get("mode") || "signup";

  const [email, setEmail] = useState("");
  const [firstName, setFirstName] = useState("");
  const [city, setCity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isExitOpen, setIsExitOpen] = useState(false);

  const [signupStep, setSignupStep] = useState(1);
  const [stepDirection, setStepDirection] = useState(1);
  const [step2Touched, setStep2Touched] = useState(false);

  const validRole = ROLE_OPTIONS.find((r) => r.value === userType)?.value;
  const [selectedRole, setSelectedRole] = useState<EntryRole>(() => {
    if (validRole) return validRole as EntryRole;
    const stored = localStorage.getItem("profile_entry_role") as EntryRole | null;
    if (stored && ROLE_OPTIONS.some((r) => r.value === stored)) return stored;
    return "dancer";
  });

  useEffect(() => {
    if (validRole && validRole !== selectedRole) setSelectedRole(validRole as EntryRole);
  }, [validRole, selectedRole]);

  useEffect(() => {
    trackAnalyticsEvent("auth_viewed", { mode: mode === "signin" ? "signin" : "signup", source: "auth_page" });
  }, [mode]);

  useEffect(() => {
    if (mode === "signup") {
      setSignupStep(1);
      setStepDirection(1);
      setStep2Touched(false);
    }
  }, [mode]);

  const signInAuthUrl = `/auth?mode=signin&returnTo=${encodeURIComponent(returnTo)}`;
  const signUpAuthUrl = `/auth?mode=signup&returnTo=${encodeURIComponent(returnTo)}${selectedRole ? `&userType=${encodeURIComponent(selectedRole)}` : ""}`;

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const goToStep = (step: number) => {
    setStepDirection(step > signupStep ? 1 : -1);
    setSignupStep(step);
  };

  const handleSendMagicLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      toast({ title: "Enter a valid email", description: "Use an email like name@example.com.", variant: "destructive" });
      return;
    }
    if (mode === "signup" && !firstName.trim()) {
      toast({ title: "Enter your first name", variant: "destructive" });
      return;
    }
    if (mode === "signup" && !city.trim()) {
      toast({ title: "Select your city", variant: "destructive" });
      return;
    }
    const isCreateAccount = mode === "signup";
    if (isCreateAccount) {
      localStorage.setItem("pending_profile_role", selectedRole);
    }
    setIsSubmitting(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: normalizedEmail,
        options: {
          shouldCreateUser: isCreateAccount,
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: isCreateAccount ? { user_type: selectedRole, first_name: firstName.trim(), city: city.trim() } : undefined,
        },
      });
      if (error) throw error;
      setMagicLinkSent(true);
      localStorage.setItem("auth_last_email", normalizedEmail);
      trackAnalyticsEvent("auth_viewed", { mode: isCreateAccount ? "signup" : "signin", source: "magic_link_sent" });
    } catch (error: any) {
      toast({ title: "Unable to send link", description: error.message || "Please try again.", variant: "destructive" });
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
      const result = await createRandomDevAccount(userTypeForAccount);
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
      <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden">
        <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[500px] w-[500px] rounded-full bg-primary/10 blur-[120px]" />
        <div className="w-full max-w-md relative z-10">
          <Card className="border-border/60 bg-card/90 backdrop-blur-2xl shadow-[0_30px_80px_hsl(var(--primary)/0.15)]">
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

  const progressPercent = mode === "signup" ? Math.round((signupStep / 3) * 100) : 0;

  return (
    <div className="min-h-screen flex flex-col items-center justify-start pt-8 sm:pt-12 pb-24 px-4 relative overflow-hidden">
      {/* Ambient glow orbs */}
      <div className="pointer-events-none absolute top-[-10%] left-1/2 -translate-x-1/2 h-[600px] w-[600px] rounded-full bg-primary/8 blur-[140px]" />
      <div className="pointer-events-none absolute bottom-[-5%] right-[-10%] h-[400px] w-[400px] rounded-full bg-accent/6 blur-[100px]" />

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
            className="w-24 h-24 object-contain drop-shadow-[0_0_30px_hsl(var(--primary)/0.4)]"
          />
          <h1 className="text-xl font-bold tracking-tight gradient-text">
            {mode === "signin" ? "Welcome back" : "Join the community"}
          </h1>
          <p className="text-sm text-muted-foreground text-center">
            {mode === "signin" ? "Sign in with a magic link." : "Create your account in 3 easy steps."}
          </p>
        </motion.div>

        {/* Tab toggle */}
        <div className="grid grid-cols-2 gap-1 rounded-full border border-border/60 bg-card/70 p-1 backdrop-blur-xl">
          <button
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              mode === "signin"
                ? "bg-primary text-primary-foreground shadow-[0_4px_20px_hsl(var(--primary)/0.35)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => navigate(signInAuthUrl)}
          >
            Sign in
          </button>
          <button
            className={`rounded-full px-4 py-2 text-sm font-medium transition-all duration-200 ${
              mode === "signup"
                ? "bg-primary text-primary-foreground shadow-[0_4px_20px_hsl(var(--primary)/0.35)]"
                : "text-muted-foreground hover:text-foreground"
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
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Step {signupStep} of 3</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1 w-full rounded-full bg-muted/50 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              />
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
            <Card className="border-border/50 bg-card/80 backdrop-blur-2xl shadow-[0_24px_60px_hsl(var(--primary)/0.1)]">
              <CardHeader className="space-y-1 pb-4">
                <CardTitle className="text-lg">Sign in</CardTitle>
                <p className="text-sm text-muted-foreground">Enter your email and we'll send you a magic link.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="you@example.com"
                      className="pl-10 bg-background/60 border-border/50 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </div>
                <Button
                  className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[0_8px_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_12px_40px_hsl(var(--primary)/0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                  onClick={handleSendMagicLink}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Sending…" : "Send magic link"}
                </Button>
                <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors" onClick={() => navigate(signUpAuthUrl)}>
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
          <Card className="border-border/50 bg-card/80 backdrop-blur-2xl shadow-[0_24px_60px_hsl(var(--primary)/0.1)] overflow-hidden">
            <AnimatePresence mode="wait" custom={stepDirection}>
              {signupStep === 1 && (
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
                    <CardTitle className="text-lg">What brings you here?</CardTitle>
                    <p className="text-sm text-muted-foreground">You can always add more roles later.</p>
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
                                ? "border-primary/70 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.12)]"
                                : "border-border/40 bg-background/40 hover:border-border/70 hover:bg-background/60"
                            }`}
                            onClick={() => setSelectedRole(role.value)}
                          >
                            <div className="flex items-center gap-3">
                              <div className={`h-9 w-9 shrink-0 rounded-lg flex items-center justify-center transition-colors ${
                                isActive
                                  ? "bg-primary/20 text-primary"
                                  : "bg-muted/40 text-muted-foreground"
                              }`}>
                                <Icon className="w-4 h-4" />
                              </div>
                              <div>
                                <p className="font-medium text-sm">{role.label}</p>
                                <p className="text-xs text-muted-foreground">{role.description}</p>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    <Button
                      className="w-full rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[0_8px_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_12px_40px_hsl(var(--primary)/0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                      onClick={() => goToStep(2)}
                    >
                      Continue
                    </Button>
                  </CardContent>
                </motion.div>
              )}

              {signupStep === 2 && (
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
                    <CardTitle className="text-lg">A little about you</CardTitle>
                    <p className="text-sm text-muted-foreground">Just two things and we're done.</p>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-6">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">First name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                        <Input
                          id="signup-firstname"
                          type="text"
                          placeholder="Your first name"
                          className="pl-10 bg-background/60 border-border/50 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                      {step2Touched && !firstName.trim() && (
                        <p className="text-xs text-destructive">First name is required.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">City</Label>
                      <CityPicker value={city} onChange={setCity} placeholder="Select your city…" />
                      {step2Touched && !city.trim() && (
                        <p className="text-xs text-destructive">City is required.</p>
                      )}
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" className="flex-1 rounded-full" onClick={() => goToStep(1)}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button
                        className="flex-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[0_8px_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_12px_40px_hsl(var(--primary)/0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        disabled={!firstName.trim() || !city.trim()}
                        onClick={() => {
                          setStep2Touched(true);
                          if (firstName.trim() && city.trim()) goToStep(3);
                        }}
                      >
                        Continue
                      </Button>
                    </div>
                  </CardContent>
                </motion.div>
              )}

              {signupStep === 3 && (
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
                    <CardTitle className="text-lg">Last step — your email</CardTitle>
                    <p className="text-sm text-muted-foreground">We'll send you a magic link to sign in.</p>
                  </CardHeader>
                  <CardContent className="space-y-4 pb-6">
                    <div className="space-y-2">
                      <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Email</Label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                        <Input
                          id="signup-email"
                          type="email"
                          placeholder="you@example.com"
                          className="pl-10 bg-background/60 border-border/50 focus-visible:ring-primary/40 focus-visible:border-primary/50 transition-all"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2 pt-1">
                      <Button variant="ghost" className="flex-1 rounded-full" onClick={() => goToStep(2)}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button
                        className="flex-1 rounded-full bg-gradient-to-r from-primary to-accent text-primary-foreground font-semibold shadow-[0_8px_30px_hsl(var(--primary)/0.3)] hover:shadow-[0_12px_40px_hsl(var(--primary)/0.45)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                        onClick={handleSendMagicLink}
                        disabled={isSubmitting || !isValidEmail(email)}
                      >
                        {isSubmitting ? "Sending…" : "Send magic link"}
                      </Button>
                    </div>

                    {import.meta.env.DEV && (
                      <div className="space-y-2 rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                        <p className="text-xs font-semibold text-yellow-300/80">🛠 Dev Tools</p>
                        <Button variant="outline" className="w-full border-yellow-500/30 text-yellow-200/80 hover:bg-yellow-500/10" onClick={() => void handleCreateRandomDevAccount("/profile", selectedRole)} disabled={isSubmitting}>
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

        <Button variant="ghost" className="w-full text-muted-foreground hover:text-foreground rounded-full" onClick={() => navigate(returnTo)}>
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

export default Auth;
