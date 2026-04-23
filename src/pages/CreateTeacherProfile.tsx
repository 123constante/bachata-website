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

const CreateTeacherProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const preAuthKey = 'teacher_pre_auth';
  const returnTo = `${location.pathname}${location.search}`;
  const [step, setStep] = useState(user ? 1 : 0);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [quickStart, setQuickStart] = useState({
    stylesTaught: '',
    yearsTeaching: '',
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
        .from('teacher_profiles')
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
    const saved = localStorage.getItem(preAuthKey);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as {
        stylesTaught?: string;
        yearsTeaching?: string;
      };

      if (parsed.stylesTaught && !quickStart.stylesTaught) {
        setQuickStart((prev) => ({ ...prev, stylesTaught: parsed.stylesTaught || '' }));
      }

      if (parsed.yearsTeaching && !quickStart.yearsTeaching) {
        setQuickStart((prev) => ({ ...prev, yearsTeaching: parsed.yearsTeaching || '' }));
      }

      const bioLines: string[] = [];
      if (parsed.stylesTaught) {
        bioLines.push(`Styles taught: ${parsed.stylesTaught}`);
      }
      if (parsed.yearsTeaching) {
        bioLines.push(`Years teaching: ${parsed.yearsTeaching}`);
      }

      setForm((prev) => ({
        ...prev,
        bio: prev.bio || (bioLines.length ? bioLines.join('\n') : ''),
      }));
    } catch {
      // Ignore invalid stored data
    }
  }, [preAuthKey, quickStart.stylesTaught, quickStart.yearsTeaching]);

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
        city: canonicalCity.cityName,
        photo_url: form.avatar_url.trim() || null,
        bio: form.bio.trim() || null,
        user_id: user?.id,
        instagram: form.instagram.trim() || null,
        website: form.website.trim() || null,
      };

      let didUpdate = false;
      if (user?.id) {
        const { data: existing, error: existingError } = await (supabase as any)
          .from('teacher_profiles')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing?.id) {
          const { error: updateError } = await (supabase as any)
            .from('teacher_profiles')
            .update(payload)
            .eq('id', existing.id);

          if (updateError) throw updateError;
          didUpdate = true;
        }
      }

      if (!didUpdate) {
        const { error } = await (supabase as any).from('teacher_profiles').insert(payload);
        if (error) throw error;
      }

      localStorage.removeItem(preAuthKey);
      toast({
        title: didUpdate ? 'Teacher profile updated' : 'Teacher profile created',
        description: didUpdate ? 'Your latest details are saved.' : 'Welcome to your teaching tools.',
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
    const bioLines: string[] = [];
    if (quickStart.stylesTaught) {
      bioLines.push(`Styles taught: ${quickStart.stylesTaught}`);
    }
    if (quickStart.yearsTeaching) {
      bioLines.push(`Years teaching: ${quickStart.yearsTeaching}`);
    }

    setForm((prev) => ({
      ...prev,
      bio: prev.bio || (bioLines.length ? bioLines.join('\n') : ''),
    }));
    setStep(1);
    window.scrollTo(0, 0);
  };

  const fillMockData = () => {
    const mockQuickStart = {
      stylesTaught: 'Bachata Sensual, Dominican Bachata',
      yearsTeaching: '8',
    };

    const mockForm = {
      name: 'Elena Cruz',
      city: 'Madrid',
      avatar_url: 'https://images.unsplash.com/photo-1544717305-2782549b5136',
      bio: 'Bachata instructor focused on musicality, connection, and social confidence.',
      instagram: '@elenacruz.bachata',
      website: 'https://elenacruzdance.example.com',
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
    <GlobalLayout breadcrumbs={[{ label: 'Create teacher profile' }]} backHref='/profile?role=teacher'>
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
                  <Label>Styles taught (optional)</Label>
                  <Input
                    value={quickStart.stylesTaught}
                    onChange={(e) => setQuickStart({ ...quickStart, stylesTaught: e.target.value })}
                    placeholder="Bachata, Salsa"
                  />
                </div>
                <div>
                  <Label>Years teaching (optional)</Label>
                  <Input
                    value={quickStart.yearsTeaching}
                    onChange={(e) => setQuickStart({ ...quickStart, yearsTeaching: e.target.value })}
                    placeholder="5"
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
              <h1 className="text-2xl font-bold">Create Teacher Profile</h1>
              <p className="text-muted-foreground">Set up your public teaching profile.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Basic Details</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Name</Label>
                    <Input
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="Your teacher name"
                    />
                  </div>
                  <div>
                    <Label>City</Label>
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
                      placeholder="Tell students about your classes"
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
              <p className="text-muted-foreground">Sign in or create an account to publish your teacher profile.</p>
            </div>

            <div className="flex justify-center">
              <AuthFormProvider>
                <AuthStepper
                  returnTo={returnTo}
                  userType="teacher"
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

export default CreateTeacherProfile;
