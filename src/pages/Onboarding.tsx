import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { MapPin, User } from "lucide-react";

const VALID_ROLES: Record<string, string> = {
  organiser: "/create-organiser-profile",
  teacher: "/create-teacher-profile",
  dj: "/create-dj-profile",
  videographer: "/create-videographer-profile",
  vendor: "/create-vendor-profile",
};

const Onboarding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, isLoading } = useAuth();
  const { toast } = useToast();
  const [firstName, setFirstName] = useState("");
  const [city, setCity] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const fallbackReason = searchParams.get("authFallback");
    if (!fallbackReason) return;

    const fallbackMessages: Record<string, string> = {
      timeout: "We couldn't finish sign-in in time. Complete onboarding to continue.",
      profile: "We couldn't auto-create your profile yet. Complete onboarding to continue.",
      metadata: "A few account details are still missing. Complete onboarding to continue.",
      lookup: "We couldn't load your profile details. Complete onboarding to continue.",
    };

    toast({
      title: "Finish setup",
      description: fallbackMessages[fallbackReason] || "Complete onboarding to continue.",
    });
  }, [searchParams, toast]);

  if (isLoading || !user) {
    return (
      <div className="min-h-screen pt-20 px-4">
        <div className="max-w-md mx-auto space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const handleSubmit = async () => {
    const trimmedFirst = firstName.trim();
    const trimmedCity = city.trim();

    if (!trimmedFirst) {
      toast({ title: "First name required", description: "Enter your first name to continue.", variant: "destructive" });
      return;
    }
    if (!trimmedCity) {
      toast({ title: "City required", description: "Enter your city to continue.", variant: "destructive" });
      return;
    }

    setIsSubmitting(true);
    try {
      // Duplicate protection: check if dancer already exists
      const { data: existing } = await supabase
        .from("dancers")
        .select("id")
        .eq("user_id", user.id)
        .maybeSingle();

      if (!existing?.id) {
        // Resolve city_id from city name
        const { data: cityRow } = await supabase
          .from("cities")
          .select("id")
          .ilike("name", trimmedCity)
          .maybeSingle();

        const cityId = cityRow?.id;
        if (!cityId) {
          toast({ title: "City not found", description: "Please enter a valid city name (e.g. London, Paris).", variant: "destructive" });
          setIsSubmitting(false);
          return;
        }

        const { error: insertError } = await supabase.from("dancers").insert({
          user_id: user.id,
          first_name: trimmedFirst,
          city: trimmedCity,
          city_id: cityId,
          verified: false,
          is_public: false,
          hide_surname: false,
        });

        if (insertError) throw insertError;
      }

      // 1. Read pendingRole
      const pendingRole = localStorage.getItem("pending_profile_role");

      // 2. Decide route + 3. Navigate
      if (pendingRole && pendingRole !== "dancer" && VALID_ROLES[pendingRole]) {
        navigate(`/create-${pendingRole}-profile`, { replace: true });
      } else {
        navigate("/profile", { replace: true });
      }

      // 4. Clear AFTER navigate
      localStorage.removeItem("pending_profile_role");
      localStorage.removeItem("profile_entry_role");
      localStorage.removeItem("auth_signup_draft_v1");
      localStorage.removeItem("auth_last_email");
      localStorage.removeItem("profile_last_active_role");
    } catch (err: any) {
      console.error("Onboarding insert failed:", err);
      toast({ title: "Something went wrong", description: err?.message || "Please try again.", variant: "destructive" });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen pt-[95px] pb-24 px-4 relative overflow-hidden">
      <div className="pointer-events-none absolute top-10 -left-20 h-64 w-64 rounded-full bg-festival-teal/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="w-full max-w-md mx-auto relative z-10">
        <Card className="border-festival-teal/45 bg-background/88 backdrop-blur-xl shadow-2xl">
          <CardHeader className="space-y-2">
            <CardTitle className="text-xl">Complete your profile</CardTitle>
            <p className="text-sm text-foreground/80">
              Tell us a bit about yourself to get started.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="onboarding-first-name">First name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="onboarding-first-name"
                  type="text"
                  placeholder="Maria"
                  className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoFocus
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="onboarding-city">City</Label>
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  id="onboarding-city"
                  type="text"
                  placeholder="London"
                  className="pl-10 bg-background/70 border-primary/20 focus-visible:ring-festival-teal/40"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                />
              </div>
            </div>

            <Button
              className="w-full bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95"
              onClick={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Setting up..." : "Continue"}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Onboarding;
