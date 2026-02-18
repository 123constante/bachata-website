import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Textarea } from '@/components/ui/textarea';
import { ExperiencePicker } from '@/components/profile/ExperiencePicker';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FestivalPlansPicker } from '@/components/profile/FestivalPlansPicker';
import { NationalityPicker } from '@/components/ui/nationality-picker';
import { CityPicker } from '@/components/ui/city-picker';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { normalizePhotoValue, parsePartnerDetails, serializePartnerDetails, serializePhotoValue } from '@/lib/utils';
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';

const DANCE_STYLES = ['Sensual', 'Moderna', 'Dominicana', 'Traditional', 'Fusion'];
const PARTNER_ROLES = ['Leader', 'Follower', 'Both'];
const SEARCH_ROLES = ['Leader', 'Follower', 'Both'];
const LEVELS = ['Beginner', 'Improver', 'Intermediate', 'Advanced', 'Professional'];
const GOALS = ['Social Dancing', 'Drills & Technique', 'Choreography', 'Competition', 'Teaching Prep'];


interface DancerData {
  id: string;
  first_name: string;
  surname: string | null;
  city: string | null;
  nationality: string | null;
  years_dancing: string | null;
  dancing_start_date: string | null;
  favorite_styles: string[] | null;
  partner_role: string | null;
  looking_for_partner: boolean | null;
  instagram: string | null;
  facebook: string | null;

  photo_url: string | string[] | null;
  achievements: string[] | null;
  favorite_songs: string[] | null;
  partner_search_role: string | null;
  partner_search_level: string[] | null;
  partner_practice_goals: string[] | null;
  partner_details: Record<string, unknown> | string | null;
  festival_plans: string[] | null;
  website: string | null;
}

