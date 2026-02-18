import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Calendar, Camera, GraduationCap, Mail, Music, ShoppingBag, Sparkles, User, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { trackAnalyticsEvent } from "@/lib/analytics";
import { signInWithDevBypass, DEV_AUTH_BYPASS_HINT, createRandomDevAccount } from "@/lib/devAuthBypass";

type EntryRole = "dancer" | "vendor" | "organiser" | "teacher" | "dj" | "videographer";

const Auth = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const returnTo = searchParams.get("returnTo") || "/";
  const userType = searchParams.get("userType");
  const mode = searchParams.get("mode") || "signup";

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [isExitOpen, setIsExitOpen] = useState(false);

  const roleOptions = useMemo(
    () => [
      { label: "Dancer", icon: Sparkles, value: "dancer" as const, bentoClass: "col-span-2 min-h-[96px]", cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20", activeClass: "border-cyan-300/85 bg-festival-teal/28", iconClass: "text-cyan-300" },
      { label: "Organiser", icon: Calendar, value: "organiser" as const, bentoClass: "row-span-2 min-h-[152px]", cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20", activeClass: "border-cyan-300/85 bg-festival-teal/28", iconClass: "text-cyan-300" },
      { label: "Teacher", icon: GraduationCap, value: "teacher" as const, bentoClass: "min-h-[72px]", cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20", activeClass: "border-cyan-300/85 bg-festival-teal/28", iconClass: "text-cyan-300" },
      { label: "DJ", icon: Music, value: "dj" as const, bentoClass: "min-h-[72px]", cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20", activeClass: "border-cyan-300/85 bg-festival-teal/28", iconClass: "text-cyan-300" },
      { label: "Videographer", icon: Camera, value: "videographer" as const, bentoClass: "min-h-[72px]", cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20", activeClass: "border-cyan-300/85 bg-festival-teal/28", iconClass: "text-cyan-300" },
      { label: "Vendor", icon: ShoppingBag, value: "vendor" as const, bentoClass: "col-span-2 min-h-[84px]", cardClass: "border-festival-teal/45 bg-festival-teal/12 hover:bg-festival-teal/20", activeClass: "border-cyan-300/85 bg-festival-teal/28", iconClass: "text-cyan-300" },
    ],
    []
  );

  const validRole = roleOptions.find((r) => r.value === userType)?.value;
  const [selectedRole, setSelectedRole] = useState<EntryRole>(() => {
    if (validRole) return validRole as EntryRole;
    const stored = localStorage.getItem("profile_entry_role") as EntryRole | null;
    if (stored && roleOptions.some((r) => r.value === stored)) return stored;
    return "dancer";
  });

  useEffect(() => {
    if (validRole && validRole !== selectedRole) setSelectedRole(validRole as EntryRole);
  }, [validRole, selectedRole]);

  useEffect(() => {
    trackAnalyticsEvent("auth_viewed", { mode: mode === "signin" ? "signin" : "signup", source: "auth_page" });
  }, [mode]);

  const signInAuthUrl = `/auth?mode=signin&returnTo=${encodeURIComponent(returnTo)}`;
  const signUpAuthUrl = `/auth?mode=signup&returnTo=${encodeURIComponent(returnTo)}${selectedRole ? `&userType=${encodeURIComponent(selectedRole)}` : ""}`;

  const isValidEmail = (value: string) => /\S+@\S+\.\S+/.test(value);

  const handleSendMagicLink = async () => {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isValidEmail(normalizedEmail)) {
      toast({ title: "Enter a valid email", description: "Use an email like name@example.com.", variant: "destructive" });
      return;
    }

    const isCreateAccount = mode === "signup";

    // Store pending role for Create Account flow
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
          data: isCreateAccount ? { user_type: selectedRole } : undefined,
        },
      });

      if (error) throw error;

      setMagicLinkSent(true);
      localStorage.setItem("auth_last_email", normalizedEmail);
      toast({ title: "Check your email", description: "We sent you a magic link to sign in." });
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
        <div className="w-full max-w-xl mx-auto space-y-4 relative z-10">
          <Card className="border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-2 text-center">
              <div className="mx-auto inline-flex items-center justify-center w-12 h-12 rounded-full bg-gradient-to-br from-festival-teal/30 to-cyan-400/30 border border-festival-teal/35 text-cyan-300">
                <Mail className="w-6 h-6" />
              </div>
              <CardTitle className="text-xl">Check your email</CardTitle>
              <p className="text-sm text-foreground/80">
                We sent a magic link to <strong className="text-foreground">{email}</strong>. Click it to continue.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="ghost" className="w-full" onClick={() => setMagicLinkSent(false)}>
                Use a different email
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate(returnTo)}>
                Continue browsing
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

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
              {mode === "signin" ? "Sign in with a magic link." : "Pick your role, then enter your email."}
            </p>
          </div>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setIsExitOpen(true)} aria-label="Exit">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-xl border border-festival-teal/45 bg-background/85 p-1 backdrop-blur-xl">
          <Button variant="ghost" className={mode === "signin" ? "bg-festival-teal/28 border border-festival-teal/40 text-foreground hover:bg-festival-teal/34" : "text-foreground/80 hover:text-foreground hover:bg-background/70"} onClick={() => navigate(signInAuthUrl)}>
            Sign in
          </Button>
          <Button variant="ghost" className={mode === "signup" ? "bg-festival-teal/28 border border-festival-teal/40 text-foreground hover:bg-festival-teal/34" : "text-foreground/80 hover:text-foreground hover:bg-background/70"} onClick={() => navigate(signUpAuthUrl)}>
            Create account
          </Button>
        </div>

        {mode === "signin" ? (
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
          <Card className="border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-2">
              <CardTitle className="text-xl">Choose your role</CardTitle>
              <p className="text-sm text-foreground/80">Select a role, then enter your email.</p>
              {import.meta.env.DEV && (
                <Button variant="outline" size="sm" className="border-yellow-500/40 text-yellow-200 hover:bg-yellow-500/20 text-xs" onClick={() => void handleCreateRandomDevAccount("/profile", selectedRole)} disabled={isSubmitting}>
                  ⚡ Instant Dev Login
                </Button>
              )}
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-2 auto-rows-[72px] gap-3">
                {roleOptions.map((role) => {
                  const Icon = role.icon;
                  const isActive = selectedRole === role.value;
                  return (
                    <motion.button whileTap={{ scale: 0.98 }} key={role.value} type="button" className={`w-full text-left rounded-xl border px-4 py-3 transition ${role.bentoClass || ""} ${isActive ? role.activeClass : role.cardClass}`} onClick={() => setSelectedRole(role.value)}>
                      <div className="flex items-center gap-3">
                        <div className={`h-10 w-10 rounded-full border border-white/15 bg-background/60 flex items-center justify-center ${role.iconClass}`}>
                          <Icon className="w-5 h-5" />
                        </div>
                        <p className="font-semibold">{role.label}</p>
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              <div className="space-y-2">
                <Label htmlFor="signup-email">Email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input id="signup-email" type="email" placeholder="you@example.com" className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </div>

              <Button className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95" onClick={handleSendMagicLink} disabled={isSubmitting}>
                {isSubmitting ? "Sending…" : "Send magic link"}
              </Button>
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
