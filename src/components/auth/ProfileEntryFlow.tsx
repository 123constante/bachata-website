import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Sparkles, Sun, Calendar, GraduationCap, Music, Camera, ShoppingBag } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { ensureDancerProfile } from "@/lib/ensureDancerProfile";
import { AuthStepper } from "@/components/auth/AuthStepper";
import { AuthFormProvider } from "@/contexts/AuthFormContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ProfileEntryFlowProps = {
  returnTo?: string;
  userType?: string | null;
  mode?: string | null;
  heroTitle?: string;
  heroSubtitle?: string;
  showSignedInCard?: boolean;
  storageKey?: string;
  className?: string;
};

type EntryRole = "dancer" | "vendor" | "organiser" | "teacher" | "dj" | "videographer";

export const ProfileEntryFlow = ({
  returnTo = "/",
  userType,
  mode,
  heroTitle,
  heroSubtitle,
  showSignedInCard = true,
  storageKey = "profile_entry_flow",
  className = "",
}: ProfileEntryFlowProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [path, setPath] = useState<"returning" | "new" | null>(null);
  const [selectedRole, setSelectedRole] = useState<EntryRole>("dancer");

  const resolvedUserType = ["dancer", "vendor", "organiser", "teacher", "dj", "videographer"].includes(userType || "")
    ? (userType as EntryRole)
    : undefined;

  const roleOptions = [
    {
      label: "Dancer",
      description: "Find classes, partners, and events.",
      route: "/create-dancers-profile",
      icon: Sparkles,
      value: "dancer" as const,
    },
    {
      label: "Organiser",
      description: "Publish events and manage tickets.",
      route: "/create-organiser-profile",
      icon: Calendar,
      value: "organiser" as const,
    },
    {
      label: "Teacher",
      description: "List workshops and classes.",
      route: "/create-teacher-profile",
      icon: GraduationCap,
      value: "teacher" as const,
    },
    {
      label: "DJ",
      description: "Showcase mixes and gigs.",
      route: "/create-dj-profile",
      icon: Music,
      value: "dj" as const,
    },
    {
      label: "Videographer",
      description: "Share work and get booked.",
      route: "/create-videographer-profile",
      icon: Camera,
      value: "videographer" as const,
    },
  ];

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        step?: number;
        path?: "returning" | "new" | null;
        role?: EntryRole;
      };
      if (typeof parsed.step === "number") setStep(parsed.step);
      if (parsed.path) setPath(parsed.path);
      if (parsed.role) setSelectedRole(parsed.role);
    } catch {
      // Ignore invalid data
    }
  }, [storageKey]);

  useEffect(() => {
    const payload = {
      step,
      path,
      role: selectedRole,
    };
    localStorage.setItem(storageKey, JSON.stringify(payload));
  }, [step, path, selectedRole, storageKey]);

  useEffect(() => {
    if (resolvedUserType) {
      setSelectedRole(resolvedUserType);
    }
  }, [resolvedUserType]);

  useEffect(() => {
    if (mode === "signin") {
      setPath("returning");
      setStep(1);
    }
  }, [mode]);

  const progressValue = useMemo(() => {
    const maxSteps = path === "returning" ? 2 : 3;
    return Math.min(100, Math.round(((step + 1) / maxSteps) * 100));
  }, [path, step]);

  const handleRoleContinue = async () => {
    const next = roleOptions.find((role) => role.value === selectedRole);
    if (!next) return;

    if (selectedRole !== "dancer" && user?.id) {
      const metadata = (user.user_metadata || {}) as Record<string, unknown>;
      const metadataFirstName = typeof metadata.first_name === "string" ? metadata.first_name : null;
      const metadataCity = typeof metadata.city === "string" ? metadata.city : null;

      try {
        await ensureDancerProfile({
          userId: user.id,
          email: user.email || null,
          firstName: metadataFirstName,
          city: metadataCity,
        });
      } catch {
        // Continue to destination; role pages can retry if needed.
      }
    }

    localStorage.setItem("profile_entry_role", selectedRole);
    navigate(next.route);
  };

  if (user && showSignedInCard) {
    return (
      <div className={`auth-bright min-h-screen relative overflow-hidden ${className}`.trim()}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_55%)]" />
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-festival-teal/30 blur-3xl" />
        <div className="absolute bottom-0 left-0 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />

        <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-16">
          <Card className="w-full max-w-md rounded-2xl border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
            <CardHeader className="space-y-2">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-festival-teal/18 border border-festival-teal/35 text-cyan-300">
                <Sun className="w-6 h-6" />
              </div>
              <CardTitle className="text-2xl auth-display">You are already in</CardTitle>
              <p className="text-sm text-muted-foreground">Let’s keep going.</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button className="w-full h-11 font-semibold bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95" onClick={() => navigate("/profile")}>
                Go to my profile
              </Button>
              <Button variant="outline" className="w-full h-11 font-semibold border-festival-teal/35 bg-background/60 hover:bg-festival-teal/12" onClick={() => navigate(returnTo)}>
                Continue browsing
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={`auth-bright min-h-screen relative overflow-hidden ${className}`.trim()}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(34,211,238,0.18),_transparent_55%)]" />
      <div className="absolute -top-20 -right-24 h-72 w-72 rounded-full bg-festival-teal/30 blur-3xl" />
      <div className="absolute bottom-0 left-0 h-80 w-80 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="absolute top-16 left-10 h-40 w-40 rounded-full bg-sky-400/20 blur-2xl" />

      <div className="relative z-10 min-h-screen px-4 py-16 flex items-center justify-center">
        <div className="w-full max-w-lg space-y-6">
          {heroTitle && (
            <div className="text-center space-y-3">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-amber-100 text-amber-600">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="space-y-2">
                <h1 className="text-3xl auth-display">{heroTitle}</h1>
                {heroSubtitle && <p className="text-sm text-muted-foreground">{heroSubtitle}</p>}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>Quick setup</span>
            <span>{Math.round(progressValue)}% ready</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/20 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-festival-teal to-cyan-400" style={{ width: `${progressValue}%` }} />
          </div>

          <AnimatePresence mode="wait">
            {step === 0 && (
              <motion.div
                key="path"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6"
              >
                <Card className="rounded-2xl border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
                  <CardHeader className="space-y-3">
                    <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-festival-teal/18 border border-festival-teal/35 text-cyan-300">
                      <Sparkles className="w-6 h-6" />
                    </div>
                    <CardTitle className="text-3xl auth-display">Ready to move?</CardTitle>
                    <p className="text-sm text-muted-foreground">Tell us if you are new or returning.</p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <Button
                      className="w-full h-11 font-semibold bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95"
                      onClick={() => {
                        setPath("returning");
                        setStep(1);
                      }}
                    >
                      I already have an account
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full h-11 font-semibold border-festival-teal/35 bg-background/60 hover:bg-festival-teal/12"
                      onClick={() => {
                        setPath("new");
                        setStep(1);
                      }}
                    >
                      I need an account
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            )}

            {step === 1 && path === "returning" && (
              <motion.div
                key="returning"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6"
              >
                <Card className="rounded-2xl border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-2xl auth-display">Welcome back</CardTitle>
                    <p className="text-sm text-muted-foreground">Log in with two quick steps.</p>
                  </CardHeader>
                  <CardContent>
                    <AuthFormProvider>
                      <AuthStepper
                        userType={resolvedUserType}
                        returnTo={returnTo}
                        initialIntent="returning"
                        showIntentSelect={false}
                        title="Log in"
                        subtitle="Fast, simple, and private."
                      />
                    </AuthFormProvider>
                  </CardContent>
                </Card>
                <Button variant="ghost" className="w-full" onClick={() => setStep(0)}>
                  Change path
                </Button>
              </motion.div>
            )}

            {step === 1 && path === "new" && (
              <motion.div
                key="role"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                className="space-y-6"
              >
                <Card className="rounded-2xl border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
                  <CardHeader className="space-y-2">
                    <CardTitle className="text-2xl auth-display">Choose your role</CardTitle>
                    <p className="text-sm text-muted-foreground">You can always switch later.</p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-3">
                      {roleOptions.map((role) => {
                        const Icon = role.icon;
                        const isActive = selectedRole === role.value;
                        return (
                          <button
                            key={role.label}
                            type="button"
                            className={`w-full text-left rounded-xl border px-4 py-3 backdrop-blur-sm transition ${isActive ? "border-cyan-300/85 bg-festival-teal/25" : "border-festival-teal/35 bg-background/65 hover:bg-festival-teal/12"}`}
                            onClick={() => setSelectedRole(role.value)}
                          >
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 rounded-full bg-festival-teal/18 border border-festival-teal/35 text-cyan-300 flex items-center justify-center">
                                <Icon className="w-5 h-5" />
                              </div>
                              <div>
                                <p className="font-semibold">{role.label}</p>
                                <p className="text-xs text-muted-foreground">{role.description}</p>
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                    <Button className="w-full h-11 font-semibold bg-gradient-to-r from-festival-teal to-cyan-400 text-black hover:opacity-95" onClick={() => void handleRoleContinue()}>
                      Start my profile
                    </Button>
                    <p className="text-xs text-muted-foreground">We will save your progress on this device.</p>
                  </CardContent>
                </Card>
                <Button variant="ghost" className="w-full" onClick={() => setStep(0)}>
                  Change path
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
};