const EditProfile = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [dancerId, setDancerId] = useState<string | null>(null);
  const [initialFormSnapshot, setInitialFormSnapshot] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    first_name: '',
    surname: '',
    city: '',
    nationality: '',
    years_dancing: '',
    dancing_start_date: '',
    favorite_styles: [] as string[],
    partner_role: '',
    looking_for_partner: false,
    instagram: '',
    facebook: '',
    photo_url: '',
    achievements: [] as string[],
    favorite_songs: [] as string[],
    partner_search_role: '',
    partner_search_level: [] as string[],
    partner_practice_goals: [] as string[],
    partner_details: '',
    festival_plans: [] as string[],
    website: '',
  });

  const [newAchievement, setNewAchievement] = useState('');
  const [newSong, setNewSong] = useState('');

  const isValidDateString = (value?: string | null) => {
    if (!value) return true;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  };

  useEffect(() => {
    const fetchDancerData = async () => {
      // User is guaranteed by AuthGuard
      if (!user) return;
      
      setIsLoading(true);
      try {
        const { data, error } = await supabase
          .from('dancers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();

        if (error) throw error;

        if (data) {
          const loadedForm = {
            first_name: data.first_name || '',
            surname: data.surname || '',
            city: data.city || '',
            nationality: data.nationality || '',
            years_dancing: data.years_dancing || '',
            dancing_start_date: data.dancing_start_date || '',
            favorite_styles: data.favorite_styles || [],
            partner_role: data.partner_role || '',
            looking_for_partner: data.looking_for_partner || false,
            instagram: data.instagram || '',
            facebook: data.facebook || '',
            photo_url: normalizePhotoValue(data.photo_url),
            achievements: data.achievements || [],
            favorite_songs: data.favorite_songs || [],
            partner_search_role: data.partner_search_role || '',
            partner_search_level: data.partner_search_level || [],
            partner_practice_goals: data.partner_practice_goals || [],
            partner_details: parsePartnerDetails(data.partner_details as any),
            festival_plans: (Array.isArray(data.festival_plans) ? data.festival_plans : []) as string[],
            website: data.website || '',
          };

          setDancerId(data.id);
          setForm(loadedForm);
          setInitialFormSnapshot(JSON.stringify(loadedForm));
        }
      } catch (error) {
        console.error('Error fetching dancer data:', error);
        toast({
          title: 'Error loading profile',
          description: 'Could not load your profile data.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchDancerData();
  }, [user, toast]);

  const handleSave = async () => {
    if (!dancerId) return;

    const city = normalizeRequiredCity(form.city);
    if (!hasRequiredCity(city)) {
      toast({
        title: 'City is required',
        description: 'Please add your city before saving.',
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

    if (!isValidDateString(form.dancing_start_date)) {
      toast({
        title: 'Invalid date',
        description: 'Please choose a valid dance start date.',
        variant: 'destructive',
      });
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from('dancers')
        .update({
          first_name: form.first_name,
          surname: form.surname || null,
          city: canonicalCity.cityName,
          nationality: form.nationality || null,
          dancing_start_date: form.dancing_start_date || null,
          favorite_styles: form.favorite_styles.length > 0 ? form.favorite_styles : null,
          partner_role: form.partner_role || null,
          looking_for_partner: form.looking_for_partner,
          instagram: form.instagram || null,
          facebook: form.facebook || null,
          achievements: form.achievements.length > 0 ? form.achievements : null,
          favorite_songs: form.favorite_songs.length > 0 ? form.favorite_songs : null,
          partner_search_role: form.partner_search_role || null,
          partner_search_level: form.partner_search_level || null,
          website: form.website || null,
          partner_practice_goals: form.partner_practice_goals || null,
          photo_url: serializePhotoValue(form.photo_url),
          partner_details: serializePartnerDetails(form.partner_details) as any,
          festival_plans: form.festival_plans.length > 0 ? form.festival_plans : null,
        })
        .eq('id', dancerId);

      if (error) throw error;

      toast({
        title: 'Profile saved',
        description: 'Your changes have been saved.',
      });
      setInitialFormSnapshot(JSON.stringify(form));
      navigate('/profile');
    } catch (error: any) {
      toast({
        title: 'Error saving',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStyle = (style: string) => {
    setForm(prev => ({
      ...prev,
      favorite_styles: prev.favorite_styles.includes(style)
        ? prev.favorite_styles.filter(s => s !== style)
        : [...prev.favorite_styles, style],
    }));
  };

  const addAchievement = () => {
    if (newAchievement.trim()) {
      setForm(prev => ({
        ...prev,
        achievements: [...prev.achievements, newAchievement.trim()],
      }));
      setNewAchievement('');
    }
  };

  const removeAchievement = (index: number) => {
    setForm(prev => ({
      ...prev,
      achievements: prev.achievements.filter((_, i) => i !== index),
    }));
  };

  const addSong = () => {
    if (newSong.trim()) {
      setForm(prev => ({
        ...prev,
        favorite_songs: [...prev.favorite_songs, newSong.trim()],
      }));
      setNewSong('');
    }
  };

  const removeSong = (index: number) => {
    setForm(prev => ({
      ...prev,
      favorite_songs: prev.favorite_songs.filter((_, i) => i !== index),
    }));
  };

  const hasUnsavedProgress = useMemo(() => {
    if (isLoading || !initialFormSnapshot) return false;
    return JSON.stringify(form) !== initialFormSnapshot
      || newAchievement.trim().length > 0
      || newSong.trim().length > 0;
  }, [form, initialFormSnapshot, isLoading, newAchievement, newSong]);

  useUnsavedChangesGuard({ enabled: hasUnsavedProgress && !isSaving });

  if (isLoading) {
    return (
      <div className='min-h-screen pt-[85px] pb-24 px-3'>
        <div className='max-w-lg mx-auto space-y-4'>
          <Skeleton className='h-8 w-32' />
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-40 w-full' />
          <Skeleton className='h-40 w-full' />
        </div>
      </div>
    );
  }

  if (!dancerId) {
    return (
      <div className='min-h-screen pt-[85px] pb-24 px-3 flex items-center justify-center'>
        <div className='text-center'>
          <p className='text-muted-foreground mb-4'>No dancer profile found</p>
          <Button onClick={() => navigate('/create-dancers-profile')}>
            Create Profile
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className='min-h-screen pt-[85px] pb-24 px-3'>
      <div className='max-w-lg mx-auto'>
        {/* Header */}
        <div className='flex items-center justify-between mb-4'>
          <button
            onClick={() => navigate('/profile')}
            className='flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground'
          >
            <ArrowLeft className='w-4 h-4' />
            Back
          </button>
          <Button
            size='sm'
            onClick={handleSave}
            disabled={isSaving}
            className='gap-1'
          >
            {isSaving ? (
              <Loader2 className='w-3.5 h-3.5 animate-spin' />
            ) : (
              <Save className='w-3.5 h-3.5' />
            )}
            Save
          </Button>
        </div>

        <h1 className='text-lg font-semibold mb-4'>Edit Profile</h1>

        <div className='space-y-5'>
          {/* Personal Information */}
          <section className='bg-card border border-border rounded-lg p-3'>
            <h2 className='text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide'>
              Personal Info
            </h2>
            <div className='space-y-3'>
              <div>
                <label className='text-xs text-muted-foreground mb-1 block'>First Name</label>
                <Input
                  value={form.first_name}
                  onChange={(e) => setForm({ ...form, first_name: e.target.value })}
                  placeholder='First Name'
                  className='h-9 text-sm'
                />
              </div>
              <div>
                 <label className='text-xs text-muted-foreground mb-1 block'>Surname</label>
                 <Input
                  value={form.surname}
                  onChange={(e) => setForm({ ...form, surname: e.target.value })}
                  placeholder='Surname'
                  className='h-9 text-sm'
                />
              </div>
              <div className='grid grid-cols-2 gap-2'>
                <div>
                  <label className='text-xs text-muted-foreground mb-1 block'>City</label>
                  <CityPicker
                    value={form.city}
                    onChange={(city) => setForm({ ...form, city })}
                    placeholder='Select city...'
                    className='h-9 text-sm'
                  />
                </div>
                <div>
                  <label className='text-xs text-muted-foreground mb-1 block'>Nationality</label>
                  <NationalityPicker
                    value={form.nationality}
                    onChange={(value) => setForm({ ...form, nationality: value })}
                    className='h-9 text-sm'
                  />
                </div>
              </div>
              <div>
                <label className='text-xs text-muted-foreground mb-1 block'>Photo URL</label>
                <Input
                  value={form.photo_url}
                  onChange={(e) => setForm({ ...form, photo_url: e.target.value })}
                  placeholder='https://...'
                  className='h-9 text-sm'
                />
              </div>
            </div>
          </section>

          {/* Dance Experience */}
          <section className='bg-card border border-border rounded-lg p-3'>
            <h2 className='text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide'>
              Dance Experience
            </h2>
            <div className='space-y-3'>
              <div>
                 <label className='text-xs text-muted-foreground mb-1 block'>Started Dancing</label>
                 <ExperiencePicker
                    value={form.dancing_start_date}
                    onChange={(date) => setForm({...form, dancing_start_date: date})}
                 />
              </div>
              <div>
                <label className='text-xs text-muted-foreground mb-1.5 block'>Partner Role</label>
                <div className='flex gap-1.5'>
                  {PARTNER_ROLES.map((role) => (
                    <Badge
                      key={role}
                      variant={form.partner_role === role ? 'default' : 'outline'}
                      className='cursor-pointer text-xs px-2 py-0.5'
                      onClick={() => setForm({ ...form, partner_role: role })}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
              <div>
                <label className='text-xs text-muted-foreground mb-1.5 block'>Favorite Styles</label>
                <div className='flex flex-wrap gap-1.5'>
                  {DANCE_STYLES.map((style) => (
                    <Badge
                      key={style}
                      variant={form.favorite_styles.includes(style) ? 'default' : 'outline'}
                      className='cursor-pointer text-xs px-2 py-0.5'
                      onClick={() => toggleStyle(style)}
                    >
                      {style}
                    </Badge>
                  ))}
                </div>
              </div>
              <div className='pt-1'>
                <label className='text-xs text-muted-foreground mb-1.5 block'>Festival Plans</label>
                <FestivalPlansPicker
                  value={form.festival_plans}
                  onChange={(ids) => setForm({ ...form, festival_plans: ids })}
                />
              </div>
            </div>
          </section>

          {/* Partner Search */}
          <section className='bg-card border border-border rounded-lg p-3 space-y-4'>
            <div className='flex items-center justify-between'>
              <div>
                 <h2 className='text-xs font-semibold text-muted-foreground uppercase tracking-wide'>
                  Partner Search
                </h2>
                <span className='text-sm text-muted-foreground'>Show profile in partner finder</span>
              </div>
              <Switch
                checked={form.looking_for_partner || false}
                onCheckedChange={(checked) => setForm({ ...form, looking_for_partner: checked })}
              />
            </div>

            {form.looking_for_partner && (
                <div className='space-y-4 pt-2 border-t border-border'>
                    <div>
                        <label className='text-xs text-muted-foreground mb-1 block'>I'm looking for a...</label>
                        <Select
                            value={form.partner_search_role || ''}
                            onValueChange={(val) => setForm({ ...form, partner_search_role: val })}
                        >
                            <SelectTrigger className="h-9">
                                <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                                {SEARCH_ROLES.map(role => (
                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div>
                        <label className='text-xs text-muted-foreground mb-1.5 block'>Preferred Level(s)</label>
                        <div className='flex flex-wrap gap-1.5'>
                            {LEVELS.map(level => (
                                <Badge
                                    key={level}
                                    variant={(form.partner_search_level || []).includes(level) ? 'default' : 'outline'}
                                    className='cursor-pointer text-xs px-2 py-0.5'
                                    onClick={() => {
                                        const current = form.partner_search_level || [];
                                        const updated = current.includes(level)
                                            ? current.filter(l => l !== level)
                                            : [...current, level];
                                        setForm({ ...form, partner_search_level: updated });
                                    }}
                                >
                                    {level}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className='text-xs text-muted-foreground mb-1.5 block'>Practice Goals</label>
                        <div className='flex flex-wrap gap-1.5'>
                            {GOALS.map(goal => (
                                <Badge
                                    key={goal}
                                    variant={(form.partner_practice_goals || []).includes(goal) ? 'secondary' : 'outline'}
                                    className='cursor-pointer text-xs px-2 py-0.5'
                                    onClick={() => {
                                        const current = form.partner_practice_goals || [];
                                        const updated = current.includes(goal)
                                            ? current.filter(g => g !== goal)
                                            : [...current, goal];
                                        setForm({ ...form, partner_practice_goals: updated });
                                    }}
                                >
                                    {goal}
                                </Badge>
                            ))}
                        </div>
                    </div>

                    <div>
                        <label className='text-xs text-muted-foreground mb-1 block'>Details</label>
                        <Textarea
                            value={form.partner_details || ''}
                            onChange={(e) => setForm({ ...form, partner_details: e.target.value })}
                            placeholder="Describe your availability, goals..."
                            className='text-sm resize-none'
                            rows={3}
                        />
                    </div>
                </div>
            )}
          </section>

          {/* Social & Contact */}
          <section className='bg-card border border-border rounded-lg p-3'>
            <h2 className='text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide'>
              Social & Contact
            </h2>
            <div className='space-y-3'>
              <div>
                <label className='text-xs text-muted-foreground mb-1 block'>Instagram</label>
                <Input
                  value={form.instagram}
                  onChange={(e) => setForm({ ...form, instagram: e.target.value })}
                  placeholder='@username'
                  className='h-9 text-sm'
                />
              </div>
              <div>
                <label className='text-xs text-muted-foreground mb-1 block'>Website</label>
                <Input
                  value={form.website}
                  onChange={(e) => setForm({ ...form, website: e.target.value })}
                  placeholder='https://...'
                  className='h-9 text-sm'
                />
              </div>
              <div>
                <label className='text-xs text-muted-foreground mb-1 block'>Facebook</label>
                <Input
                  value={form.facebook}
                  onChange={(e) => setForm({ ...form, facebook: e.target.value })}
                  placeholder='facebook.com/...'
                  className='h-9 text-sm'
                />
              </div>

            </div>
          </section>

          {/* Achievements */}
          <section className='bg-card border border-border rounded-lg p-3'>
            <h2 className='text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide'>
              Achievements
            </h2>
            <div className='flex gap-1.5 mb-2'>
              <Input
                value={newAchievement}
                onChange={(e) => setNewAchievement(e.target.value)}
                placeholder='Add achievement'
                className='h-8 text-sm flex-1'
                onKeyDown={(e) => e.key === 'Enter' && addAchievement()}
              />
              <Button size='sm' variant='outline' onClick={addAchievement} className='h-8 px-2 text-xs'>
                Add
              </Button>
            </div>
            {form.achievements.length > 0 && (
              <div className='flex flex-wrap gap-1'>
                {form.achievements.map((a, i) => (
                  <Badge key={i} variant='secondary' className='text-xs gap-1 pr-1'>
                    {a}
                    <button onClick={() => removeAchievement(i)} className='ml-1 hover:text-destructive'>&times;</button>
                  </Badge>
                ))}
              </div>
            )}
          </section>

          {/* Favorite Songs */}
          <section className='bg-card border border-border rounded-lg p-3'>
            <h2 className='text-xs font-semibold mb-3 text-muted-foreground uppercase tracking-wide'>
              Favorite Songs
            </h2>
            <div className='flex gap-1.5 mb-2'>
              <Input
                value={newSong}
                onChange={(e) => setNewSong(e.target.value)}
                placeholder='Add song'
                className='h-8 text-sm flex-1'
                onKeyDown={(e) => e.key === 'Enter' && addSong()}
              />
              <Button size='sm' variant='outline' onClick={addSong} className='h-8 px-2 text-xs'>
                Add
              </Button>
            </div>
            {form.favorite_songs.length > 0 && (
              <div className='flex flex-wrap gap-1'>
                {form.favorite_songs.map((s, i) => (
                  <Badge key={i} variant='secondary' className='text-xs gap-1 pr-1'>
                    {s}
                    <button onClick={() => removeSong(i)} className='ml-1 hover:text-destructive'>&times;</button>
                  </Badge>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
};

export default EditProfile;
