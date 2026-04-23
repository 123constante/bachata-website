import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CityPicker } from '@/components/ui/city-picker';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { AuthFormProvider } from '@/contexts/AuthFormContext';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import GlobalLayout from '@/components/layout/GlobalLayout';

const CreateOrganiserProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const preAuthKey = 'organiser_pre_auth';
  const returnTo = `${location.pathname}${location.search}`;
  const [step, setStep] = useState(user ? 1 : 0);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [quickStart, setQuickStart] = useState({
    primaryVenue: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: '',
    city: '',
    avatar_url: '',
    bio: '',
    instagram: '',
    website: '',
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
      const { data, error } = await (supabase as any)
        .from('entities')
        .select('id, city_id, cities(name)')
        .eq('claimed_by', user.id)
        .eq('type', 'organiser')
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
    const saved = localStorage.getItem(preAuthKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        primaryVenue?: string;
      };

      if (parsed.primaryVenue && !quickStart.primaryVenue) {
        setQuickStart((prev) => ({ ...prev, primaryVenue: parsed.primaryVenue || '' }));
      }

      setForm((prev) => ({
        ...prev,
        name: prev.name || parsed.primaryVenue || '',
        bio: prev.bio || (parsed.primaryVenue ? `Primary venue: ${parsed.primaryVenue}` : ''),
      }));
    } catch {
      // Ignore invalid stored data
    }
  }, [preAuthKey, quickStart.primaryVenue]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    void (async () => {
      const metadata = (user.user_metadata || {}) as Record<string, unknown>;
      const metadataFirstName = typeof metadata.first_name === 'string' ? metadata.first_name.trim() : '';
      const metadataCityId = typeof metadata.city_id === 'string' ? metadata.city_id.trim() : '';
      const metadataCity = typeof metadata.city === 'string' ? metadata.city.trim() : '';

      const { data: ownDancer } = await supabase
        .from('dancer_profiles')
        .select('first_name, based_city_id')
        .eq('created_by', user.id)
        .maybeSingle();

      if (cancelled) return;

      setForm((prev) => ({
        ...prev,
        name: prev.name || ownDancer?.first_name?.trim() || metadataFirstName || '',
        city: prev.city || ownDancer?.based_city_id || metadataCityId || metadataCity || '',
      }));
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.user_metadata]);

  const submitForm = async () => {
    if (!form.name.trim()) {
      toast({
        title: 'Name is required',
        variant: 'destructive',
      });
      return;
    }

    const city = normalizeRequiredCity(form.city);
    if (!hasRequiredCity(city)) {
      toast({
        title: 'City is required',
        variant: 'destructive',
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
      const payload = {
        name: form.name.trim(),
        city_id: canonicalCity.cityId,
        avatar_url: form.avatar_url.trim() || null,
        bio: form.bio.trim() || null,
        claimed_by: user?.id,
        socials: {
          instagram: form.instagram.trim() || null,
          website: form.website.trim() || null,
        },
      };

      let didUpdate = false;
      if (user?.id) {
        const { data: existing, error: existingError } = await (supabase as any)
          .from('entities')
          .select('id, city_id, cities(name)')
          .eq('claimed_by', user.id)
          .eq('type', 'organiser')
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing?.id) {
          const { error: updateError } = await (supabase as any)
            .from('entities')
            .update(payload)
            .eq('id', existing.id)
            .eq('type', 'organiser');

          if (updateError) throw updateError;
          didUpdate = true;
        }
      }

      if (!didUpdate) {
        const { error } = await (supabase as any).from('entities').insert({
          ...payload,
          type: 'organiser',
        });
        if (error) throw error;
      }

      localStorage.removeItem(preAuthKey);
      toast({
        title: didUpdate ? 'Organiser profile updated' : 'Organiser profile created',
        description: didUpdate ? 'Your latest details are saved.' : 'Welcome to your organiser tools.',
      });

      navigate('/profile');
    } catch (error: any) {
      toast({
        title: 'Unable to create profile',
        description: error.message || 'Please try again.',
        variant: 'destructive',
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

  const handleQuickStartContinue = () => {
    localStorage.setItem(preAuthKey, JSON.stringify(quickStart));
    setForm((prev) => ({
      ...prev,
      name: prev.name || quickStart.primaryVenue,
      bio: prev.bio || (quickStart.primaryVenue ? `Primary venue: ${quickStart.primaryVenue}` : ''),
    }));
    setStep(1);
    window.scrollTo(0, 0);
  };

  const fillMockData = () => {
    const mockQuickStart = {
      primaryVenue: 'Sabor Social Nights',
    };

    const mockForm = {
      name: 'Sabor Events London',
      city: 'London',
      avatar_url: 'https://images.unsplash.com/photo-1514525253161-7a46d19cd819',
      bio: 'Weekly bachata socials and monthly workshops across London venues.',
      instagram: '@saboreventslondon',
      website: 'https://saborevents.example.com',
    };

    setQuickStart(mockQuickStart);
    setForm(mockForm);

    toast({
      title: 'Mock data loaded',
      description: 'Development sample values have been filled in.',
    });
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

  return (
    <GlobalLayout breadcrumbs={[{ label: 'Create organiser profile' }]} backHref='/profile?role=organiser'>
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
                  <Label>Primary venue name (optional)</Label>
                  <Input
                    value={quickStart.primaryVenue}
                    onChange={(e) => setQuickStart({ ...quickStart, primaryVenue: e.target.value })}
                    placeholder="Studio or venue"
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
              <h1 className="text-2xl font-bold">Create Organiser Profile</h1>
              <p className="text-muted-foreground">Set up your public organiser page.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <p className="text-xs text-muted-foreground">Public organiser name (can differ from your personal profile).</p>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your organiser or brand name"
                    />
                  </div>
                  <div>
                    <Label>City</Label>
                    <p className="text-xs text-muted-foreground">Used for your organiser listing location.</p>
                    <CityPicker
                      value={form.city}
                      onChange={(city) => setForm({ ...form, city })}
                      placeholder='Select city...'
                    />
                  </div>
                  <div>
                    <Label>Avatar URL</Label>
                    <Input
                      value={form.avatar_url}
                      onChange={(e) => setForm({ ...form, avatar_url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                  <div>
                    <Label>Bio</Label>
                    <p className="text-xs text-muted-foreground">Mention upcoming events so people can see your plan.</p>
                    <Textarea
                      value={form.bio}
                      onChange={(e) => setForm({ ...form, bio: e.target.value })}
                      placeholder="Tell dancers about your events"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Social Links</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Instagram</Label>
                    <Input
                      value={form.instagram}
                      onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                      placeholder="@username"
                    />
                  </div>
                  <div>
                    <Label>Website</Label>
                    <Input
                      value={form.website}
                      onChange={(e) => setForm({ ...form, website: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button type="button" variant="outline" onClick={() => navigate('/profile')}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting ? 'Creating...' : 'Create Profile'}
                </Button>
              </div>
            </form>
          </>
        )}

        {step === 2 && (
          <div className="space-y-6">
            <div className="text-center">
              <h1 className="text-2xl font-bold">Finish your profile</h1>
              <p className="text-muted-foreground">Sign in or create an account to publish your organiser profile.</p>
            </div>

            <div className="flex justify-center">
              <AuthFormProvider>
                <AuthStepper
                  returnTo={returnTo}
                  userType="organiser"
                  onAuthenticated={() => setPendingSubmit(true)}
                  showIntentSelect={false}
                  initialIntent="returning"
                  title="Quick finish"
                  subtitle="Sign in to publish."
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

export default CreateOrganiserProfile;
