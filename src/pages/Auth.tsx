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

  // Wizard state for signup
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

  // Reset wizard when switching to signup mode
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
      <div className="min-h-screen pt-[95px] pb-24 px-4 relative overflow-hidden">
        <div className="pointer-events-none absolute top-10 -left-20 h-64 w-64 rounded-full bg-festival-teal/20 blur-3xl" />
        <div className="w-full max-w-xl mx-auto relative z-10">
          <Card className="border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
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
    <div className="min-h-screen pt-[95px] pb-24 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute top-10 -left-20 h-64 w-64 rounded-full bg-festival-teal/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="w-full max-w-xl mx-auto space-y-4 relative z-10">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1">
            <div className="inline-flex items-center justify-center w-10 h-10 rounded-full bg-gradient-to-br from-festival-teal/30 to-cyan-400/30 border border-festival-teal/35 text-cyan-300 backdrop-blur-md">
              <Sparkles className="w-5 h-5" />
            </div>
            <h1 className="text-2xl font-bold">{mode === "signin" ? "Welcome back" : "Create your account"}</h1>
            <p className="text-sm text-foreground/85">
              {mode === "signin" ? "Sign in with a magic link." : "Pick your role, then enter your email."}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsExitOpen(true)} aria-label="Exit">
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Tab toggle */}
        <div className="grid grid-cols-2 gap-2 rounded-xl border border-festival-teal/45 bg-background/85 p-1 backdrop-blur-xl">
          <Button variant="ghost" className={mode === "signin" ? "bg-festival-teal/28 border border-festival-teal/40 text-foreground hover:bg-festival-teal/34" : "text-foreground/80 hover:text-foreground hover:bg-background/70"} onClick={() => navigate(signInAuthUrl)}>
            Sign in
          </Button>
          <Button variant="ghost" className={mode === "signup" ? "bg-festival-teal/28 border border-festival-teal/40 text-foreground hover:bg-festival-teal/34" : "text-foreground/80 hover:text-foreground hover:bg-background/70"} onClick={() => navigate(signUpAuthUrl)}>
            Create account
          </Button>
        </div>

        {/* Progress bar for signup */}
        {mode === "signup" && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-xs text-foreground/70">
              <span>Step {signupStep} of 3</span>
              <span>{progressPercent}%</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-muted/40 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-festival-teal to-cyan-400"
                initial={false}
                animate={{ width: `${progressPercent}%` }}
                transition={{ duration: 0.35, ease: "easeInOut" }}
              />
            </div>
          </div>
        )}

        {mode === "signin" ? (
          /* ─── SIGN IN ─── (unchanged) */
          <Card className="border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Sign in</CardTitle>
              <p className="text-sm text-foreground/80">Enter your email and we'll send you a magic link.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signin-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signin-email" type="email" placeholder="you@example.com" className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>
              <Button className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95" onClick={handleSendMagicLink} disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send magic link"}
              </Button>
              <button type="button" className="w-full text-xs text-muted-foreground hover:text-foreground" onClick={() => navigate(signUpAuthUrl)}>
                New here? Create an account
              </button>
              {import.meta.env.DEV && (
                <div className="space-y-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
                  <p className="text-xs font-semibold text-yellow-300">🛠 Dev Tools</p>
                  <Button variant="outline" className="w-full border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/20" onClick={() => void handleCreateRandomDevAccount(returnTo)} disabled={isSubmitting}>
                    ⚡ Instant Dev Login (random account)
                  </Button>
                  <Button variant="ghost" className="w-full text-xs text-yellow-300/70 hover:text-yellow-200" onClick={() => void handleDevQuickLogin(returnTo)} disabled={isSubmitting}>
                    Dev login (env credentials)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          /* ─── SIGN UP WIZARD ─── */
          <Card className="border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl overflow-hidden">
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
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-xl">What brings you here?</CardTitle>
                    <p className="text-sm text-foreground/80">You can always add more roles later.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      {ROLE_OPTIONS.map((role) => {
                        const Icon = role.icon;
                        const isActive = selectedRole === role.value;
                        return (
                          <motion.button
                            whileTap={{ scale: 0.98 }}
                            key={role.value}
                            type="button"
                            className={`w-full text-left rounded-xl border px-4 py-3 transition ${
                              isActive
                                ? "border-cyan-300/85 bg-festival-teal/28"
                                : "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20"
                            }`}
                            onClick={() => setSelectedRole(role.value)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 shrink-0 rounded-full border border-white/15 bg-background/60 flex items-center justify-center text-cyan-300">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold">{role.label}</p>
                                <p className="text-xs text-foreground/60">{role.description}</p>
                              </div>
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                    <Button
                      className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95"
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
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-xl">A little about you</CardTitle>
                    <p className="text-sm text-foreground/80">Just two things and we're done.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label htmlFor="signup-firstname">First name</Label>
                      <div className="relative">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          id="signup-firstname"
                          type="text"
                          placeholder="Your first name"
                          className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                        />
                      </div>
                      {step2Touched && !firstName.trim() && (
                        <p className="text-xs text-destructive">First name is required.</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>City</Label>
                      <CityPicker value={city} onChange={setCity} placeholder="Select your city…" />
                      {step2Touched && !city.trim() && (
                        <p className="text-xs text-destructive">City is required.</p>
                      )}
                    </div>

                    <div className="flex gap-2">
                      <Button variant="ghost" className="flex-1" onClick={() => goToStep(1)}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95"
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
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-xl">Last step — your email</CardTitle>
                    <p className="text-sm text-foreground/80">We'll send you a magic link to sign in.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
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
                          onChange={(e) => setEmail(e.target.value)}
                        />
                      </div>
                    </div>

                    <div className="flex gap-2">
                      <Button variant="ghost" className="flex-1" onClick={() => goToStep(2)}>
                        <ArrowLeft className="w-4 h-4 mr-1" /> Back
                      </Button>
                      <Button
                        className="flex-1 bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95"
                        onClick={handleSendMagicLink}
                        disabled={isSubmitting || !isValidEmail(email)}
                      >
                        {isSubmitting ? "Sending…" : "Send magic link"}
                      </Button>
                    </div>

                    {import.meta.env.DEV && (
                      <div className="space-y-2 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-3">
                        <p className="text-xs font-semibold text-yellow-300">🛠 Dev Tools</p>
                        <Button variant="outline" className="w-full border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/20" onClick={() => void handleCreateRandomDevAccount("/profile", selectedRole)} disabled={isSubmitting}>
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

        <Button variant="ghost" className="w-full" onClick={() => navigate(returnTo)}>
          Continue browsing
        </Button>

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
