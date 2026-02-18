import { User, Music, Heart, Briefcase, Camera, MapPin, MessageCircle, Share2, Phone, Instagram, Youtube, Award, Star, Sparkles, Eye, EyeOff, Calendar, Facebook, Globe, AlertCircle, ChevronRight, ChevronLeft, CheckCircle, Plus, X, Users } from 'lucide-react';
import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Progress } from '@/components/ui/progress';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { triggerGlobalConfetti, triggerMicroConfetti } from '@/lib/confetti';
import { serializePartnerDetails, serializePhotoValue } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';
import { buildFullName, getInitials, normalizeUserMetadata } from '@/lib/name-utils';
import { ExperiencePicker } from '@/components/profile/ExperiencePicker';
import { FestivalPlansPicker } from '@/components/profile/FestivalPlansPicker';
import { NationalityPicker } from '@/components/ui/nationality-picker';
import { CityPicker } from '@/components/ui/city-picker';
import { AuthStepper } from '@/components/auth/AuthStepper';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import {
    FAVORITE_STYLE_OPTIONS,
    PARTNER_PRACTICE_GOAL_OPTIONS,
    PARTNER_ROLE_OPTIONS,
    PARTNER_SEARCH_LEVEL_OPTIONS,
    PARTNER_SEARCH_ROLE_OPTIONS,
} from '@/components/profile/dancerConstants';

// --- MOCK DATA FOR "SPOTIFY" SEARCH ---
const EXPERIENCE_LEVEL_OPTIONS = ['Beginner', 'Improver', 'Intermediate', 'Advanced', 'Professional'];

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


