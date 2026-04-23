import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { AuthStepper } from "@/components/auth/AuthStepper";
import { AuthFormProvider } from "@/contexts/AuthFormContext";
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CityPicker } from "@/components/ui/city-picker";
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import GlobalLayout from '@/components/layout/GlobalLayout';

const CreateVideographerProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const preAuthKey = "videographer_pre_auth";
  const returnTo = `${location.pathname}${location.search}`;
  const [step, setStep] = useState(user ? 1 : 0);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickStart, setQuickStart] = useState({
    businessName: "",
    logoUrl: "",
  });
  const [form, setForm] = useState({
    business_name: "",
    photo_url: "",
    city: "",
    bio: "",
    website: "",
    instagram: "",
    facebook: "",
    public_email: "",
    phone: "",
  });

  useEffect(() => {
    if (user && step === 0) {
      setStep(1);
    }
  }, [step, user]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('videographers')
        .select('id')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled || error || !data?.id) return;

      toast({
        title: 'Profile already found',
        description: 'Opening your profile manager.',
      });
      navigate('/profile');
    })();

    return () => {
      cancelled = true;
    };
  }, [navigate, toast, user?.id]);

  useEffect(() => {
    const accountEmail = user?.email?.trim();
    if (!accountEmail) return;

    setForm((prev) => {
      if (prev.public_email.trim().length > 0) return prev;
      return { ...prev, public_email: accountEmail };
    });
  }, [user?.email]);

  useEffect(() => {
    const saved = localStorage.getItem(preAuthKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        businessName?: string;
        logoUrl?: string;
      };

      setQuickStart((prev) => ({
        ...prev,
        businessName: prev.businessName || parsed.businessName || "",
        logoUrl: prev.logoUrl || parsed.logoUrl || "",
      }));

      setForm((prev) => ({
        ...prev,
        business_name: prev.business_name || parsed.businessName || "",
        photo_url: prev.photo_url || parsed.logoUrl || "",
      }));
    } catch {
      // Ignore invalid stored data
    }
  }, [preAuthKey]);

  const submitForm = async () => {
    if (!form.business_name.trim()) {
      toast({
        title: "Business name is required",
        variant: "destructive",
      });
      return;
    }

    const city = normalizeRequiredCity(form.city);
    if (!hasRequiredCity(city)) {
      toast({
        title: "City is required",
        variant: "destructive",
      });
      return;
    }

    const canonicalCity = await resolveCanonicalCity(city);
    if (!canonicalCity) {
      toast({
        title: 'Select a valid city',
        description: 'Please choose your city from the city picker list.',
        variant: 'destructive',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const photoUrls = form.photo_url.trim() ? [form.photo_url.trim()] : null;
      const payload = {
        business_name: form.business_name.trim(),
        photo_url: photoUrls,
        city: canonicalCity.cityName,
        bio: form.bio.trim() || null,
        website: form.website.trim() || null,
        instagram: form.instagram.trim() || null,
        facebook: form.facebook.trim() || null,
        public_email: form.public_email.trim() || null,
        phone: form.phone.trim() || null,
        user_id: user?.id || null,
        verified: false,
      };

      let didUpdate = false;
      if (user?.id) {
        const { data: existing, error: existingError } = await supabase
          .from('videographers')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from('videographers')
            .update(payload)
            .eq('id', existing.id);

          if (updateError) throw updateError;
          didUpdate = true;
        }
      }

      if (!didUpdate) {
        const { error } = await supabase.from("videographers").insert(payload);
        if (error) throw error;
      }

      localStorage.removeItem(preAuthKey);
      toast({
        title: didUpdate ? 'Videographer profile updated' : 'Videographer profile created',
        description: didUpdate ? 'Your latest details are saved.' : 'Welcome to your videographer tools.',
      });

      navigate("/profile");
    } catch (error: any) {
      toast({
        title: "Unable to create profile",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      setPendingSubmit(true);
      setStep(2);
      return;
    }

    await submitForm();
  };

  useEffect(() => {
    if (user && pendingSubmit) {
      setPendingSubmit(false);
      void submitForm();
    }
  }, [pendingSubmit, user]);

  const hasUnsavedProgress = useMemo(() => {
    return Object.values(quickStart).some((value) => value.trim().length > 0)
      || Object.values(form).some((value) => value.trim().length > 0);
  }, [form, quickStart]);

  useUnsavedChangesGuard({ enabled: hasUnsavedProgress && !isSubmitting });

  const handleQuickStartContinue = () => {
    localStorage.setItem(preAuthKey, JSON.stringify(quickStart));
    setForm((prev) => ({
      ...prev,
      business_name: prev.business_name || quickStart.businessName,
      photo_url: prev.photo_url || quickStart.logoUrl,
    }));
    setStep(1);
    window.scrollTo(0, 0);
  };

  const fillMockData = () => {
    const mockQuickStart = {
      businessName: 'Bachata Frame Studio',
      logoUrl: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4',
    };

    const mockForm = {
      business_name: 'Bachata Frame Studio',
      photo_url: 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4',
      city: 'Paris',
      bio: 'Event videography for socials, workshops, and performance teams.',
      website: 'https://bachataframe.example.com',
      instagram: '@bachataframe',
      facebook: 'facebook.com/bachataframe',
      public_email: 'hello@bachataframe.example.com',
      phone: '+33 6 12 34 56 78',
    };

    setQuickStart(mockQuickStart);
    setForm(mockForm);

    toast({
      title: 'Mock data loaded',
      description: 'Development sample values have been filled in.',
    });
  };

  return (
    <GlobalLayout breadcrumbs={[{ label: 'Create videographer profile' }]} backHref='/profile?role=videographer'>
    <div className="px-4 pb-24">
      <div className="max-w-2xl mx-auto">
        {import.meta.env.DEV && (
          <div className="mb-4 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={fillMockData}>
              Fill mock data
            </Button>
          </div>
        )}

        {step === 0 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Quick Start</h1>
              <p className="text-muted-foreground">Optional details to set you up faster.</p>
            </div>

            <Card>
              <CardHeader>
                <CardTitle>Tell us a little more</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Business name (optional)</Label>
                  <Input
                    value={quickStart.businessName}
                    onChange={(e) => setQuickStart({ ...quickStart, businessName: e.target.value })}
                    placeholder="Studio or brand name"
                  />
                </div>
                <div>
                  <Label>Logo URL (optional)</Label>
                  <Input
                    value={quickStart.logoUrl}
                    onChange={(e) => setQuickStart({ ...quickStart, logoUrl: e.target.value })}
                    placeholder="https://..."
                  />
                </div>
              </CardContent>
            </Card>

            <Button className="w-full" onClick={handleQuickStartContinue}>
              Continue
            </Button>
          </div>
        )}

        {step === 1 && (
          <>
            <div className="mb-6">
              <h1 className="text-2xl font-bold">Create Videographer Profile</h1>
              <p className="text-muted-foreground">Set up your public videographer profile.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Business name</Label>
                    <Input
                      value={form.business_name}
                      onChange={(e) => setForm({ ...form, business_name: e.target.value })}
                      placeholder="Your videography brand"
                    />
                  </div>
                  <div>
                    <Label>Logo URL</Label>
                    <Input
                      value={form.photo_url}
                      onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <CityPicker
                      value={form.city}
                      onChange={(city) => setForm({ ...form, city })}
                      placeholder="Select city..."
                    />
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <p className="text-xs text-muted-foreground">Mention upcoming events so people can see your plan.</p>
                    <Textarea
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder="Tell clients about your videography style"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Contact & Social</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Website</Label>
                    <Input
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Instagram</Label>
                    <Input
                      value={form.instagram}
                      onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <Label>Facebook</Label>
                    <Input
                      value={form.facebook}
                      onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                      placeholder="facebook.com/name"
                    />
                  </div>
                  <div>
                    <Label>Public contact email</Label>
                    <Input
                      value={form.public_email}
                      onChange={(e) => setForm({ ...form, public_email: e.target.value })}
                      placeholder="you@example.com"
                    />
                  </div>
                  <div>
                    <Label>Phone</Label>
                    <Input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="+44"
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/profile")}>Cancel</Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? "Creating..." : "Create Profile"}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Finish your profile</h1>
              <p className="text-muted-foreground">Sign in or create an account to publish your videographer profile.</p>
            </div>

            <div className="flex justify-center">
              <AuthFormProvider>
                <AuthStepper
                  returnTo={returnTo}
                  userType="videographer"
                  onAuthenticated={() => setPendingSubmit(true)}
                  showIntentSelect={false}
                  initialIntent="returning"
                  title="Quick finish"
                  subtitle="Sign in to publish."
                    prefilledEmail={form.public_email.trim() || undefined}
                  skipEmailStepWhenPrefilled
                  requireSignupDetails={false}
                />
              </AuthFormProvider>
            </div>

            <Button variant="outline" className="w-full" onClick={() => setStep(1)}>
              Back to profile
            </Button>
          </div>
        )}
      </div>
    </div>
    </GlobalLayout>
  );
};

export default CreateVideographerProfile;
