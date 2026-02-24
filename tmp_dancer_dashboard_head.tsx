import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Instagram, Facebook, PartyPopper, Pencil
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';

import { useToast } from '@/hooks/use-toast';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { CityPicker } from '@/components/ui/city-picker';
import { ExperiencePicker } from '@/components/profile/ExperiencePicker';
import { FestivalPlansPicker } from '@/components/profile/FestivalPlansPicker';
import { useCity } from '@/contexts/CityContext';
import { getPhotoUrl, serializePartnerDetails, parsePartnerDetails, type PartnerDetailsValue } from '@/lib/utils';
import { buildFullName, normalizeDancerRecord, normalizeUserMetadata } from '@/lib/name-utils';
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import {
  FAVORITE_STYLE_OPTIONS,
  PARTNER_PRACTICE_GOAL_OPTIONS,
  PARTNER_ROLE_OPTIONS,
  PARTNER_SEARCH_LEVEL_OPTIONS,
  PARTNER_SEARCH_ROLE_OPTIONS,
} from '@/components/profile/dancerConstants';

interface DancerProfile {
  id: string;
  first_name: string;
  surname: string | null;
  
  city: string | null;
  nationality: string | null;
  favorite_styles: string[] | null;
  years_dancing?: string | null;
  dancing_start_date: string | null;
  photo_url: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp?: string | null;
  website: string | null;
  looking_for_partner: boolean | null;
  partner_role: string | null;
  achievements: string[] | null;
  favorite_songs: string[] | null;
  partner_search_role: string | null;
  partner_search_level: string[] | null;
  partner_practice_goals: string[] | null;
  partner_details: Json | null;
  gallery_urls?: string[] | null;
  festival_plans: string[] | null;
  hide_surname?: boolean | null;
  verified: boolean;
}

interface NextEvent {
  id: string;
  name: string;
  date: string;
}

interface TicketEvent {
  id: string;
  name: string;
  date: string;
  location?: string | null;
  image_url?: string | null;
}

interface EventCounts {
  going: number;
  interested: number;
}

interface EditFormData {
  first_name: string;
  surname: string;
  city: string;
  nationality: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  website: string;
  years_dancing: string;
  dancing_start_date: string;
  partner_role: string;
  achievements: string[];
  favorite_songs: string[];
  partner_search_role: string;
  partner_search_level: string[];
  partner_practice_goals: string[];
  partner_details: string;
  gallery_urls: string[];
  favorite_styles: string[];
  looking_for_partner: boolean;
  photo_url: string;
  festival_plans: string[];
}

import { calculateDuration } from '@/components/profile/ExperiencePicker';

const normalizePartnerRole = (value?: string | null) => {
  const normalized = (value || '').trim().toLowerCase();
  if (!normalized) return '';
  if (normalized === 'lead' || normalized === 'leader') return 'Leader';
  if (normalized === 'follow' || normalized === 'follower') return 'Follower';
  if (normalized === 'both') return 'Both';
  return '';
};

const normalizeSocialUrl = (kind: 'instagram' | 'facebook' | 'website', value: string) => {
  const trimmed = value.trim();
  if (!trimmed) return '';

  if (kind === 'instagram') {
    const withoutAt = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
    if (!withoutAt.includes('/') && !withoutAt.includes('.') && !withoutAt.startsWith('http://') && !withoutAt.startsWith('https://')) {
      return `https://instagram.com/${withoutAt}`;
    }
    if (!withoutAt.startsWith('http://') && !withoutAt.startsWith('https://')) {
      return `https://${withoutAt}`;
    }
    return withoutAt;
  }

  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) {
    return `https://${trimmed}`;
  }
  return trimmed;
};

type DashboardTab = 'overview' | 'activity' | 'engagement' | 'profile' | 'settings';
type TileStatus = 'live' | 'attention';
type DancerProgressKey = 'identity' | 'media' | 'activity' | 'engagement' | 'social';

type ModuleSlot = {
  tab: DashboardTab;
  title: string;
  description: string;
  colSpan: '12' | '8' | '6' | '4';
  rowSpan?: '1' | '2';
  status: TileStatus;
  actionLabel: string;
  mobileActionLabel?: string;
  onAction: () => void;
  disabled?: boolean;
};

type EditingSection = 'identity' | 'career' | 'partner' | 'social' | 'festivals';

const spanClass = (slot: Pick<ModuleSlot, 'colSpan' | 'rowSpan'>) => {
  const colMap: Record<ModuleSlot['colSpan'], string> = {
    '12': 'col-span-4 sm:col-span-8 lg:col-span-12',
    '8': 'col-span-4 sm:col-span-8 lg:col-span-8',
    '6': 'col-span-2 sm:col-span-4 lg:col-span-6',
    '4': 'col-span-2 sm:col-span-4 lg:col-span-4',
  };

  const rowClass = slot.rowSpan === '2' ? 'lg:row-span-2' : '';
  return `${colMap[slot.colSpan]} ${rowClass}`.trim();
};

const tileStatusTone: Record<TileStatus, string> = {
  live: 'border-emerald-500/30 bg-emerald-500/5',
  attention: 'border-amber-500/30 bg-amber-500/5',
};