const GamifiedSongSelector = ({ value, onChange }: { value?: string, onChange: (val: string) => void }) => {
  const [songs, setSongs] = React.useState<string[]>((value || '').split('\n').filter(Boolean));
  const [query, setQuery] = React.useState('');
  const [activeSlot, setActiveSlot] = React.useState<number | null>(songs.length < 3 ? songs.length : null);
  const searchInputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        const nextSongs = (value || '').split('\n').filter(Boolean);
        setSongs(nextSongs);
        setActiveSlot(nextSongs.length < 3 ? nextSongs.length : null);
    }, [value]);

  const getSlotLabel = (index: number) => {
    switch(index) {
          case 0: return { icon: '1️⃣', label: 'My Forever Favorite', color: 'bg-amber-100 border-amber-300 text-amber-800' };
          case 1: return { icon: '2️⃣', label: 'The Floor Filler', color: 'bg-slate-100 border-slate-300 text-slate-800' };
          case 2: return { icon: '3️⃣', label: 'The Body Mover', color: 'bg-orange-100 border-orange-300 text-orange-800' };
          default: return { icon: '', label: 'Song', color: 'bg-gray-100' };
      }
  };
  
  const [searchResults, setSearchResults] = React.useState<{title: string, artist: string, genre?: string}[]>([]);

  React.useEffect(() => {
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      const { data } = await supabase
        .from('songs')
        .select('title, artist, genre')
        .or(`title.ilike.%${query}%,artist.ilike.%${query}%`)
        .limit(10);
      
      if (data) setSearchResults(data);
    }, 300);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelectTrack = (track: { title: string, artist: string }) => {
    if (activeSlot === null) return;
    
    const newSongs = [...songs];
    newSongs[activeSlot] = `${track.title} - ${track.artist}`;
    
    // Update state
    setSongs(newSongs);
    onChange(newSongs.join('\n'));
    setQuery('');
    
    // Trigger fun effect
    triggerMicroConfetti(window.innerWidth / 2, window.innerHeight / 2);

    // Auto-advance
    if (activeSlot < 2) {
        setTimeout(() => {
            setActiveSlot(activeSlot + 1);
            // Slight delay to allow animation to finish before focusing
            // Note: In a real app we might want to focus the input automatically
        }, 400);
    } else {
        setActiveSlot(null); // Done!
    }
  };

  const removeSong = (index: number) => {
    const newSongs = [...songs];
    // Remove the song at index
    newSongs.splice(index, 1);
    setSongs(newSongs);
    onChange(newSongs.join('\n'));
    setActiveSlot(index); // Re-open this slot
  };

  return (
    <div className="space-y-6">
      {/* The Collection Display */}
      <div className="grid grid-cols-1 gap-3">
        {[0, 1, 2].map((index) => {
           const song = songs[index];
           const meta = getSlotLabel(index);
           const isActive = activeSlot === index;

           return (
             <motion.div 
                key={index}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`
                    relative flex items-center p-3 rounded-xl border-2 transition-all duration-300
                    ${isActive ? 'border-primary ring-2 ring-primary/20 scale-[1.02] shadow-lg bg-background' : 'border-border/50 bg-background/50'}
                    ${song ? 'border-solid' : 'border-dashed'}
                `}
                onClick={() => setActiveSlot(index)}
             >

                <div className={`
                    w-12 h-12 rounded-full flex items-center justify-center text-2xl mr-4 shrink-0 shadow-sm border
                    ${meta.color}
                `}>
                    {meta.icon}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-0.5">{meta.label}</p>
                    {song ? (
                        <div className="flex items-center justify-between">
                            <p className="text-base font-semibold truncate pr-2">{song}</p>
                            <button 
                                onClick={(e) => { e.stopPropagation(); removeSong(index); }}
                                className="p-1 hover:bg-destructive/10 rounded-full text-muted-foreground hover:text-destructive transition-colors"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                            </button>
                        </div>
                    ) : (
                        <p className="text-sm text-muted-foreground italic">Tap to search...</p>
                    )}
                </div>

                {/* Active Indicator */}
                {isActive && !song && (
                    <motion.div 
                        layoutId="active-indicator"
                        className="absolute -right-1 -top-1 w-3 h-3 bg-primary rounded-full" 
                    />
                )}
             </motion.div>
           );
        })}
      </div>

      {/* The "Search" Overlay / Area (Only visible when a slot is active) */}
      <AnimatePresence>
        {activeSlot !== null && (
            <motion.div 
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="bg-card border rounded-xl overflow-hidden shadow-xl"
            >
                <div className="p-3 border-b flex items-center gap-2 bg-muted/30">
                    <Music className="w-4 h-4 text-muted-foreground" />
                    <input 
                        ref={searchInputRef}
                        autoFocus
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={`Search for your "${getSlotLabel(activeSlot).label}"...`}
                        className="flex-1 bg-transparent border-none focus:ring-0 outline-none text-sm h-8"
                    />
                </div>
                
                <div className="max-h-[240px] overflow-y-auto">
                    {query.length === 0 && (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                            Start typing to search Global Top Hits...
                        </div>
                    )}
                    
                    {query.length > 0 && searchResults.length === 0 && (
                        <div 
                            className="p-3 hover:bg-accent cursor-pointer flex items-center gap-3 transition-colors"
                            onClick={() => handleSelectTrack({ title: query, artist: 'Custom Entry' })}
                        >
                             <div className="w-10 h-10 bg-muted rounded-md flex items-center justify-center">
                                <span className="text-xs">?</span>
                             </div>
                             <div>
                                <p className="font-medium text-sm">"{query}"</p>
                                <p className="text-xs text-muted-foreground">Add as custom track</p>
                             </div>
                        </div>
                    )}

                    {searchResults.map((track, i) => (
                        <div 
                            key={i}
                            className="p-3 hover:bg-accent cursor-pointer flex items-center gap-3 transition-colors"
                            onClick={() => handleSelectTrack(track)}
                        >
                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-md flex items-center justify-center shrink-0">
                                <Music className="w-5 h-5 text-slate-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                                <p className="font-medium text-sm truncate">{track.title}</p>
                                <div className="flex items-center gap-2">
                                    <p className="text-xs text-muted-foreground truncate">{track.artist}</p>
                                    {track.genre && (
                                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${
                                            track.genre === 'bachata' ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' :
                                            track.genre === 'bachata-remix' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300' :
                                            'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300'
                                        }`}>
                                            {track.genre === 'bachata' ? 'Original' : track.genre === 'bachata-remix' ? 'Remix' : 'Zouk'}
                                        </span>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

const COMMON_CERTS = [
  "Bachata Sensual Instructor (K&J)",
  "World Mastery Certified",
  "Bachata Influence (Dani J)",
  "Dominican Swag (Saman & Chantal)",
  "Role Rotation Certified",
  "Jack & Jill Finalist"
];

const AchievementWall = ({ value, onChange }: { value?: string, onChange: (val: string) => void }) => {
  const parseState = (val: string) => {
    const certs: string[] = [];
    const awards: string[] = [];
    
    if (!val) return { certs, awards };

    const lines = val.split('\n');
    let currentSection = 'none';

    lines.forEach(line => {
        if (line.includes('“ Certifications:')) { currentSection = 'certs'; return; }
        if (line.includes('† Awards:')) { currentSection = 'awards'; return; }
        
        const trimmed = line.trim().replace(/^- /, '');
        if (!trimmed) return;

        if (currentSection === 'certs') certs.push(trimmed);
        else if (currentSection === 'awards') awards.push(trimmed);
        else if (currentSection === 'none' && !line.includes(':')) {
             // Basic heuristic for legacy data or simple text
             if (line.toLowerCase().includes('place') || line.toLowerCase().includes('winner')) {
                 awards.push(trimmed);
             } else {
                 certs.push(trimmed);
             }
        }
    });
    return { certs, awards };
  };

  const [state, setState] = React.useState(parseState(value || ''));
  // const [activeTab, setActiveTab] = React.useState<'certs' | 'awards'>('certs'); // Removed for simultaneous view
  const [customInput, setCustomInput] = React.useState('');
  
  // New States for "Fun" Awards Input
  const [awardRank, setAwardRank] = React.useState<string | null>(null);
  const [awardEvent, setAwardEvent] = React.useState('');
    const [awardYear, setAwardYear] = React.useState('');

    React.useEffect(() => {
        setState(parseState(value || ''));
    }, [value]);

  const updateParent = (newState: { certs: string[], awards: string[] }) => {
    let text = '';
    if (newState.certs.length > 0) {
        text += '“ Certifications:\n' + newState.certs.map(c => `- ${c}`).join('\n');
    }
    if (newState.awards.length > 0) {
        text += (text ? '\n\n' : '') + '† Awards:\n' + newState.awards.map(a => `- ${a}`).join('\n');
    }
    onChange(text);
  };

  const handleAddAward = () => {
        const normalizedEvent = awardEvent.trim();
        const normalizedYear = awardYear.trim();
        if (awardRank && normalizedEvent && normalizedYear) {
                addItem(`${awardRank} at ${normalizedEvent} (${normalizedYear})`, 'awards');
                setAwardRank(null);
                setAwardEvent('');
                setAwardYear('');
        }
  };

  const addItem = (item: string, type: 'certs' | 'awards') => {
    const newState = { ...state };
    newState[type] = [...newState[type], item];
    setState(newState);
    updateParent(newState);
    triggerMicroConfetti(window.innerWidth/2, window.innerHeight/2);
    setCustomInput('');
  };

  const removeItem = (index: number, type: 'certs' | 'awards') => {
    const newState = { ...state };
    newState[type] = newState[type].filter((_, i) => i !== index);
    setState(newState);
    updateParent(newState);
  };

  return (
    <div className="space-y-6">
        
        {/* Certifications Input */}
        <div className="bg-card border rounded-xl p-4 space-y-3">
             <div className="flex items-center gap-2 mb-1">
                <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-lg shadow-sm">“</div>
                <p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Add Certification</p>
             </div>
             <div className="flex gap-2">
                <Input 
                    placeholder="e.g. Bachata Sensual Level 1" 
                    className="h-10 text-sm"
                    value={customInput}
                    onChange={(e) => setCustomInput(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            if (customInput.trim()) addItem(customInput.trim(), 'certs');
                        }
                    }}
                />
                <Button 
                    type="button"
                    size="sm"
                    disabled={!customInput.trim()}
                    onClick={() => {
                        if (customInput.trim()) addItem(customInput.trim(), 'certs');
                    }}
                >
                    <Plus className="w-4 h-4" />
                </Button>
            </div>
        </div>

        {/* Awards Input */}
        <div className="bg-card border rounded-xl p-4 space-y-4">
             <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-lg shadow-sm">†</div>
                    <div><p className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Jack & Jill Trophy Case</p><p className="text-[10px] text-muted-foreground/70 font-normal normal-case -mt-0.5">Showcase your competition wins & finals (J&J, Strictly)</p></div>
                </div>
             </div>

             <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Position</p>
                    <div className="grid grid-cols-2 gap-2">
                        {[
                            { label: '1st', icon: '\u{1F947}', value: '1st Place' },
                            { label: '2nd', icon: '\u{1F948}', value: '2nd Place' },
                            { label: '3rd', icon: '\u{1F949}', value: '3rd Place' },
                            { label: 'Finalist', icon: '\u{1F396}', value: 'Finalist' },
                        ].map((rank) => (
                             <button
                                key={rank.value}
                                type="button"
                                onClick={() => setAwardRank(rank.value)}
                                className={`flex flex-col items-center justify-center p-2 rounded-xl border-2 transition-all duration-200 ${
                                    awardRank === rank.value 
                                    ? 'border-primary bg-primary/10 scale-105 shadow-md ring-2 ring-primary/20' 
                                    : 'border-border/50 bg-secondary/30 hover:bg-secondary hover:scale-105'
                                }`}
                             >
                                <span className="text-2xl mb-1 filter drop-shadow-sm">{rank.icon}</span>
                                <span className={`text-[10px] font-bold uppercase tracking-wider ${awardRank === rank.value ? 'text-primary' : 'text-muted-foreground'}`}>{rank.label}</span>
                             </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Event</p>
                    <Input
                        placeholder="e.g. BSW Congress"
                        className="h-12 text-base shadow-sm"
                        value={awardEvent}
                        disabled={!awardRank}
                        onChange={(e) => setAwardEvent(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddAward();
                            }
                        }}
                    />
                </div>

                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Year</p>
                    <div className="flex gap-2">
                        <Input
                            type="number"
                            inputMode="numeric"
                            placeholder="2025"
                            className="h-12 text-base shadow-sm"
                            value={awardYear}
                            disabled={!awardRank || !awardEvent.trim()}
                            onChange={(e) => setAwardYear(e.target.value.replace(/[^0-9]/g, ''))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleAddAward();
                                }
                            }}
                        />
                        <Button 
                            type="button" 
                            disabled={!awardRank || !awardEvent.trim() || !awardYear.trim()} 
                            onClick={handleAddAward}
                            className="h-12 w-12 shrink-0 rounded-xl shadow-md transition-all active:scale-95"
                        >
                            <Plus className="w-6 h-6" />
                        </Button>
                    </div>
                    <p className="text-[11px] text-muted-foreground">Pick a position, add the event + year, then hit enter or tap the plus.</p>
                </div>
             </div>
        </div>

        {/* The Wall Display */}
        {(state.certs.length > 0 || state.awards.length > 0) && (
            <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider text-center">Your Wall of Fame</p>
                <div className="grid gap-2">
                    {state.certs.map((item, i) => (
                        <div key={'c'+i} className="flex items-center gap-3 p-3 rounded-lg border bg-amber-50/50 border-amber-100 dark:bg-amber-900/10 dark:border-amber-900/30">
                            <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-lg shadow-sm">
                                “
                            </div>
                            <span className="flex-1 text-sm font-medium">{item}</span>
                            <button type="button" onClick={() => removeItem(i, 'certs')} className="text-muted-foreground hover:text-destructive p-1">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ))}
                    {state.awards.map((item, i) => (
                         <div key={'a'+i} className="flex items-center gap-3 p-3 rounded-lg border bg-purple-50/50 border-purple-100 dark:bg-purple-900/10 dark:border-purple-900/30">
                             <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center text-lg shadow-sm">
                                 ¿½
                             </div>
                             <span className="flex-1 text-sm font-medium">{item}</span>
                             <button type="button" onClick={() => removeItem(i, 'awards')} className="text-muted-foreground hover:text-destructive p-1">
                                 <X className="w-4 h-4" />
                             </button>
                         </div>
                    ))}
                </div>
            </div>
        )}
    </div>
  )
}

const normalizePartnerRole = (value?: string | null) => {
    const normalized = (value || '').trim().toLowerCase();
    if (!normalized) return null;
    if (normalized === 'lead' || normalized === 'leader') return 'Leader';
    if (normalized === 'follow' || normalized === 'follower') return 'Follower';
    if (normalized === 'both') return 'Both';
    return null;
};

const EXPERIENCE_LEVEL_YEARS: Record<string, string> = {
    Beginner: '1',
    Improver: '2',
    Intermediate: '4',
    Advanced: '7',
    Professional: '10',
};

const formSchema = z.object({
    photo_url: z.string().optional(),
  is_public: z.boolean().default(true),
    city: z.string().trim().min(1, 'City is required'),
  nationality: z.string().optional().or(z.literal('')),
    experience_level: z.string().optional().or(z.literal('')),
  
  // Step 1: Experience
  dancing_start_date: z.string().optional(),
  favorite_styles: z.array(z.string()).optional(),
  partner_role: z.string().optional(), // 'Leader', 'Follower', 'Both'
  favorite_songs_text: z.string().optional(), // Helper for easy input
  achievements_text: z.string().optional(), // Helper for easy input
    festival_plans: z.array(z.string()).optional(),
    gallery_urls: z.array(z.string()).optional(),
  
  // Partner Search Specifics
  looking_for_partner: z.boolean().optional(),
  partner_search_role: z.string().optional(),
  partner_search_level: z.array(z.string()).optional(),
  partner_practice_goals: z.array(z.string()).optional(),
  partner_details: z.string().max(500).optional().or(z.literal('')),
  
  // Step 2: Socials
  instagram: z.string().optional().or(z.literal('')),
  facebook: z.string().optional().or(z.literal('')),
    whatsapp: z.string().optional().or(z.literal('')),
  website: z.string().optional().or(z.literal('')),
  
  // Logic
  claim_entity_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const CreateProfile = () => {
  const navigate = useNavigate();
    const location = useLocation();
  const { user } = useAuth();
    const preAuthKey = 'dancer_pre_auth';
        const authStep = 4;
        const returnTo = `${location.pathname}${location.search}`;
        const [step, setStep] = useState(user ? 1 : 0);
        const [pendingSubmit, setPendingSubmit] = useState(false);
      const [galleryUrlDraft, setGalleryUrlDraft] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
    const [potentialMatches, setPotentialMatches] = useState<any[]>([]);
    const [profileError, setProfileError] = useState<string | null>(null);

    const triggerCompletionConfetti = () => {
        triggerMicroConfetti(window.innerWidth / 2, window.innerHeight / 2);
    };

    const isValidDateString = (value?: string | null) => {
        if (!value) return true;
        const parsed = new Date(value);
        return !Number.isNaN(parsed.getTime());
    };

    const maybeTriggerConfetti = (value: string) => {
        if (value.trim()) {
            triggerCompletionConfetti();
        }
    };

    // Calculate Progress
    const totalSteps = 3;
    const progress = step === 0 ? 0 : step <= totalSteps ? (step / totalSteps) * 100 : 100;

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      photo_url: '',
      is_public: true,
      city: '',
      nationality: '',
    experience_level: '',
      dancing_start_date: '',
      favorite_styles: [],
      partner_role: '',
      favorite_songs_text: '',
      achievements_text: '',
    festival_plans: [],
            gallery_urls: [],
      looking_for_partner: false,
      partner_search_role: '',
      partner_search_level: [],
      partner_practice_goals: [],
      partner_details: '',
      instagram: '',
      facebook: '',
    whatsapp: '',
      website: '',
      claim_entity_id: '',
    },
    mode: 'onChange', 
  });

    const normalizedMetadata = user?.user_metadata ? normalizeUserMetadata(user.user_metadata) : { first_name: '', surname: '' };
    const derivedFirstName = normalizedMetadata.first_name || '';
    const derivedSurname = normalizedMetadata.surname || '';

    React.useEffect(() => {
        const saved = localStorage.getItem(preAuthKey);
        if (!saved) return;
        try {
            const parsed = JSON.parse(saved) as {
                city?: string;
                nationality?: string;
                experience_level?: string;
            };
            if (parsed.city && !form.getValues('city')) {
                form.setValue('city', parsed.city);
            }
            if (parsed.nationality && !form.getValues('nationality')) {
                form.setValue('nationality', parsed.nationality);
            }
            if (parsed.experience_level && !form.getValues('experience_level')) {
                form.setValue('experience_level', parsed.experience_level);
            }
        } catch {
            // Ignore invalid stored data
        }
    }, [form, preAuthKey]);

    React.useEffect(() => {
        if (user && step === 0) {
            setStep(1);
        }
    }, [user, step]);

    // Pre-fill form with existing dancer data so the wizard doesn't overwrite it
    React.useEffect(() => {
        if (!user) return;
        const loadExisting = async () => {
            const { data } = await supabase
                .from('dancers')
                .select('*')
                .eq('user_id', user.id)
                .maybeSingle();
            if (!data) return;

            const achievements = Array.isArray(data.achievements) ? data.achievements.filter(Boolean).join('\n') : '';
            const favSongs = Array.isArray(data.favorite_songs) ? data.favorite_songs.filter(Boolean).join('\n') : '';

            form.reset({
                photo_url: Array.isArray(data.photo_url) ? (data.photo_url[0] || '') : (data.photo_url || ''),
                is_public: data.is_public ?? true,
                city: data.city || '',
                nationality: data.nationality || '',
                experience_level: '',
                dancing_start_date: data.dancing_start_date || '',
                favorite_styles: Array.isArray(data.favorite_styles) ? data.favorite_styles : [],
                partner_role: data.partner_role || '',
                favorite_songs_text: favSongs,
                achievements_text: achievements,
                festival_plans: Array.isArray(data.festival_plans) ? (data.festival_plans as string[]) : [],
                gallery_urls: Array.isArray(data.gallery_urls) ? data.gallery_urls : [],
                looking_for_partner: data.looking_for_partner ?? false,
                partner_search_role: data.partner_search_role || '',
                partner_search_level: Array.isArray(data.partner_search_level) ? data.partner_search_level : [],
                partner_practice_goals: Array.isArray(data.partner_practice_goals) ? data.partner_practice_goals : [],
                partner_details: typeof data.partner_details === 'string' ? data.partner_details : '',
                instagram: data.instagram || '',
                facebook: data.facebook || '',
                whatsapp: data.whatsapp || '',
                website: data.website || '',
                claim_entity_id: '',
            });
        };
        loadExisting();
    }, [user]);

  // Debounced search for existing dancer profiles (Step 3 Logic)
    React.useEffect(() => {
        const searchEntities = async () => {
            const combinedName = buildFullName(derivedFirstName, derivedSurname);
            if (step !== 3 || !combinedName || combinedName.length < 3) {
                setPotentialMatches([]);
                return;
            }

            const { data } = await supabase
                .from('dancers')
                .select('id, first_name, surname, city')
                .is('user_id', null)
                .or(`first_name.ilike.%${combinedName}%,surname.ilike.%${combinedName}%`)
                .limit(3);

            const mapped = (data || []).map((row: any) => ({
                id: row.id,
                name: buildFullName(row.first_name || '', row.surname || ''),
                type: 'dancer',
                city: row.city || null,
            }));

            setPotentialMatches(mapped);
        };

        const timeoutId = setTimeout(searchEntities, 800);
        return () => clearTimeout(timeoutId);
    }, [derivedFirstName, derivedSurname, step]);

  const onSubmit = async (data: FormData) => {
    if (!user) {
            setPendingSubmit(true);
            setStep(authStep);
      return;
    }

        if (!isValidDateString(data.dancing_start_date)) {
            toast({
                title: 'Invalid date',
                description: 'Please choose a valid dance start date.',
                variant: 'destructive',
            });
            return;
        }

    setIsSubmitting(true);
    setProfileError(null);
    try {
      // Process TextAreas into Arrays
      const achievements = data.achievements_text 
        ? data.achievements_text.split('\n').filter(line => line.trim().length > 0)
        : null;
        
      const favorite_songs = data.favorite_songs_text
        ? data.favorite_songs_text.split('\n').filter(line => line.trim().length > 0)
        : null;

            const trimmedFirstName = derivedFirstName.trim();
            const trimmedSurname = derivedSurname.trim();

            if (!trimmedFirstName) {
                toast({
                    title: 'Missing name',
                    description: 'Please complete your name in the sign-up form.',
                    variant: 'destructive',
                });
                return;
            }
            const trimmedCity = normalizeRequiredCity(data.city);
            const canonicalCity = await resolveCanonicalCity(trimmedCity);
            if (!canonicalCity) {
                toast({
                    title: 'Select a valid city',
                    description: 'Please choose your city from the city picker list.',
                    variant: 'destructive',
                });
                return;
            }
            const experienceKey = typeof data.experience_level === 'string' ? data.experience_level : '';
            const experienceYears = experienceKey ? EXPERIENCE_LEVEL_YEARS[experienceKey] : null;
            const resolvedYears = data.dancing_start_date ? null : experienceYears;
            const canonicalPartnerRole = normalizePartnerRole(data.partner_role) || null;
            const canonicalPartnerSearchRole = normalizePartnerRole(data.partner_search_role);
            const normalizedInstagram = normalizeSocialUrl('instagram', data.instagram || '');
            const normalizedFacebook = normalizeSocialUrl('facebook', data.facebook || '');
            const normalizedWebsite = normalizeSocialUrl('website', data.website || '');

            // 1. Create or update Dancer Profile
            const dancerPayload = {
                first_name: trimmedFirstName,
                surname: trimmedSurname || null,
                email: user.email || null,
                verified: false,
        photo_url: serializePhotoValue(data.photo_url),
        is_public: data.is_public,
                hide_surname: false,
            city: canonicalCity.cityName,
        nationality: data.nationality || null,
        dancing_start_date: data.dancing_start_date || null,
        years_dancing: resolvedYears,
        favorite_styles: data.favorite_styles?.length ? data.favorite_styles : null,
        partner_role: canonicalPartnerRole,
        
        achievements: achievements,
        favorite_songs: favorite_songs,
        festival_plans: data.festival_plans?.length ? data.festival_plans : null,
        gallery_urls: data.gallery_urls?.length ? data.gallery_urls : null,

        looking_for_partner: data.looking_for_partner || false,
        partner_search_role: canonicalPartnerSearchRole === 'Leader' || canonicalPartnerSearchRole === 'Follower' ? canonicalPartnerSearchRole : null,
        partner_search_level: data.partner_search_level || null,
        partner_practice_goals: data.partner_practice_goals || null,
        partner_details: serializePartnerDetails(data.partner_details) as unknown as Json | null,
        
        instagram: normalizedInstagram || null,
        facebook: normalizedFacebook || null,
        whatsapp: data.whatsapp || null,
        website: normalizedWebsite || null,
        
        user_id: user.id,
            };

            let didUpdate = false;
            const { data: existingDancer, error: existingDancerError } = await supabase
                .from('dancers')
                .select('id')
                .eq('user_id', user.id)
                .maybeSingle();

            if (existingDancerError) throw existingDancerError;

            if (existingDancer?.id) {
                const { error: dancerUpdateError } = await supabase
                    .from('dancers')
                    .update(dancerPayload)
                    .eq('id', existingDancer.id);
                if (dancerUpdateError) throw dancerUpdateError;
                didUpdate = true;
            } else {
                const { error: dancerInsertError } = await supabase.from('dancers').insert(dancerPayload);
                if (dancerInsertError) throw dancerInsertError;
            }

            // 2. Claim Dancer profile if selected
      if (data.claim_entity_id) {
        const { error: claimError } = await supabase.rpc('claim_dancer_profile' as any, {
          p_dancer_id: data.claim_entity_id,
        } as any);

        if (claimError) {
          console.error('Error claiming entity:', claimError);
        }
      }
      
    localStorage.removeItem(preAuthKey);
    triggerGlobalConfetti();
      toast({
                title: didUpdate ? 'Profile updated' : 'Welcome to the community!',
                description: didUpdate ? 'Your latest details are saved.' : 'Your profile has been successfully created.',
      });
      
    navigate('/profile');
      
    } catch (error: any) {
      toast({
        title: 'Error creating profile',
        description: error.message || 'Something went wrong.',
        variant: 'destructive',
      });
            setProfileError(error.message || 'Something went wrong while creating your profile.');
      setIsSubmitting(false);
    } 
  };

    React.useEffect(() => {
        if (user && pendingSubmit) {
            setPendingSubmit(false);
            form.handleSubmit(onSubmit)();
        }
    }, [form, onSubmit, pendingSubmit, user]);

    useUnsavedChangesGuard({ enabled: form.formState.isDirty && !isSubmitting });

    const handlePreAuthContinue = () => {
        const payload = {
            city: form.getValues('city'),
            nationality: form.getValues('nationality'),
            experience_level: form.getValues('experience_level'),
        };
        localStorage.setItem(preAuthKey, JSON.stringify(payload));
        setStep(1);
        window.scrollTo(0, 0);
    };

  const nextStep = async () => {
     let valid = false;
     if (step === 1) {
         valid = await form.trigger(['dancing_start_date', 'favorite_styles', 'partner_role']);
     } else if (step === 2) {
         valid = await form.trigger(['instagram', 'facebook', 'whatsapp', 'website', 'looking_for_partner']);
     }

     if (valid) {
        setStep(prev => prev + 1);
        window.scrollTo(0, 0);
     }
  };

  const prevStep = () => {
    setStep(prev => prev - 1);
    window.scrollTo(0, 0);
  };

  const fadeInUp = {
     initial: { opacity: 0, y: 20 },
     animate: { opacity: 1, y: 0 },
     exit: { opacity: 0, x: -20 }
  };

  const toggleStyle = (style: string, field: any) => {
    const current = field.value || [];
    if (current.includes(style)) {
      field.onChange(current.filter((v: string) => v !== style));
    } else {
      field.onChange([...current, style]);
    }
  };

        const fillMockData = () => {
                const sampleStyles = FAVORITE_STYLE_OPTIONS.slice(0, 3);
                const samplePartnerRole = PARTNER_ROLE_OPTIONS[0] || 'Leader';
                const sampleSearchRole = PARTNER_SEARCH_ROLE_OPTIONS[0] || 'Follower';
                const sampleSearchLevels = PARTNER_SEARCH_LEVEL_OPTIONS.slice(0, 2);
                const samplePracticeGoals = PARTNER_PRACTICE_GOAL_OPTIONS.slice(0, 2);

                form.setValue('city', 'London', { shouldDirty: true, shouldValidate: true });
                form.setValue('nationality', 'United Kingdom', { shouldDirty: true });
                form.setValue('experience_level', 'Intermediate', { shouldDirty: true });
                form.setValue('dancing_start_date', '2019-01-01', { shouldDirty: true, shouldValidate: true });
                form.setValue('favorite_styles', sampleStyles, { shouldDirty: true });
                form.setValue('partner_role', samplePartnerRole, { shouldDirty: true });
                form.setValue('favorite_songs_text', 'Me Rehúso - Danny Ocean\nInmortal - Aventura\nBachata en Fukuoka - Juan Luis Guerra', { shouldDirty: true });
                form.setValue('achievements_text', 'Regional Social Night Finalist 2024\nCommunity Showcase Winner 2023', { shouldDirty: true });
                form.setValue('festival_plans', [], { shouldDirty: true });
                form.setValue('gallery_urls', ['https://images.unsplash.com/photo-1508804185872-d7badad00f7d'], { shouldDirty: true });

                form.setValue('instagram', 'https://instagram.com/mock.dancer', { shouldDirty: true });
                form.setValue('facebook', 'https://facebook.com/mock.dancer', { shouldDirty: true });
                form.setValue('whatsapp', '+44 7700 900123', { shouldDirty: true });
                form.setValue('website', 'https://mockdancer.example.com', { shouldDirty: true });

                form.setValue('looking_for_partner', true, { shouldDirty: true });
                form.setValue('partner_search_role', sampleSearchRole, { shouldDirty: true });
                form.setValue('partner_search_level', sampleSearchLevels, { shouldDirty: true });
                form.setValue('partner_practice_goals', samplePracticeGoals, { shouldDirty: true });
                form.setValue('partner_details', 'Looking for weekly social practice in London evenings.', { shouldDirty: true });

                form.setValue('is_public', true, { shouldDirty: true });

                toast({
                        title: 'Mock data loaded',
                        description: 'Development sample values have been filled in.',
                });
        };

    return (
        <div className='auth-bright min-h-screen pb-24 relative overflow-hidden'>
            <div className='absolute inset-0 bg-[radial-gradient(circle_at_top,_#FFF3D8,_transparent_60%)]' />
            <div className='absolute -top-16 -right-20 h-72 w-72 rounded-full bg-amber-200/70 blur-3xl' />
            <div className='absolute bottom-0 left-0 h-80 w-80 rounded-full bg-sky-200/70 blur-3xl' />
            <div className='relative z-10 pt-20 px-4 mb-8 max-w-lg mx-auto'>
         <div className='flex justify-between items-center mb-4'>
                                <h1 className='text-xl font-bold text-muted-foreground auth-display'>
                                        {step === 0 ? 'Quick Start' : step === authStep ? 'Finish' : `Step ${step} of 3`}
                                </h1>
            <span className='text-sm font-medium text-primary'>
                     {step === 0 && 'Optional'}
                     {step === 1 && 'Dance Journey'}
                     {step === 2 && 'Socials'}
                     {step === 3 && 'Final Details'}
                     {step === authStep && 'Almost There'}
            </span>
         </div>
         <Progress value={progress} className='h-2' />
      </div>

            <div className='relative z-10 container max-w-xl p-4'>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className='space-y-8'>
                        {import.meta.env.DEV && (
                            <div className='flex justify-end'>
                                <Button type='button' variant='outline' size='sm' onClick={fillMockData}>
                                    Fill mock data
                                </Button>
                            </div>
                        )}
                        {profileError && (
                            <div className='rounded-lg border border-destructive/30 bg-destructive/5 p-4 space-y-3'>
                                <div className='flex items-start gap-3'>
                                    <AlertCircle className='w-5 h-5 text-destructive mt-0.5' />
                                    <p className='text-sm text-destructive'>{profileError}</p>
                                </div>
                                <div className='flex gap-2 flex-wrap'>
                                    <Button
                                        type='button'
                                        variant='outline'
                                        size='sm'
                                        onClick={() => form.handleSubmit(onSubmit)()}
                                        disabled={isSubmitting}
                                    >
                                        Try Again
                                    </Button>
                                    <Button
                                        type='button'
                                        variant='ghost'
                                        size='sm'
                                        onClick={() => setProfileError(null)}
                                    >
                                        Dismiss
                                    </Button>
                                </div>
                            </div>
                        )}
             <AnimatePresence mode='wait'>
                {step === 0 && (
                    <motion.div key='step0' {...fadeInUp} className='space-y-6'>
                        <div className='text-center space-y-2 mb-8'>
                           <div className='inline-flex p-3 rounded-full bg-primary/10 mb-2'>
                              <Users className='w-8 h-8 text-primary' />
                           </div>
                           <h2 className='text-3xl font-black tracking-tight'>A quick start</h2>
                           <p className='text-muted-foreground'>Optional details that help you match faster.</p>
                        </div>

                        <Card className='border-primary/20 bg-background/50 backdrop-blur-sm'>
                            <CardContent className='pt-6 space-y-6'>
                                <FormField
                                    control={form.control}
                                    name='city'
                                    render={({ field }) => (
                                    <FormItem>
                                                                                <FormLabel>
                                                                                    City
                                                                                </FormLabel>
                                                                                <p className='text-xs text-muted-foreground'>Required before finishing your profile.</p>
                                        <FormControl>
                                            <CityPicker
                                                value={field.value}
                                                onChange={(city) => {
                                                    field.onChange(city);
                                                    if (city) triggerCompletionConfetti();
                                                }}
                                                placeholder='Select city...'
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='nationality'
                                    render={({ field }) => (
                                    <FormItem>
                                                                                <FormLabel>
                                                                                    Nationality <span className='text-xs text-muted-foreground'>(optional)</span>
                                                                                </FormLabel>
                                        <FormControl>
                                            <NationalityPicker
                                                value={field.value || ''}
                                                onChange={(val) => {
                                                  field.onChange(val);
                                                  if (val) triggerCompletionConfetti();
                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='experience_level'
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className='text-base'>Experience level <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        <div className='grid grid-cols-2 sm:grid-cols-3 gap-3'>
                                            {EXPERIENCE_LEVEL_OPTIONS.map((level) => (
                                                <div
                                                    key={level}
                                                    onClick={() => {
                                                        field.onChange(level);
                                                        triggerCompletionConfetti();
                                                    }}
                                                    className={`
                                                      cursor-pointer text-center p-3 rounded-xl border-2 transition-all duration-200 text-sm
                                                      ${field.value === level
                                                        ? 'border-primary bg-primary/5 text-primary font-semibold shadow-sm'
                                                        : 'border-muted hover:border-primary/50 text-muted-foreground'}
                                                    `}
                                                >
                                                    {level}
                                                </div>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />
                            </CardContent>
                        </Card>

                            <Button type='button' onClick={handlePreAuthContinue} className='w-full py-6 text-lg rounded-xl shadow-lg shadow-primary/20'>
                                Continue <ChevronRight className='ml-2 w-5 h-5' />
                            </Button>
                    </motion.div>
                )}
                
                {/* STEP 1: DANCE JOURNEY */}
                {step === 1 && (
                    <motion.div key='step1' {...fadeInUp} className='space-y-6'>
                        <div className='text-center space-y-2 mb-8'>
                           <div className='inline-flex p-3 rounded-full bg-primary/10 mb-2'>
                              <Music className='w-8 h-8 text-primary' />
                           </div>
                           <h2 className='text-3xl font-black tracking-tight'>What moves you?</h2>
                           <p className='text-muted-foreground'>Let's start with the fun stuff.</p>
                        </div>

                        <Card className='border-primary/20 bg-background/50 backdrop-blur-sm'>
                            <CardContent className='pt-6 space-y-6'>
                                <FormField
                                    control={form.control}
                                    name='partner_role'
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className='text-base font-semibold'>I usually dance as... <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        <div className='grid grid-cols-3 gap-3'>
                                            {PARTNER_ROLE_OPTIONS.map((role) => (
                                                <div 
                                                    key={role}
                                                    onClick={() => {
                                                        field.onChange(role);
                                                        triggerCompletionConfetti();
                                                    }}
                                                    className={`
                                                      cursor-pointer text-center p-4 rounded-xl border-2 transition-all duration-200
                                                      ${field.value === role 
                                                        ? 'border-primary bg-primary/5 text-primary font-bold shadow-sm' 
                                                        : 'border-muted hover:border-primary/50 text-muted-foreground'}
                                                    `}
                                                >
                                                    {role}
                                                </div>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='favorite_styles'
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel className='text-base font-semibold'>My favorite styles are... <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        <div className='grid grid-cols-1 sm:grid-cols-2 gap-3'>
                                            {FAVORITE_STYLE_OPTIONS.map((style) => (
                                                <div 
                                                    key={style}
                                                    onClick={(e) => {
                                                        toggleStyle(style, field);
                                                        if (!field.value?.includes(style)) {
                                                            triggerMicroConfetti(e.clientX, e.clientY);
                                                            triggerCompletionConfetti();
                                                        }
                                                    }}
                                                    className={`
                                                        relative cursor-pointer p-4 rounded-xl border-2 transition-all flex items-center gap-3
                                                        ${field.value?.includes(style) 
                                                            ? 'border-purple-500 bg-purple-500/5 text-purple-700 dark:text-purple-300 shadow-sm' 
                                                            : 'border-muted hover:border-purple-200 text-muted-foreground'}
                                                    `}
                                                >
                                                    {field.value?.includes(style) ? (
                                                        <CheckCircle className='w-5 h-5 text-purple-600 shrink-0' />
                                                    ) : (
                                                        <div className='w-5 h-5 rounded-full border-2 border-muted shrink-0' />
                                                    )}
                                                    <span className='font-medium'>{style}</span>
                                                </div>
                                            ))}
                                        </div>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='dancing_start_date'
                                    render={({ field }) => (
                                    <FormItem className="pt-2">
                                        <FormLabel className='text-base font-semibold'>Dance start date <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        <FormControl>
                                            <ExperiencePicker
                                                value={field.value}
                                                                                                onChange={(value) => {
                                                                                                    field.onChange(value);
                                                                                                    if (value) triggerCompletionConfetti();
                                                                                                }}
                                                showLabel={true}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='favorite_songs_text'
                                    render={({ field }) => (
                                    <FormItem>
                                        <div className='flex items-center gap-2 mb-2 mt-6'>
                                            <div className='p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg'>
                                                <Music className='w-5 h-5 text-purple-600 dark:text-purple-400' />
                                            </div>
                                            <FormLabel className='text-xl font-bold m-0'>Soundtrack of your Life <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        </div>
                                        <FormDescription className='text-base mb-4'>
                                            What gets you on the dance floor?
                                        </FormDescription>
                                        <FormControl>
                                            <GamifiedSongSelector 
                                                value={field.value}
                                                                                                onChange={(value) => {
                                                                                                    field.onChange(value);
                                                                                                    if (value) triggerCompletionConfetti();
                                                                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='achievements_text'
                                    render={({ field }) => (
                                    <FormItem>
                                        <div className='flex items-center gap-2 mb-4'>
                                            <div className='p-2 bg-yellow-100 dark:bg-yellow-900/20 rounded-lg'>
                                                <Sparkles className='w-5 h-5 text-yellow-600 dark:text-yellow-400' />
                                            </div>
                                            <div>
                                                <FormLabel className='text-xl font-bold m-0'>Wall of Fame <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                                <FormDescription className='text-sm m-0'>Show off your badges & hardware!</FormDescription>
                                            </div>
                                        </div>
                                        <FormControl>
                                            <AchievementWall 
                                                value={field.value}
                                                                                                onChange={(value) => {
                                                                                                    field.onChange(value);
                                                                                                    if (value) triggerCompletionConfetti();
                                                                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='festival_plans'
                                    render={({ field }) => (
                                    <FormItem>
                                        <div className='flex items-center gap-2 mb-4'>
                                            <div className='p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg'>
                                                <Calendar className='w-5 h-5 text-blue-600 dark:text-blue-300' />
                                            </div>
                                            <div>
                                                <FormLabel className='text-xl font-bold m-0'>Festival Plans <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                                <FormDescription className='text-sm m-0'>Pin the festivals you plan to attend.</FormDescription>
                                            </div>
                                        </div>
                                        <FormControl>
                                            <FestivalPlansPicker
                                                value={field.value || []}
                                                                                                onChange={(value) => {
                                                                                                    field.onChange(value);
                                                                                                    if (value?.length) triggerCompletionConfetti();
                                                                                                }}
                                            />
                                        </FormControl>
                                        <FormMessage />
                                    </FormItem>
                                    )}
                                />

                            </CardContent>
                        </Card>

                        <Button type='button' onClick={nextStep} className='w-full py-6 text-lg rounded-xl shadow-lg shadow-primary/20'>
                             Continue to Socials <ChevronRight className='ml-2 w-5 h-5' />
                        </Button>
                    </motion.div>
                )}

                {/* STEP 2: SOCIALS */}
                {step === 2 && (
                    <motion.div key='step2' {...fadeInUp} className='space-y-6'>
                        <div className='text-center space-y-2 mb-8'>
                           <div className='inline-flex p-3 rounded-full bg-pink-500/10 mb-2'>
                              <Instagram className='w-8 h-8 text-pink-500' />
                           </div>
                           <h2 className='text-3xl font-black tracking-tight'>Get Connected</h2>
                           <p className='text-muted-foreground'>How can people reach you?</p>
                        </div>

                        <Card className='border-pink-200 dark:border-pink-900 bg-background/50 backdrop-blur-sm'>
                            <CardContent className='pt-6 space-y-6'>
                                <FormField
                                    control={form.control}
                                    name='instagram'
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Instagram Handle <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        <FormControl>
                                        <div className='relative'>
                                            <Instagram className='absolute left-3 top-3 w-5 h-5 text-muted-foreground' />
                                                                                        <Input
                                                                                            placeholder='@username'
                                                                                            className='pl-10 h-12'
                                                                                            {...field}
                                                                                            onBlur={(e) => {
                                                                                                field.onBlur();
                                                                                                field.onChange(normalizeSocialUrl('instagram', e.target.value));
                                                                                                maybeTriggerConfetti(e.target.value);
                                                                                            }}
                                                                                        />
                                        </div>
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />

                                                                <FormField
                                                                        control={form.control}
                                                                        name='gallery_urls'
                                                                        render={({ field }) => {
                                                                            const currentUrls = field.value || [];

                                                                            return (
                                                                            <FormItem>
                                                                                <FormLabel>Gallery URLs <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                                                                <FormControl>
                                                                                    <Input
                                                                                        placeholder='Paste image URL and press Enter'
                                                                                        value={galleryUrlDraft}
                                                                                        onChange={(e) => setGalleryUrlDraft(e.target.value)}
                                                                                        onKeyDown={(e) => {
                                                                                            if (e.key === 'Enter') {
                                                                                                e.preventDefault();
                                                                                                const trimmed = galleryUrlDraft.trim();
                                                                                                if (!trimmed) return;
                                                                                                if (currentUrls.includes(trimmed)) {
                                                                                                    setGalleryUrlDraft('');
                                                                                                    return;
                                                                                                }
                                                                                                field.onChange([...currentUrls, trimmed]);
                                                                                                setGalleryUrlDraft('');
                                                                                            }
                                                                                        }}
                                                                                    />
                                                                                </FormControl>
                                                                                <div className='flex flex-wrap gap-2 mt-2'>
                                                                                    {currentUrls.map((url, index) => (
                                                                                        <Badge
                                                                                            key={`gallery-url-${index}`}
                                                                                            variant='secondary'
                                                                                            className='cursor-pointer'
                                                                                            onClick={() => field.onChange(currentUrls.filter((_, itemIndex) => itemIndex !== index))}
                                                                                        >
                                                                                            {url} ×
                                                                                        </Badge>
                                                                                    ))}
                                                                                </div>
                                                                            </FormItem>
                                                                            );
                                                                        }}
                                                                />

                                <FormField
                                    control={form.control}
                                    name='whatsapp'
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>WhatsApp <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        <FormControl>
                                        <div className='relative'>
                                            <Phone className='absolute left-3 top-3 w-5 h-5 text-muted-foreground' />
                                                                                        <Input
                                                                                            placeholder='+44 7XXX XXX XXX'
                                                                                            className='pl-10 h-12'
                                                                                            {...field}
                                                                                            onBlur={(e) => {
                                                                                                field.onBlur();
                                                                                                maybeTriggerConfetti(e.target.value);
                                                                                            }}
                                                                                        />
                                        </div>
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='website'
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Website / Linktree <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        <FormControl>
                                        <div className='relative'>
                                            <Globe className='absolute left-3 top-3 w-5 h-5 text-muted-foreground' />
                                                                                        <Input
                                                                                            placeholder='https://...'
                                                                                            className='pl-10 h-12'
                                                                                            {...field}
                                                                                            onBlur={(e) => {
                                                                                                field.onBlur();
                                                                                                field.onChange(normalizeSocialUrl('website', e.target.value));
                                                                                                maybeTriggerConfetti(e.target.value);
                                                                                            }}
                                                                                        />
                                        </div>
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />

                                <FormField
                                    control={form.control}
                                    name='facebook'
                                    render={({ field }) => (
                                    <FormItem>
                                        <FormLabel>Facebook <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                        <FormControl>
                                        <div className='relative'>
                                            <Facebook className='absolute left-3 top-3 w-5 h-5 text-muted-foreground' />
                                                                                        <Input
                                                                                            placeholder='facebook.com/name'
                                                                                            className='pl-10 h-12'
                                                                                            {...field}
                                                                                            onBlur={(e) => {
                                                                                                field.onBlur();
                                                                                                field.onChange(normalizeSocialUrl('facebook', e.target.value));
                                                                                                maybeTriggerConfetti(e.target.value);
                                                                                            }}
                                                                                        />
                                        </div>
                                        </FormControl>
                                    </FormItem>
                                    )}
                                />

                                <div className='bg-primary/5 p-4 rounded-xl border border-primary/10 space-y-4'>
                                    <FormField
                                        control={form.control}
                                        name='looking_for_partner'
                                        render={({ field }) => (
                                        <FormItem className='flex flex-row items-center justify-between'>
                                            <div className='space-y-0.5'>
                                            <FormLabel className='flex items-center gap-2 text-base'>
                                                <Users className='w-5 h-5 text-primary' />
                                                Open to Practice?
                                            </FormLabel>
                                            <FormDescription>
                                                Let others know you're interested in training together
                                            </FormDescription>
                                            </div>
                                            <FormControl>
                                            <Switch
                                                                                                checked={field.value}
                                                                                                onCheckedChange={(checked) => {
                                                                                                    field.onChange(checked);
                                                                                                    if (checked) triggerCompletionConfetti();
                                                                                                }}
                                            />
                                            </FormControl>
                                        </FormItem>
                                        )}
                                    />
                                    
                                    {form.watch('looking_for_partner') && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 6 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="space-y-4 overflow-hidden pt-2 border-t border-primary/10"
                                        >
                                            <FormField
                                                control={form.control}
                                                name="partner_search_role"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>I'm looking for a... <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                                        <Select
                                                            onValueChange={(value) => {
                                                              field.onChange(value);
                                                              if (value) triggerCompletionConfetti();
                                                            }}
                                                            defaultValue={field.value}
                                                        >
                                                            <FormControl>
                                                                <SelectTrigger className="bg-background">
                                                                    <SelectValue placeholder="Select role" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {PARTNER_SEARCH_ROLE_OPTIONS.map(role => (
                                                                    <SelectItem key={role} value={role}>{role}</SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="partner_search_level"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Preferred Level(s) <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                                        <div className="flex flex-wrap gap-2">
                                                            {PARTNER_SEARCH_LEVEL_OPTIONS.map(level => (
                                                                <div
                                                                    key={level}
                                                                    onClick={() => {
                                                                        if (!field.value?.includes(level)) {
                                                                            triggerCompletionConfetti();
                                                                        }
                                                                        toggleStyle(level, field);
                                                                    }}
                                                                    className={`
                                                                        cursor-pointer px-3 py-1.5 rounded-full text-sm border transition-colors
                                                                        ${field.value?.includes(level)
                                                                            ? 'bg-primary text-primary-foreground border-primary'
                                                                            : 'bg-background border-input hover:bg-accent'}
                                                                    `}
                                                                >
                                                                    {level}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="partner_practice_goals"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Practice Goals <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                                        <div className="flex flex-wrap gap-2">
                                                            {PARTNER_PRACTICE_GOAL_OPTIONS.map(goal => (
                                                                <div
                                                                    key={goal}
                                                                    onClick={() => {
                                                                        if (!field.value?.includes(goal)) {
                                                                            triggerCompletionConfetti();
                                                                        }
                                                                        toggleStyle(goal, field);
                                                                    }}
                                                                    className={`
                                                                        cursor-pointer px-3 py-1.5 rounded-full text-sm border transition-colors
                                                                        ${field.value?.includes(goal)
                                                                            ? 'bg-secondary text-secondary-foreground border-secondary'
                                                                            : 'bg-background border-input hover:bg-accent'}
                                                                    `}
                                                                >
                                                                    {goal}
                                                                </div>
                                                            ))}
                                                        </div>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />

                                            <FormField
                                                control={form.control}
                                                name="partner_details"
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel>Details <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                                        <p className='text-xs text-muted-foreground'>Mention upcoming events so people can see your plan.</p>
                                                        <FormControl>
                                                            <Textarea 
                                                                placeholder="Describe your availability, goals, or what makes a great partner for you..."
                                                                className="bg-background"
                                                                                                                                {...field}
                                                                                                                                onBlur={(e) => {
                                                                                                                                    field.onBlur();
                                                                                                                                    maybeTriggerConfetti(e.target.value);
                                                                                                                                }}
                                                            />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </motion.div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>

                        <div className='flex gap-4'>
                            <Button type='button' variant='outline' onClick={prevStep} className='flex-1 py-6'>
                                <ChevronLeft className='mr-2 w-5 h-5' /> Back
                            </Button>
                             <Button type='button' onClick={nextStep} className='flex-[2] py-6 text-lg rounded-xl shadow-lg'>
                                Next Step <ChevronRight className='ml-2 w-5 h-5' />
                            </Button>
                        </div>
                    </motion.div>
                )}

                {/* STEP 3: PERSONAL */}
                {step === 3 && (
                    <motion.div key='step3' {...fadeInUp} className='space-y-6'>
                         <div className='text-center space-y-2 mb-8'>
                           <div className='inline-flex p-3 rounded-full bg-slate-100 dark:bg-slate-800 mb-2'>
                              <User className='w-8 h-8 text-slate-600 dark:text-slate-300' />
                           </div>
                           <h2 className='text-3xl font-black tracking-tight'>Who are you?</h2>
                           <p className='text-muted-foreground'>The official details.</p>
                        </div>

                        <Card className='glow-card'>
                            <CardContent className='pt-6 space-y-5'>
                                {/* Avatar Upload Section */}
                                <div className="flex justify-center mb-6">
                                    <p className='text-xs text-muted-foreground text-center'>Photo <span className='text-xs text-muted-foreground'>(optional)</span></p>
                                    <FormField
                                        control={form.control}
                                        name="photo_url"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                                                                        <AvatarUpload
                                                                                                                userId={user?.id || 'new'}
                                                                                                                value={field.value}
                                                                                                                onChange={field.onChange}
                                                                                                                initials={getInitials({
                                                                                                                            first_name: derivedFirstName,
                                                                                                                            surname: derivedSurname,
                                                                                                                }) || 'ME'}
                                                                                                        />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                

                                {/* DYNAMIC CLAIM SUGGESTION */}
                                <AnimatePresence>
                                {potentialMatches.length > 0 && (
                                    <motion.div 
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: 'auto' }}
                                        exit={{ opacity: 0, height: 0 }}
                                        className='overflow-hidden'
                                    >
                                        <div className='bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-lg p-4 space-y-3'>
                                            <div className='flex items-center gap-2 text-amber-600 dark:text-amber-500 font-semibold'>
                                                <AlertCircle className='w-5 h-5' />
                                                Found a similar profile! Is this you?
                                            </div>
                                            {potentialMatches.map(entity => (
                                                <div 
                                                    key={entity.id}
                                                    onClick={() => {
                                                        const current = form.getValues('claim_entity_id');
                                                        form.setValue('claim_entity_id', current === entity.id ? '' : entity.id);
                                                    }}
                                                    className={`
                                                      flex items-center justify-between p-3 rounded-md border cursor-pointer bg-white dark:bg-background
                                                      ${form.watch('claim_entity_id') === entity.id 
                                                        ? 'border-amber-600 ring-2 ring-amber-500/20' 
                                                        : 'border-border hover:bg-muted/50'}
                                                    `}
                                                >
                                                    <div>
                                                        <p className='font-bold'>{entity.name}</p>
                                                        <p className='text-xs text-muted-foreground uppercase'>{entity.type}  {entity.city || 'No City'}</p>
                                                    </div>
                                                    {form.watch('claim_entity_id') === entity.id && (
                                                        <CheckCircle className='w-5 h-5 text-green-500' />
                                                    )}
                                                </div>
                                            ))}
                                            <p className='text-xs text-muted-foreground'>
                                                Select it to automatically link this professional profile to your account.
                                            </p>
                                        </div>
                                    </motion.div>
                                )}
                                </AnimatePresence>

                                <div className='grid grid-cols-2 gap-4'>
                                    <FormField
                                        control={form.control}
                                        name='city'
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>City</FormLabel>
                                            <FormControl>
                                                <CityPicker
                                                    value={field.value}
                                                    onChange={(city) => field.onChange(city)}
                                                    placeholder='Select city...'
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name='nationality'
                                        render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Nationality <span className='text-xs text-muted-foreground'>(optional)</span></FormLabel>
                                            <FormControl>
                                                <NationalityPicker
                                                    value={field.value || ''}
                                                    onChange={(val) => field.onChange(val)}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                        )}
                                    />
                                </div>

                            </CardContent>
                        </Card>

                        <div className='flex gap-4'>
                            <Button type='button' variant='outline' onClick={prevStep} className='flex-1 py-6'>
                                <ChevronLeft className='mr-2 w-5 h-5' /> Back
                            </Button>
                             <Button 
                                type='submit' 
                                disabled={isSubmitting}
                                className='flex-[2] py-6 text-lg font-bold rounded-xl shadow-xl shadow-primary/20 btn-primary'
                            >
                                {isSubmitting ? (
                                    <div className='w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin' />
                                ) : (
                                    <>
                                        Finish & Create Profile <Sparkles className='ml-2 w-5 h-5' />
                                    </>
                                )}
                            </Button>
                        </div>
                    </motion.div>
                )}

                {step === authStep && (
                    <motion.div key='step-auth' {...fadeInUp} className='space-y-6'>
                        <div className='text-center space-y-2 mb-8'>
                           <div className='inline-flex p-3 rounded-full bg-primary/10 mb-2'>
                              <User className='w-8 h-8 text-primary' />
                           </div>
                           <h2 className='text-3xl font-black tracking-tight auth-display'>Unlock your profile</h2>
                           <p className='text-muted-foreground'>One last step to save your spot.</p>
                        </div>

                        <div className='flex justify-center'>
                            <AuthStepper
                                returnTo={returnTo}
                                userType='dancer'
                                onAuthenticated={() => setPendingSubmit(true)}
                                showIntentSelect={false}
                                initialIntent='returning'
                                title='Quick unlock'
                                subtitle='Sign in to publish.'
                            />
                        </div>

                        <Button type='button' variant='outline' onClick={() => setStep(3)} className='w-full'>
                            Back to Profile
                        </Button>
                    </motion.div>
                )}

             </AnimatePresence>
          </form>
        </Form>
      </div>
    </div>
  );
};

export default CreateProfile;