export const DancerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { citySlug } = useCity();
  const [dancerProfile, setDancerProfile] = useState<DancerProfile | null>(null);
  const [nextEvent, setNextEvent] = useState<NextEvent | null>(null);
  const [confirmedEvents, setConfirmedEvents] = useState<TicketEvent[]>([]);
  const [eventCounts, setEventCounts] = useState<EventCounts>({ going: 0, interested: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [isTogglingPartner, setIsTogglingPartner] = useState(false);

  const [editingSection, setEditingSection] = useState<EditingSection | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>({
    first_name: '',
    surname: '',
    city: '',
    nationality: '',
    instagram: '',
    facebook: '',
    whatsapp: '',
    website: '',
    years_dancing: '',
    dancing_start_date: '',
    partner_role: '',
    achievements: [],
    favorite_songs: [],
    partner_search_role: '',
    partner_search_level: [],
    partner_practice_goals: [],
    partner_details: '',
    gallery_urls: [],
    favorite_styles: [],
    looking_for_partner: false,
    photo_url: '',
    festival_plans: [],
  });
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');
  const [newFavoriteSong, setNewFavoriteSong] = useState('');
  const [newAchievement, setNewAchievement] = useState('');
  const [newFestivalPlan, setNewFestivalPlan] = useState('');
  const [newGalleryUrl, setNewGalleryUrl] = useState('');

  const isValidDateString = (value?: string | null) => {
    if (!value) return true;
    const parsed = new Date(value);
    return !Number.isNaN(parsed.getTime());
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;
      
      setIsLoading(true);
      try {
        const { data: dancer } = await supabase
          .from('dancers')
          .select('*')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (dancer) {
          const normalized = normalizeDancerRecord(dancer);
          setDancerProfile({
            ...normalized,
            photo_url: getPhotoUrl(normalized.photo_url) || '',
            festival_plans: Array.isArray(normalized.festival_plans)
              ? normalized.festival_plans.filter((item): item is string => typeof item === 'string')
              : [],
          });
        }

        if (!user.email) {
          setEventCounts({ going: 0, interested: 0 });
          setConfirmedEvents([]);
          setNextEvent(null);
          return;
        }

        const { data: participations } = await supabase.rpc(
          'get_user_participant_events',
          {
            p_user_email: user.email,
            p_city_slug: citySlug,
          }
        );

        if (participations) {
          const going = participations.filter((p: any) => p.status === 'going').length;
          const interested = participations.filter((p: any) => p.status === 'interested').length;
          setEventCounts({ going, interested });

          const now = new Date();
          const upcomingEventsData = participations
            .filter((p: any) => {
              const dateValue = p.event_date || p.date || p.instance_date;
              return dateValue && new Date(dateValue) > now && p.status === 'going';
            })
            .map((p: any) => ({
              id: p.event_id || p.id,
              name: p.event_name || p.name,
              date: p.event_date || p.date || p.instance_date,
              location: p.location,
              image_url: p.cover_image_url || p.photo_url
            }))
            .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
          
          setConfirmedEvents(upcomingEventsData);

          if (upcomingEventsData.length > 0) {
            setNextEvent({ 
              id: upcomingEventsData[0].id, 
              name: upcomingEventsData[0].name, 
              date: upcomingEventsData[0].date 
            });
          }
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [citySlug, user]);

  useEffect(() => {
    if (!dancerProfile) return;

    setEditForm({
      first_name: dancerProfile.first_name || '',
      surname: dancerProfile.surname || '',
      city: dancerProfile.city || '',
      nationality: dancerProfile.nationality || '',
      instagram: dancerProfile.instagram || '',
      facebook: dancerProfile.facebook || '',
      whatsapp: dancerProfile.whatsapp || '',
      website: dancerProfile.website || '',
      years_dancing: dancerProfile.years_dancing || '',
      dancing_start_date: dancerProfile.dancing_start_date || '',
      partner_role: normalizePartnerRole(dancerProfile.partner_role),
      achievements: dancerProfile.achievements || [],
      favorite_songs: dancerProfile.favorite_songs || [],
      partner_search_role: normalizePartnerRole(dancerProfile.partner_search_role),
      partner_search_level: dancerProfile.partner_search_level || [],
      partner_practice_goals: dancerProfile.partner_practice_goals || [],
      partner_details: parsePartnerDetails(dancerProfile.partner_details as PartnerDetailsValue),
      gallery_urls: dancerProfile.gallery_urls || [],
      favorite_styles: dancerProfile.favorite_styles || [],
      looking_for_partner: dancerProfile.looking_for_partner || false,
      photo_url: dancerProfile.photo_url || '',
      festival_plans: dancerProfile.festival_plans || [],
    });
  }, [dancerProfile]);

  const beginSectionEdit = (section: EditingSection) => {
    setEditingSection(section);
  };

  const cancelSectionEdit = (section: EditingSection) => {
    if (!dancerProfile) {
      setEditingSection(null);
      return;
    }

    if (section === 'identity') {
      setEditForm((prev) => ({
        ...prev,
        first_name: dancerProfile.first_name || '',
        surname: dancerProfile.surname || '',
        city: dancerProfile.city || '',
        dancing_start_date: dancerProfile.dancing_start_date || '',
        partner_role: normalizePartnerRole(dancerProfile.partner_role),
        photo_url: dancerProfile.photo_url || '',
      }));
    }

    if (section === 'career') {
      setEditForm((prev) => ({
        ...prev,
        favorite_styles: dancerProfile.favorite_styles || [],
        favorite_songs: dancerProfile.favorite_songs || [],
        achievements: dancerProfile.achievements || [],
        gallery_urls: dancerProfile.gallery_urls || [],
        festival_plans: dancerProfile.festival_plans || [],
      }));
    }

    if (section === 'festivals') {
      setEditForm((prev) => ({
        ...prev,
        festival_plans: dancerProfile.festival_plans || [],
      }));
    }

    if (section === 'partner') {
      setEditForm((prev) => ({
        ...prev,
        looking_for_partner: dancerProfile.looking_for_partner || false,
        partner_search_role: normalizePartnerRole(dancerProfile.partner_search_role),
        partner_search_level: dancerProfile.partner_search_level || [],
        partner_practice_goals: dancerProfile.partner_practice_goals || [],
        partner_details: parsePartnerDetails(dancerProfile.partner_details as PartnerDetailsValue),
      }));
    }

    if (section === 'social') {
      setEditForm((prev) => ({
        ...prev,
        instagram: dancerProfile.instagram || '',
        facebook: dancerProfile.facebook || '',
        whatsapp: dancerProfile.whatsapp || '',
        website: dancerProfile.website || '',
      }));
    }

    setEditingSection(null);
  };


  const toggleLookingForPartner = async () => {
    if (!dancerProfile) return;
    
    setIsTogglingPartner(true);
    const newValue = !dancerProfile.looking_for_partner;
    
    try {
      const { error } = await supabase
        .from('dancers')
        .update({ looking_for_partner: newValue })
        .eq('id', dancerProfile.id);

      if (error) throw error;

      setDancerProfile({ ...dancerProfile, looking_for_partner: newValue });
      setEditForm((prev) => ({ ...prev, looking_for_partner: newValue }));
      toast({
        title: newValue ? 'Partner search enabled' : 'Partner search disabled',
      });
    } catch (error: any) {
      toast({
        title: 'Error updating',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsTogglingPartner(false);
    }
  };

  const saveSection = async (section: EditingSection) => {
    if (!dancerProfile) return;
    
    setIsSaving(true);
    try {
      const trimmedFirstName = editForm.first_name.trim();
      const trimmedSurname = editForm.surname.trim();
      const canonicalPartnerRole = normalizePartnerRole(editForm.partner_role);
      const canonicalPartnerSearchRole = normalizePartnerRole(editForm.partner_search_role);
      const serializedPartnerDetails = serializePartnerDetails(editForm.partner_details) as unknown as Json | null;
      const normalizedInstagram = normalizeSocialUrl('instagram', editForm.instagram);
      const normalizedFacebook = normalizeSocialUrl('facebook', editForm.facebook);
      const normalizedWebsite = normalizeSocialUrl('website', editForm.website);
      
      let updatePayload: Record<string, unknown> = {};
      let nextLocalProfile: DancerProfile = { ...dancerProfile };

      if (section === 'identity') {
        const city = normalizeRequiredCity(editForm.city);
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

        if (!isValidDateString(editForm.dancing_start_date)) {
          toast({
            title: 'Invalid date',
            description: 'Please choose a valid dance start date.',
            variant: 'destructive',
          });
          return;
        }

        updatePayload = {
          first_name: trimmedFirstName,
          surname: trimmedSurname || null,
          city: canonicalCity.cityName,
          dancing_start_date: editForm.dancing_start_date,
          partner_role: canonicalPartnerRole || null,
          photo_url: editForm.photo_url || null,
        };

        nextLocalProfile = {
          ...nextLocalProfile,
          first_name: trimmedFirstName,
          surname: trimmedSurname || null,
          city: canonicalCity.cityName,
          dancing_start_date: editForm.dancing_start_date,
          partner_role: canonicalPartnerRole || null,
          photo_url: editForm.photo_url || null,
        };
      }

      if (section === 'career') {
        updatePayload = {
          favorite_styles: editForm.favorite_styles.length ? editForm.favorite_styles : null,
          favorite_songs: editForm.favorite_songs.length ? editForm.favorite_songs : null,
          achievements: editForm.achievements.length ? editForm.achievements : null,
          gallery_urls: editForm.gallery_urls.length ? editForm.gallery_urls : null,
          festival_plans: editForm.festival_plans.length ? editForm.festival_plans : null,
        };

        nextLocalProfile = {
          ...nextLocalProfile,
          favorite_styles: editForm.favorite_styles,
          favorite_songs: editForm.favorite_songs,
          achievements: editForm.achievements,
          gallery_urls: editForm.gallery_urls,
          festival_plans: editForm.festival_plans,
        };
      }

      if (section === 'festivals') {
        updatePayload = {
          festival_plans: editForm.festival_plans.length ? editForm.festival_plans : null,
        };

        nextLocalProfile = {
          ...nextLocalProfile,
          festival_plans: editForm.festival_plans,
        };
      }

      if (section === 'partner') {
        updatePayload = {
          partner_search_role: canonicalPartnerSearchRole || null,
          partner_search_level: editForm.partner_search_level.length ? editForm.partner_search_level : null,
          partner_practice_goals: editForm.partner_practice_goals.length ? editForm.partner_practice_goals : null,
          partner_details: serializedPartnerDetails,
        };

        nextLocalProfile = {
          ...nextLocalProfile,
          partner_search_role: canonicalPartnerSearchRole || null,
          partner_search_level: editForm.partner_search_level,
          partner_practice_goals: editForm.partner_practice_goals,
          partner_details: serializedPartnerDetails,
        };
      }

      if (section === 'social') {
        updatePayload = {
          instagram: normalizedInstagram || null,
          facebook: normalizedFacebook || null,
          whatsapp: editForm.whatsapp || null,
          website: normalizedWebsite || null,
        };

        nextLocalProfile = {
          ...nextLocalProfile,
          instagram: normalizedInstagram || null,
          facebook: normalizedFacebook || null,
          whatsapp: editForm.whatsapp || null,
          website: normalizedWebsite || null,
        };
      }

      const { error } = await supabase
        .from('dancers')
        .update(updatePayload)
        .eq('id', dancerProfile.id);

      if (error) throw error;

      if (section === 'identity') {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            first_name: trimmedFirstName,
            surname: trimmedSurname || null,
          },
        });

        if (metadataError) {
          console.error('Failed to sync auth metadata', metadataError);
        }
      }

      setDancerProfile(nextLocalProfile);
      setEditingSection(null);
      toast({
        title: 'Profile updated',
        description: 'Your changes have been saved.',
      });
    } catch (error: any) {
      toast({
        title: 'Error saving profile',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleStyle = (style: string) => {
    const styles = editForm.favorite_styles.includes(style)
      ? editForm.favorite_styles.filter(s => s !== style)
      : [...editForm.favorite_styles, style];
    setEditForm({ ...editForm, favorite_styles: styles });
  };

  const togglePartnerSearchLevel = (level: string) => {
    const levels = editForm.partner_search_level.includes(level)
      ? editForm.partner_search_level.filter((item) => item !== level)
      : [...editForm.partner_search_level, level];
    setEditForm({ ...editForm, partner_search_level: levels });
  };

  const togglePartnerPracticeGoal = (goal: string) => {
    const goals = editForm.partner_practice_goals.includes(goal)
      ? editForm.partner_practice_goals.filter((item) => item !== goal)
      : [...editForm.partner_practice_goals, goal];
    setEditForm({ ...editForm, partner_practice_goals: goals });
  };

  const addArrayItem = (key: 'favorite_songs' | 'achievements' | 'festival_plans', value: string, setter: (value: string) => void) => {
    const trimmed = value.trim();
    if (!trimmed) return;
    const existing = editForm[key];
    if (existing.includes(trimmed)) {
      setter('');
      return;
    }
    setEditForm({ ...editForm, [key]: [...existing, trimmed] });
    setter('');
  };

  const removeArrayItem = (key: 'favorite_songs' | 'achievements' | 'festival_plans', index: number) => {
    setEditForm({
      ...editForm,
      [key]: editForm[key].filter((_, itemIndex) => itemIndex !== index),
    });
  };

  const toHref = (value: string, kind: 'instagram' | 'facebook' | 'website' | 'whatsapp') => {
    const trimmed = value.trim();
    if (!trimmed) return '';
    if (kind === 'instagram') {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
      const username = trimmed.startsWith('@') ? trimmed.slice(1) : trimmed;
      return `https://instagram.com/${username}`;
    }
    if (kind === 'facebook' || kind === 'website') {
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed;
      return `https://${trimmed}`;
    }
    const digits = trimmed.replace(/[^\d+]/g, '');
    return `https://wa.me/${digits.replace('+', '')}`;
  };

  const addGalleryUrl = () => {
    const trimmed = newGalleryUrl.trim();
    if (!trimmed) return;
    if (editForm.gallery_urls.includes(trimmed)) {
      setNewGalleryUrl('');
      return;
    }
    setEditForm({ ...editForm, gallery_urls: [...editForm.gallery_urls, trimmed] });
    setNewGalleryUrl('');
  };

  const removeGalleryUrl = (index: number) => {
    setEditForm({
      ...editForm,
      gallery_urls: editForm.gallery_urls.filter((_, itemIndex) => itemIndex !== index),
    });
  };

  if (isLoading) {
    return (
      <div>
        <div className="h-[35vh] bg-muted animate-pulse" />
        <div className="max-w-lg mx-auto px-3 -mt-12">
          <Skeleton className="w-24 h-24 rounded-full mx-auto" />
          <Skeleton className="h-6 w-32 mx-auto mt-3" />
          <div className="mt-6 space-y-3">
            <Skeleton className="h-20" />
            <Skeleton className="h-16" />
            <Skeleton className="h-16" />
          </div>
        </div>
      </div>
    );
  }

  // Fallback if no dancer profile is loaded (should ideally be handled by parent)
  if (!dancerProfile && !isLoading) {
    return null;
  }
  
  // Safe check for dancerProfile
  if (!dancerProfile) return null;

  const metadataNames = normalizeUserMetadata((user?.user_metadata as Record<string, unknown> | undefined) || undefined);
  const fullName =
    buildFullName(dancerProfile.first_name, dancerProfile.surname) ||
    buildFullName(metadataNames.first_name, metadataNames.surname) ||
    'Dancer';
  const avatarUrl = dancerProfile.photo_url || user?.user_metadata?.avatar_url;
  const nextEventDate = nextEvent ? new Date(nextEvent.date) : null;
  const nextEventLabel = nextEventDate
    ? nextEventDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    : null;
  const danceYears = dancerProfile.dancing_start_date
    ? calculateDuration(dancerProfile.dancing_start_date)?.years ?? 0
    : Number(dancerProfile.years_dancing || 0);
  const calendarPath = citySlug ? `/${citySlug}/calendar` : '/';
  const practicePartnersPath = citySlug ? `/${citySlug}/practice-partners` : '/practice-partners';

  const hasIdentityBasics = Boolean(dancerProfile.first_name?.trim()) && Boolean(dancerProfile.city?.trim());
  const hasProfileMedia = Boolean(avatarUrl);
  const hasActivity = eventCounts.going + eventCounts.interested + confirmedEvents.length > 0;
  const hasEngagement = Boolean(dancerProfile.looking_for_partner) || Boolean(dancerProfile.partner_role) || Boolean(dancerProfile.festival_plans?.length);
  const hasSocial = Boolean(dancerProfile.instagram || dancerProfile.facebook || dancerProfile.whatsapp || dancerProfile.website);

  const dancerProgressMap: Record<DancerProgressKey, boolean> = {
    identity: hasIdentityBasics,
    media: hasProfileMedia,
    activity: hasActivity,
    engagement: hasEngagement,
    social: hasSocial,
  };

  const coreStepChecks = [
    { key: 'identity', done: dancerProgressMap.identity },
    { key: 'media', done: dancerProgressMap.media },
    { key: 'activity', done: dancerProgressMap.activity },
    { key: 'engagement', done: dancerProgressMap.engagement },
    { key: 'social', done: dancerProgressMap.social },
  ];

  const coreStepsCompletedCount = coreStepChecks.filter((item) => item.done).length;
  const profileCompletenessLabel = `${coreStepsCompletedCount}/${coreStepChecks.length} core steps complete`;
  const progressStatusFor = (progressKey: DancerProgressKey): TileStatus =>
    dancerProgressMap[progressKey] ? 'live' : 'attention';
  const shouldShowSignupWizardButton = dancerProgressMap.identity && !dancerProgressMap.media;

  const getNextEditingSection = (): EditingSection => {
    if (!dancerProgressMap.identity || !dancerProgressMap.media) return 'identity';
    if (!dancerProgressMap.engagement) return 'partner';
    if (!dancerProgressMap.social) return 'social';
    return 'career';
  };

  const nextStepAction = (() => {
    if (!dancerProgressMap.identity) {
      return {
        cta: 'Complete profile basics',
        helper: 'Add your name and city to complete your identity.',
        onClick: () => beginSectionEdit('identity'),
      };
    }

    if (!dancerProgressMap.media) {
      return {
        cta: 'Add profile photo',
        helper: 'Upload your profile image so people recognize you faster.',
        onClick: () => beginSectionEdit('identity'),
      };
    }

    if (!dancerProgressMap.activity) {
      return {
        cta: 'Find your next event',
        helper: 'Mark going/interested to build your activity momentum.',
        onClick: () => navigate(calendarPath),
      };
    }

    if (!dancerProgressMap.engagement) {
      return {
        cta: 'Enable partner visibility',
        helper: 'Set partner role or activate partner search.',
        onClick: () => beginSectionEdit('partner'),
      };
    }

    if (!dancerProgressMap.social) {
      return {
        cta: 'Add one contact link',
        helper: 'Set at least one social/contact channel for easy connection.',
        onClick: () => beginSectionEdit('social'),
      };
    }

    return {
      cta: 'Refresh profile',
      helper: 'Keep your dancer profile up to date.',
      onClick: () => beginSectionEdit(getNextEditingSection()),
    };
  })();

  const tabPurpose: Record<DashboardTab, { title: string; description: string }> = {
    overview: {
      title: 'Overview',
      description: 'Track your identity and next best action.',
    },
    activity: {
      title: 'Activity',
      description: 'Manage events, classes, and attendance.',
    },
    engagement: {
      title: 'Engagement',
      description: 'Connect with partners and community.',
    },
    profile: {
      title: 'Profile',
      description: 'Maintain your dance identity and preferences.',
    },
    settings: {
      title: 'Settings',
      description: 'Manage personal links and account preferences.',
    },
  };

  const groupedModules: ModuleSlot[] = [
    {
      tab: 'overview',
      title: 'Profile basics',
      description: dancerProgressMap.identity ? 'Identity basics complete.' : 'Add your basics.',
      colSpan: '6',
      status: progressStatusFor('identity'),
      actionLabel: 'Edit profile',
      mobileActionLabel: 'Edit',
        onAction: () => beginSectionEdit('identity'),
    },
    {
      tab: 'overview',
      title: 'Next event',
      description: nextEvent?.name ? `${nextEvent.name}${nextEventLabel ? ` G求 ${nextEventLabel}` : ''}` : 'No upcoming event yet.',
      colSpan: '6',
      status: nextEvent ? 'live' : 'attention',
      actionLabel: 'Explore events',
      mobileActionLabel: 'Events',
      onAction: () => navigate(calendarPath),
    },
    {
      tab: 'overview',
      title: 'Monthly momentum',
      description: `${eventCounts.going} going G求 ${eventCounts.interested} interested`,
      colSpan: '12',
      status: progressStatusFor('activity'),
      actionLabel: 'Open calendar',
      mobileActionLabel: 'Calendar',
      onAction: () => navigate(calendarPath),
    },
    {
      tab: 'activity',
      title: 'Upcoming tickets',
      description: confirmedEvents.length > 0 ? `${confirmedEvents.length} upcoming ticket(s).` : 'No upcoming tickets.',
      colSpan: '6',
      status: progressStatusFor('activity'),
      actionLabel: 'Manage tickets',
      mobileActionLabel: 'Tickets',
      onAction: () => navigate(calendarPath),
    },
    {
      tab: 'activity',
      title: 'Going / Interested',
      description: `${eventCounts.going} going G求 ${eventCounts.interested} interested`,
      colSpan: '6',
      status: progressStatusFor('activity'),
      actionLabel: 'Manage events',
      mobileActionLabel: 'Events',
      onAction: () => navigate(calendarPath),
    },
    {
      tab: 'activity',
      title: 'Class discovery',
      description: 'Find classes and workshops near you.',
      colSpan: '12',
      status: 'live',
      actionLabel: 'Browse classes',
      mobileActionLabel: 'Classes',
      onAction: () => navigate('/classes'),
    },
    {
      tab: 'engagement',
      title: 'Partner search',
      description: dancerProfile.looking_for_partner ? 'Partner search is active.' : 'Partner search is off.',
      colSpan: '6',
      status: dancerProfile.looking_for_partner ? 'live' : 'attention',
      actionLabel: isTogglingPartner
        ? dancerProfile.looking_for_partner
          ? 'Disabling...'
          : 'Enabling...'
        : dancerProfile.looking_for_partner
          ? 'Disable search'
          : 'Enable search',
      mobileActionLabel: isTogglingPartner
        ? 'Working...'
        : dancerProfile.looking_for_partner
          ? 'Disable'
          : 'Enable',
      onAction: toggleLookingForPartner,
      disabled: isTogglingPartner,
    },
    {
      tab: 'engagement',
      title: 'Practice partners',
      description: 'Find people to train with.',
      colSpan: '6',
      status: 'live',
      actionLabel: 'Open partners',
      mobileActionLabel: 'Partners',
      onAction: () => navigate(practicePartnersPath),
    },
    {
      tab: 'engagement',
      title: 'Festival plans',
      description: dancerProfile.festival_plans?.length ? `${dancerProfile.festival_plans.length} festival plan(s).` : 'No festival plans set.',
      colSpan: '12',
      status: progressStatusFor('engagement'),
      actionLabel: 'Edit festivals',
      mobileActionLabel: 'Edit',
      onAction: () => beginSectionEdit('festivals'),
    },
    {
      tab: 'profile',
      title: 'Dance identity',
      description: normalizePartnerRole(dancerProfile.partner_role) ? `${normalizePartnerRole(dancerProfile.partner_role)} G求 ${dancerProfile.favorite_styles?.slice(0, 2).join(', ') || 'No styles set'}` : 'Set role and styles.',
      colSpan: '8',
      status: normalizePartnerRole(dancerProfile.partner_role) && dancerProfile.favorite_styles?.length ? 'live' : 'attention',
      actionLabel: 'Update identity',
      mobileActionLabel: 'Edit',
        onAction: () => beginSectionEdit('career'),
    },
    {
      tab: 'profile',
      title: 'Experience',
      description: `${Number.isFinite(danceYears) ? danceYears : 0} year(s) dancing`,
      colSpan: '4',
      status: danceYears > 0 ? 'live' : 'attention',
      actionLabel: 'Update experience',
      mobileActionLabel: 'Edit',
        onAction: () => beginSectionEdit('identity'),
    },
    {
      tab: 'profile',
      title: 'Profile completeness',
      description: profileCompletenessLabel,
      colSpan: '12',
      status: coreStepsCompletedCount === coreStepChecks.length ? 'live' : 'attention',
      actionLabel: 'Review profile',
      mobileActionLabel: 'Review',
      onAction: () => beginSectionEdit(getNextEditingSection()),
    },
    {
      tab: 'settings',
      title: 'Social links',
      description: hasSocial ? 'Social/contact links set.' : 'No social/contact links yet.',
      colSpan: '6',
      status: progressStatusFor('social'),
      actionLabel: 'Update links',
      mobileActionLabel: 'Edit',
        onAction: () => beginSectionEdit('social'),
    },
    {
      tab: 'settings',
      title: 'Profile media',
      description: hasProfileMedia ? 'Profile image added.' : 'Add profile image.',
      colSpan: '6',
      status: progressStatusFor('media'),
      actionLabel: 'Update profile photo',
      mobileActionLabel: 'Edit',
        onAction: () => beginSectionEdit('identity'),
    },
    {
      tab: 'settings',
      title: 'Account preferences',
      description: 'Review low-frequency account details and identity fields.',
      colSpan: '12',
      status: progressStatusFor('identity'),
      actionLabel: 'Review account',
      mobileActionLabel: 'Review',
      onAction: () => beginSectionEdit('identity'),
    },
  ];

  const renderTiles = (tab: DashboardTab) => {
    const modules = groupedModules.filter((module) => module.tab === tab);
    return modules.map((module) => (
      <Card key={`${tab}-${module.title}`} className={`dashboard-card ${spanClass(module)} ${tileStatusTone[module.status]}`}>
        <CardContent className="p-2.5 h-full flex flex-col justify-between gap-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${module.status === 'live' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              <p className="text-[12px] font-semibold leading-tight">{module.title}</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight">{module.description}</p>
          </div>
          <Button
            size="sm"
            className="h-6 text-[10px] border-festival-teal/35 bg-background/55 hover:bg-festival-teal/15 focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors"
            variant="outline"
            onClick={module.onAction}
            disabled={module.disabled}
          >
            <span className="sm:hidden">{module.mobileActionLabel || 'Open'}</span>
            <span className="hidden sm:inline">{module.actionLabel}</span>
          </Button>
        </CardContent>
      </Card>
    ));
  };

  return (
    <div className="dashboard-neon pb-24 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--festival-teal)_/_0.14),_transparent_62%)]" />
      <div className="absolute -top-24 right-6 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="absolute bottom-10 left-8 h-80 w-80 rounded-full bg-festival-teal/25 blur-3xl" />

      <div className="relative z-10 pt-28 px-4">
        <div className="max-w-5xl mx-auto space-y-3">
          <div className="space-y-0.5 min-w-0">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <PartyPopper className="w-4 h-4" />
              Dancer dashboard
            </div>
            <h1 className="text-xl sm:text-2xl dash-display line-clamp-1">Grow your dance journey</h1>
          </div>

          <Card className="dashboard-card border-festival-teal/35 shadow-md">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Core steps: {coreStepsCompletedCount}/{coreStepChecks.length}</span>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-[11px] px-2.5 shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary/60 transition-all"
                  onClick={() => nextStepAction.onClick()}
                >
                  {nextStepAction.cta}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                Name: {fullName || 'Not set'} G求 City: {dancerProfile.city || 'Not set'}
              </p>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                Recent: {eventCounts.going} going G求 {confirmedEvents.length} upcoming
              </p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-[11px] text-muted-foreground line-clamp-1">{nextStepAction.helper}</p>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-6 text-[10px] px-2 shrink-0 text-muted-foreground hover:text-foreground"
                  onClick={() => navigate('/create-dancers-profile')}
                >
                  Use wizard
                </Button>
              </div>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)} className="space-y-3">
            <TabsList className="grid w-full grid-cols-5 h-9 border border-festival-teal/30 bg-background/60">
              <TabsTrigger value="overview" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Overview</TabsTrigger>
              <TabsTrigger value="activity" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Activity</TabsTrigger>
              <TabsTrigger value="engagement" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Engagement</TabsTrigger>
              <TabsTrigger value="profile" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Profile</TabsTrigger>
              <TabsTrigger value="settings" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Settings</TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{tabPurpose[activeTab].title}:</span> {tabPurpose[activeTab].description}
            </p>

            <TabsContent value="overview" className="m-0">
              <div className="space-y-2">
                <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                  {renderTiles('overview')}
                </div>

                {/* Core Identity inline edit */}
                {editingSection === 'identity' && (
                  <Card className="dashboard-card border-festival-teal/20">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Core Identity</p>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => cancelSectionEdit('identity')}>Cancel</Button>
                          <Button size="sm" className="h-6 text-[10px]" onClick={() => saveSection('identity')} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Input placeholder="First Name" value={editForm.first_name} onChange={(e) => setEditForm({ ...editForm, first_name: e.target.value })} className="text-sm" />
                        <Input placeholder="Surname" value={editForm.surname} onChange={(e) => setEditForm({ ...editForm, surname: e.target.value })} className="text-sm" />
                        <CityPicker value={editForm.city} onChange={(city) => setEditForm({ ...editForm, city })} placeholder="Select city..." className="text-sm" />
                        <Input placeholder="Photo URL" value={editForm.photo_url} onChange={(e) => setEditForm({ ...editForm, photo_url: e.target.value })} className="text-sm" />
                        <div>
                          <span className="text-xs text-muted-foreground">Started Dancing:</span>
                          <ExperiencePicker value={editForm.dancing_start_date} onChange={(date) => setEditForm({ ...editForm, dancing_start_date: date })} showLabel={false} />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Role:</span>
                          <div className="flex gap-2 mt-1">
                            {PARTNER_ROLE_OPTIONS.map((role) => (
                              <Badge key={role} variant={editForm.partner_role === role ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => setEditForm({ ...editForm, partner_role: role })}>{role}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="activity" className="m-0">
              <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                {renderTiles('activity')}
              </div>
            </TabsContent>

            <TabsContent value="engagement" className="m-0">
              <div className="space-y-2">
                <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                  {renderTiles('engagement')}
                </div>

                {editingSection === 'partner' && (
                  <Card className="dashboard-card border-festival-teal/20">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Partner Preferences</p>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => cancelSectionEdit('partner')}>Cancel</Button>
                          <Button size="sm" className="h-6 text-[10px]" onClick={() => saveSection('partner')} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-center justify-between p-2 bg-muted rounded-lg">
                          <span className="text-xs">Looking for Dance Partners</span>
                          <Switch checked={editForm.looking_for_partner} onCheckedChange={(checked) => setEditForm({ ...editForm, looking_for_partner: checked })} />
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Looking for role:</span>
                          <div className="flex gap-2 mt-1">
                            {PARTNER_SEARCH_ROLE_OPTIONS.map((role) => (
                              <Badge key={role} variant={editForm.partner_search_role === role ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => setEditForm({ ...editForm, partner_search_role: role })}>{role}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Preferred Levels:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {PARTNER_SEARCH_LEVEL_OPTIONS.map((level) => (
                              <Badge key={level} variant={editForm.partner_search_level.includes(level) ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => togglePartnerSearchLevel(level)}>{level}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Practice Goals:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {PARTNER_PRACTICE_GOAL_OPTIONS.map((goal) => (
                              <Badge key={goal} variant={editForm.partner_practice_goals.includes(goal) ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => togglePartnerPracticeGoal(goal)}>{goal}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Details:</span>
                          <Textarea placeholder="Availability or practice preferences..." value={editForm.partner_details} onChange={(e) => setEditForm({ ...editForm, partner_details: e.target.value })} className="mt-1 text-sm" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Festival plans inline edit */}
                {editingSection === 'festivals' && (
                  <Card className="dashboard-card border-festival-teal/20">
                    <CardContent className="p-3 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-medium text-muted-foreground">Festival Plans</p>
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => cancelSectionEdit('festivals')}>Cancel</Button>
                          <Button size="sm" className="h-6 text-[10px]" onClick={() => saveSection('festivals')} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
                        </div>
                      </div>
                      <FestivalPlansPicker
                        value={editForm.festival_plans}
                        onChange={(ids) => setEditForm({ ...editForm, festival_plans: ids })}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            </TabsContent>

            <TabsContent value="profile" className="m-0">
              <div className="space-y-2">
                <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                  {renderTiles('profile')}
                </div>
                <Card className="dashboard-card border-festival-teal/20">
                  <CardContent className="p-3 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Dance Career</p>
                      {editingSection === 'career' ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => cancelSectionEdit('career')}>Cancel</Button>
                          <Button size="sm" className="h-6 text-[10px]" onClick={() => saveSection('career')} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => beginSectionEdit('career')}><Pencil className="w-3 h-3" />Edit</Button>
                      )}
                    </div>

                    {editingSection === 'career' ? (
                      <div className="space-y-3">
                        <div>
                          <span className="text-xs text-muted-foreground">Styles:</span>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {FAVORITE_STYLE_OPTIONS.map((style) => (
                              <Badge key={style} variant={editForm.favorite_styles.includes(style) ? 'default' : 'outline'} className="text-xs cursor-pointer" onClick={() => toggleStyle(style)}>{style}</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Favorite Songs:</span>
                          <div className="mt-1 flex gap-2">
                            <Input placeholder="Add song + Enter" value={newFavoriteSong} onChange={(e) => setNewFavoriteSong(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArrayItem('favorite_songs', newFavoriteSong, setNewFavoriteSong); } }} className="text-sm" />
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {editForm.favorite_songs.map((song, index) => (
                              <Badge key={`es-${index}`} variant="secondary" className="text-xs cursor-pointer" onClick={() => removeArrayItem('favorite_songs', index)}>{song} &times;</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Achievements:</span>
                          <div className="mt-1 flex gap-2">
                            <Input placeholder="Add achievement + Enter" value={newAchievement} onChange={(e) => setNewAchievement(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArrayItem('achievements', newAchievement, setNewAchievement); } }} className="text-sm" />
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {editForm.achievements.map((a, index) => (
                              <Badge key={`ea-${index}`} variant="secondary" className="text-xs cursor-pointer" onClick={() => removeArrayItem('achievements', index)}>{a} &times;</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Festival Plans:</span>
                          <div className="mt-1 flex gap-2">
                            <Input placeholder="Add festival + Enter" value={newFestivalPlan} onChange={(e) => setNewFestivalPlan(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addArrayItem('festival_plans', newFestivalPlan, setNewFestivalPlan); } }} className="text-sm" />
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {editForm.festival_plans.map((f, index) => (
                              <Badge key={`ef-${index}`} variant="secondary" className="text-xs cursor-pointer" onClick={() => removeArrayItem('festival_plans', index)}>{f} &times;</Badge>
                            ))}
                          </div>
                        </div>
                        <div>
                          <span className="text-xs text-muted-foreground">Gallery URLs:</span>
                          <div className="mt-1 flex gap-2">
                            <Input placeholder="Paste image URL + Enter" value={newGalleryUrl} onChange={(e) => setNewGalleryUrl(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addGalleryUrl(); } }} className="text-sm" />
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            {editForm.gallery_urls.map((url, index) => (
                              <Badge key={`eg-${index}`} variant="secondary" className="text-xs cursor-pointer" onClick={() => removeGalleryUrl(index)}>{url} &times;</Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1">Favorite songs</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(dancerProfile.favorite_songs || []).map((song, index) => (
                              <Badge key={`song-${index}`} variant="outline" className="text-[10px]">{song}</Badge>
                            ))}
                            {(!dancerProfile.favorite_songs || dancerProfile.favorite_songs.length === 0) && <span className="text-[11px] text-muted-foreground">Not set</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1">Achievements</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(dancerProfile.achievements || []).map((achievement, index) => (
                              <Badge key={`achievement-${index}`} variant="outline" className="text-[10px]">{achievement}</Badge>
                            ))}
                            {(!dancerProfile.achievements || dancerProfile.achievements.length === 0) && <span className="text-[11px] text-muted-foreground">Not set</span>}
                          </div>
                        </div>
                        <div>
                          <p className="text-[11px] text-muted-foreground mb-1">Festival plans</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(dancerProfile.festival_plans || []).map((festival, index) => (
                              <Badge key={`festival-${index}`} variant="outline" className="text-[10px]">{festival}</Badge>
                            ))}
                            {(!dancerProfile.festival_plans || dancerProfile.festival_plans.length === 0) && <span className="text-[11px] text-muted-foreground">Not set</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="settings" className="m-0">
              <div className="space-y-2">
                {shouldShowSignupWizardButton && (
                  <Card className="dashboard-card border-festival-teal/20">
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <p className="text-xs text-muted-foreground">Prefer guided setup? Use the signup wizard.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-[11px] px-2.5 shrink-0"
                        onClick={() => navigate('/create-dancers-profile')}
                      >
                        Use signup wizard
                      </Button>
                    </CardContent>
                  </Card>
                )}
                <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                  {renderTiles('settings')}
                </div>
                <Card className="dashboard-card border-festival-teal/20">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <p className="text-xs font-medium text-muted-foreground">Social & Contact</p>
                      {editingSection === 'social' ? (
                        <div className="flex gap-1.5">
                          <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => cancelSectionEdit('social')}>Cancel</Button>
                          <Button size="sm" className="h-6 text-[10px]" onClick={() => saveSection('social')} disabled={isSaving}>{isSaving ? 'Saving...' : 'Save'}</Button>
                        </div>
                      ) : (
                        <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1" onClick={() => beginSectionEdit('social')}><Pencil className="w-3 h-3" />Edit</Button>
                      )}
                    </div>

                    {editingSection === 'social' ? (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Instagram className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <Input placeholder="@username" value={editForm.instagram} onChange={(e) => setEditForm({ ...editForm, instagram: e.target.value })} onBlur={() => setEditForm({ ...editForm, instagram: normalizeSocialUrl('instagram', editForm.instagram) })} className="text-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Facebook className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                          <Input placeholder="facebook.com/username" value={editForm.facebook} onChange={(e) => setEditForm({ ...editForm, facebook: e.target.value })} onBlur={() => setEditForm({ ...editForm, facebook: normalizeSocialUrl('facebook', editForm.facebook) })} className="text-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input placeholder="+44 7XXX XXX XXX" value={editForm.whatsapp} onChange={(e) => setEditForm({ ...editForm, whatsapp: e.target.value })} className="text-sm" />
                        </div>
                        <div className="flex items-center gap-2">
                          <Input placeholder="https://your-site.com" value={editForm.website} onChange={(e) => setEditForm({ ...editForm, website: e.target.value })} onBlur={() => setEditForm({ ...editForm, website: normalizeSocialUrl('website', editForm.website) })} className="text-sm" />
                        </div>
                      </div>
                    ) : (
                      <div className="grid gap-1 text-[11px]">
                        <p>
                          Instagram:{' '}
                          {dancerProfile.instagram ? (
                            <a href={toHref(dancerProfile.instagram, 'instagram')} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                              {dancerProfile.instagram}
                            </a>
                          ) : 'Not set'}
                        </p>
                        <p>
                          Facebook:{' '}
                          {dancerProfile.facebook ? (
                            <a href={toHref(dancerProfile.facebook, 'facebook')} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                              {dancerProfile.facebook}
                            </a>
                          ) : 'Not set'}
                        </p>
                        <p>
                          WhatsApp:{' '}
                          {dancerProfile.whatsapp ? (
                            <a href={toHref(dancerProfile.whatsapp, 'whatsapp')} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                              {dancerProfile.whatsapp}
                            </a>
                          ) : 'Not set'}
                        </p>
                        <p>
                          Website:{' '}
                          {dancerProfile.website ? (
                            <a href={toHref(dancerProfile.website, 'website')} target="_blank" rel="noreferrer" className="underline decoration-dotted">
                              {dancerProfile.website}
                            </a>
                          ) : 'Not set'}
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      {/* Edit Profile Sheet removed */}
    </div>
  );
};
