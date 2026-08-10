import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BadgeCheck,
  CalendarDays,
  Facebook,
  Instagram,
  Link2,
  MapPin,
  Plus,
  Search,
  Sparkles,
  Target,
  UserRound,
  Users,
  X,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useCity } from '@/contexts/CityContext';
import { buildCityPath } from '@/lib/cityPath';
import { useToast } from '@/hooks/use-toast';
import { setAttendanceRpc } from '@/hooks/useAttendance';
import { supabase } from '@/integrations/supabase/client';
import { captureException } from '@/lib/sentry';
import type { Json } from '@/integrations/supabase/types';
import { getPhotoUrl, parsePartnerDetails, type PartnerDetailsValue } from '@/lib/utils';
import { buildFullName, normalizeDancerRecord, normalizeUserMetadata } from '@/lib/name-utils';
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import { optimizedImageUrl } from '@/lib/imageCdn';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { CityPicker } from '@/components/ui/city-picker';
import { ExperiencePicker } from '@/components/profile/ExperiencePicker';
import { dateStringFromDanceStartedYear, saveMyDancerProfile } from '@/lib/saveMyDancerProfile';
import {
  buildDashboardSectionPayload,
  dancerRoleFromStored,
  type DancerEditorForm,
} from '@/lib/dancerEditorPayloads';
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
  // Every field here is a real column on dancer_profiles. `city`, `city_id`,
  // `years_dancing`, `dancing_start_date`, `partner_role` and `verified` used to
  // sit alongside them, none of them columns, kept alive only so the deferred
  // direct-to-table write kept compiling. That write is gone, so they are too.
  based_city_id: string | null;
  dance_role: string | null;
  dance_started_year: number | null;
  website_url?: string | null;
  avatar_url?: string | null;
  cities?: { name: string } | null;
  nationality: string | null;
  favorite_styles: string[] | null;
  photo_url: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp?: string | null;
  website: string | null;
  looking_for_partner: boolean | null;
  achievements: string[] | null;
  favorite_songs: string[] | null;
  partner_search_role: string | null;
  partner_search_level: string[] | null;
  partner_practice_goals: string[] | null;
  partner_details: Json | null;
}

type AttendanceKind = 'events' | 'festivals';
type AttendanceStatus = 'interested' | 'going';

interface AttendanceCard {
  event_id: string;
  name: string;
  date: string | null;
  city: string | null;
  status: AttendanceStatus;
  kind: AttendanceKind;
}

interface AttendanceSearchResult {
  id: string;
  name: string;
  date: string | null;
  city: string | null;
  type: string | null;
}

/**
 * The form shape lives with the payload builders, so the mapping and the form it
 * maps from cannot drift apart.
 */
type EditFormData = DancerEditorForm;

type TileStatus = 'live' | 'attention';
type EditorSection = 'identity' | 'career' | 'partner' | 'social';

type CoreTile = {
  key: 'identity' | 'activity' | 'engagement' | 'career' | 'social';
  title: string;
  subtitle: string;
  preview: string;
  actionLabel: string;
  status: TileStatus;
  icon: LucideIcon;
  sizeClass: string;
  onAction: () => void;
};

const emptyEditForm: EditFormData = {
  first_name: '',
  surname: '',
  city: '',
  instagram: '',
  facebook: '',
  whatsapp: '',
  website: '',
  dancing_start_date: '',
  partner_role: '',
  achievements: [],
  favorite_songs: [],
  partner_search_role: '',
  partner_search_level: [],
  partner_practice_goals: [],
  partner_details: '',
  favorite_styles: [],
  looking_for_partner: false,
  photo_url: '',
};

/**
 * How long the partner textarea waits before it saves. It used to write once PER
 * KEYSTROKE: a 200-character blurb was 200 SECURITY DEFINER round trips, and the
 * responses are unordered, so an old one landing last repainted the profile from
 * a stale row.
 */
const PARTNER_AUTOSAVE_DEBOUNCE_MS = 600;

const isValidDateString = (value?: string | null) => {
  if (!value) return true;
  const parsed = new Date(value);
  return !Number.isNaN(parsed.getTime());
};

const statusTone: Record<TileStatus, string> = {
  live: 'border-emerald-400/30 bg-emerald-500/10 text-emerald-100',
  attention: 'border-orange-400/35 bg-orange-500/10 text-orange-100',
};

const attendanceBadgeTone: Record<AttendanceStatus, string> = {
  interested: 'border-cyan-300/40 bg-cyan-400/10 text-cyan-100',
  going: 'border-emerald-300/40 bg-emerald-400/10 text-emerald-100',
};

const attendanceStatusCycle: AttendanceStatus[] = ['interested', 'going'];

const normalizeAttendanceStatus = (value?: string | null): AttendanceStatus => {
  if (value === 'going' || value === 'interested') {
    return value;
  }
  return 'interested';
};

const isFestivalType = (type?: string | null) => (type || '').trim().toLowerCase() === 'festival';

const formatAttendanceDate = (value?: string | null) => {
  if (!value) return 'Date TBA';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return 'Date TBA';
  return parsed.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

export const DancerDashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const { citySlug } = useCity();

  const [profile, setProfile] = useState<DancerProfile | null>(null);
  const [selectedEvents, setSelectedEvents] = useState<AttendanceCard[]>([]);
  const [selectedFestivals, setSelectedFestivals] = useState<AttendanceCard[]>([]);
  const [eventSearchTerm, setEventSearchTerm] = useState('');
  const [festivalSearchTerm, setFestivalSearchTerm] = useState('');
  const [eventSearchResults, setEventSearchResults] = useState<AttendanceSearchResult[]>([]);
  const [festivalSearchResults, setFestivalSearchResults] = useState<AttendanceSearchResult[]>([]);
  const [isSearchingEvents, setIsSearchingEvents] = useState(false);
  const [isSearchingFestivals, setIsSearchingFestivals] = useState(false);
  const [pendingAttendanceIds, setPendingAttendanceIds] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [activeEditor, setActiveEditor] = useState<EditorSection | null>(null);
  const [isInlinePartnerEditorOpen, setIsInlinePartnerEditorOpen] = useState(false);
  const [editForm, setEditForm] = useState<EditFormData>(emptyEditForm);
  const [isSaving, setIsSaving] = useState(false);

  const [newFavoriteSong, setNewFavoriteSong] = useState('');
  const [newAchievement, setNewAchievement] = useState('');

  // Autosave plumbing. A monotonic ticket per save, so a response that a later
  // save has already superseded cannot repaint the profile from a stale row; plus
  // the pending debounced form, which ANY immediate save supersedes -- it is built
  // from the same editForm, so it already carries whatever the pending one held.
  const partnerSaveSeqRef = useRef(0);
  const partnerDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPartnerFormRef = useRef<EditFormData | null>(null);
  const partnerSaveChainRef = useRef<Promise<unknown>>(Promise.resolve());
  const isMountedRef = useRef(true);

  /**
   * editForm plus a ref that always mirrors it, and the ONLY way to set it.
   *
   * The partner handlers have to read the form and save it in the same tick. They
   * cannot read the `editForm` closure: React batches, so two badge taps landing
   * in one batch both see the pre-first-tap value, the second overwrites the
   * first, and the save writes the whole partner section -- undoing the first tap
   * in the DATABASE, not just on screen. They cannot compute inside a setState
   * updater either: React double-runs updaters in development, which is two
   * SECURITY DEFINER writes per tap. Computing from the ref does both jobs, and
   * returning the next form lets the caller save exactly what it just set.
   */
  const editFormRef = useRef<EditFormData>(emptyEditForm);
  const applyEditForm = (
    updater: EditFormData | ((prev: EditFormData) => EditFormData)
  ): EditFormData => {
    const next =
      typeof updater === 'function'
        ? (updater as (prev: EditFormData) => EditFormData)(editFormRef.current)
        : updater;
    editFormRef.current = next;
    setEditForm(next);
    return next;
  };

  const calendarPath = citySlug ? buildCityPath(citySlug, 'calendar') : '/';

  /**
   * Stored row -> form. PURE, because the partner tile must build a hydrated form
   * and use it in the same tick: it saves the whole partner section, and a
   * setEditForm would not have landed by then. Reading the unhydrated editForm
   * there was the round-1 defect -- every badge rendered unselected, a lie about
   * stored state, and the first tap wrote those blanks over the real values.
   */
  const buildEditForm = (dancer: DancerProfile): EditFormData => ({
    first_name: dancer.first_name || '',
    surname: dancer.surname || '',
    // The city picker's value is a city ID, so based_city_id feeds it directly.
    city: dancer.based_city_id || '',
    instagram: dancer.instagram || '',
    facebook: dancer.facebook || '',
    whatsapp: dancer.whatsapp || '',
    website: dancer.website_url || dancer.website || '',
    dancing_start_date: dateStringFromDanceStartedYear(dancer.dance_started_year),
    partner_role: dancerRoleFromStored(dancer.dance_role),
    achievements: dancer.achievements || [],
    favorite_songs: dancer.favorite_songs || [],
    // RAW, unlike dance_role. partner_search_role is free text on the sidecar --
    // no CHECK, and no DB helper normalises it -- so routing it through the role
    // codec maps anything outside that map to "", and "" CLEARS the column. A
    // value written by any other surface would then be deleted by nothing more
    // than flipping the Partner Mode switch, which saves the whole section.
    partner_search_role: dancer.partner_search_role || '',
    partner_search_level: dancer.partner_search_level || [],
    partner_practice_goals: dancer.partner_practice_goals || [],
    partner_details: parsePartnerDetails(dancer.partner_details as PartnerDetailsValue),
    favorite_styles: dancer.favorite_styles || [],
    looking_for_partner: dancer.looking_for_partner || false,
    // The WRITABLE column, not the MIRROR. `photo_url` is maintained by the
    // function from avatar_url, and this screen additionally stores it as the
    // getPhotoUrl display value -- so seeding the form from it round-trips a
    // derived, possibly stale value back into the authoritative column on the
    // next identity save.
    //
    // An earlier version of this comment said getPhotoUrl rewrites non-http
    // values onto a hardcoded `events` bucket. It does not: it unwraps arrays and
    // JSON-array strings and otherwise returns the string unchanged (lib/utils).
    // The change is still right; the reason recorded here was not.
    photo_url: dancer.avatar_url || '',
  });

  /**
   * Hydrates from the row WITHOUT discarding partner edits that are still in
   * flight. Hydrating replaces editForm wholesale, and a debounced save holding
   * the user's latest blurb has not landed yet -- so `profile` would hand back
   * the older text, the timer would save the newer one, and the next partner
   * save would build from the reverted form and write the old text back over it.
   * The pending form was itself built from a hydrated editForm, so its partner
   * fields are the newer of the two by construction.
   */
  const hydrateEditForm = (dancer: DancerProfile, pending: EditFormData | null) => {
    const hydrated = buildEditForm(dancer);
    applyEditForm(
      pending
        ? {
            ...hydrated,
            looking_for_partner: pending.looking_for_partner,
            partner_search_role: pending.partner_search_role,
            partner_search_level: pending.partner_search_level,
            partner_practice_goals: pending.partner_practice_goals,
            partner_details: pending.partner_details,
          }
        : hydrated
    );
  };

  /**
   * Repaint from the row the function RETURNED, not from a locally assembled
   * guess. The guess is what drifts: it used to write `city`, `city_id`,
   * `dancing_start_date` and `partner_role` into local state, none of them
   * columns, so the city label under the avatar stayed stale after every save.
   */
  const applySavedProfile = (saved: Record<string, unknown>, cities?: { name: string } | null) => {
    const normalized = normalizeDancerRecord(saved) as unknown as DancerProfile;
    setProfile((prev) =>
      prev
        ? {
            ...normalized,
            // `undefined` means "the caller did not resolve a city", which is not
            // the same as "the city was removed".
            cities: cities === undefined ? prev.cities : cities,
            photo_url: getPhotoUrl(normalized.photo_url) || '',
          }
        : prev
    );
  };

  const openEditor = (section: EditorSection) => {
    if (!profile) return;
    // This is the one place that throws editForm away, so a debounced partner
    // save has to be sent before it goes -- and carried, because it will not
    // have landed in `profile` by the time we read it.
    hydrateEditForm(profile, flushPendingPartnerAutosave());
    setNewFavoriteSong('');
    setNewAchievement('');
    if (section === 'partner') {
      setIsInlinePartnerEditorOpen(true);
      return;
    }
    setActiveEditor(section);
  };

  useEffect(() => {
    const fetchData = async () => {
      if (!user) return;

      setIsLoading(true);
      try {
        const { data: dancer } = await supabase
          .from('dancer_profiles')
          .select('*, cities!based_city_id(name)')
          // OWNERSHIP, not authorship -- the full note is on AuthGuard.
          .eq('id', user.id)
          .maybeSingle();

        if (!dancer) {
          setProfile(null);
          return;
        }

        const normalized = normalizeDancerRecord(dancer);
        setProfile({
          ...normalized,
          photo_url: getPhotoUrl(normalized.photo_url) || '',
        });

        const { data: rawAttendance, error: attendanceError } = await supabase.rpc('get_my_event_attendance_v1');

        if (attendanceError) {
          throw attendanceError;
        }

        const participantRows = (rawAttendance || []).map((r: any) => ({
          event_id: r.event_id as string,
          status: r.status as string,
        }));
        if (!participantRows.length) {
          setSelectedEvents([]);
          setSelectedFestivals([]);
          return;
        }

        const participantMap = new Map(participantRows.map((row) => [row.event_id, normalizeAttendanceStatus(row.status)]));
        const eventIds = Array.from(new Set(participantRows.map((row) => row.event_id)));

        let eventQuery = supabase
          .from('events')
          .select('id, name, date, city, type, city_slug, is_active')
          .in('id', eventIds);

        if (citySlug) {
          eventQuery = eventQuery.eq('city_slug', citySlug);
        }

        const { data: eventRows, error: eventsError } = await eventQuery;
        if (eventsError) {
          throw eventsError;
        }

        const normalizedRows = ((eventRows || []) as Array<{
          id: string;
          name: string;
          date: string | null;
          city: string | null;
          type: string | null;
        }>).map((event) => {
          const kind: AttendanceKind = isFestivalType(event.type) ? 'festivals' : 'events';
          return {
            event_id: event.id,
            name: event.name,
            date: event.date,
            city: event.city,
            status: participantMap.get(event.id) || 'interested',
            kind,
          } satisfies AttendanceCard;
        });

        setSelectedEvents(normalizedRows.filter((item) => item.kind === 'events'));
        setSelectedFestivals(normalizedRows.filter((item) => item.kind === 'festivals'));
      } catch (error) {
        captureException(error, { context: 'DancerDashboard.fetchData' });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [citySlug, user]);

  const hasIdentity = Boolean(profile?.first_name?.trim()) && Boolean(profile?.based_city_id);
  const hasMedia = Boolean(profile?.photo_url?.trim());
  const allAttendance = useMemo(() => [...selectedEvents, ...selectedFestivals], [selectedEvents, selectedFestivals]);
  const eventCounts = useMemo(
    () => ({
      going: allAttendance.filter((item) => item.status === 'going').length,
      interested: allAttendance.filter((item) => item.status === 'interested').length,
    }),
    [allAttendance]
  );
  const confirmedEvents = useMemo(
    () =>
      allAttendance
        .filter((item) => item.date && item.status === 'going' && new Date(item.date) > new Date())
        .map((item) => ({ id: item.event_id, name: item.name, date: item.date as string }))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()),
    [allAttendance]
  );
  const nextEvent = confirmedEvents[0] || null;
  const hasActivity = allAttendance.length > 0;
  const hasEngagement = Boolean(profile?.looking_for_partner) || Boolean(profile?.dance_role);
  const hasSocial = Boolean(profile?.instagram || profile?.facebook || profile?.whatsapp || profile?.website);

  const completionSteps = [hasIdentity, hasMedia, hasActivity, hasEngagement, hasSocial];
  const completionCount = completionSteps.filter(Boolean).length;
  const completionPercent = Math.round((completionCount / completionSteps.length) * 100);
  const momentumScore = Math.min(100, Math.round(((allAttendance.length + confirmedEvents.length) / 8) * 100));
  const danceYears = profile?.dance_started_year
    ? Math.max(0, new Date().getFullYear() - profile.dance_started_year)
    : 0;

  const metadataNames = normalizeUserMetadata((user?.user_metadata as Record<string, unknown> | undefined) || undefined);
  const fullName =
    buildFullName(profile?.first_name, profile?.surname) ||
    buildFullName(metadataNames.first_name, metadataNames.surname) ||
    'Dancer';
  const avatarUrl = profile?.photo_url || user?.user_metadata?.avatar_url;
  const nextEventLabel = nextEvent
    ? new Date(nextEvent.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
    : null;

  const toggleStyle = (style: string) => {
    const styles = editForm.favorite_styles.includes(style)
      ? editForm.favorite_styles.filter((item) => item !== style)
      : [...editForm.favorite_styles, style];
    applyEditForm((prev) => ({ ...prev, favorite_styles: styles }));
  };

  /**
   * Drops any pending debounced save and hands it back. EVERY immediate save
   * calls this: the pending form is built from the same editForm, so the
   * immediate payload already carries it -- while letting the older timer fire
   * afterwards would write a form captured BEFORE the toggle, silently reverting
   * it in the database while the UI keeps showing the new value.
   */
  const cancelPendingPartnerAutosave = (): EditFormData | null => {
    if (partnerDebounceRef.current) {
      clearTimeout(partnerDebounceRef.current);
      partnerDebounceRef.current = null;
    }
    const pending = pendingPartnerFormRef.current;
    pendingPartnerFormRef.current = null;
    return pending;
  };

  /**
   * Deliberately closes over NO render state. Every caller has already checked
   * that a profile is loaded, and the unmount flush below runs the FIRST render's
   * copy of this function -- a `profile` closure would have pinned that copy to
   * null and made the flush a silent no-op.
   */
  const persistPartnerAutosave = (
    nextForm: EditFormData,
    options?: { toastTitle?: string; toastDescription?: string; onError?: () => void }
  ) => {
    cancelPendingPartnerAutosave();
    const ticket = (partnerSaveSeqRef.current += 1);

    const run = async () => {
      try {
        const saved = await saveMyDancerProfile(buildDashboardSectionPayload('partner', nextForm));
        // A response a later save has already superseded must not repaint anything.
        if (ticket !== partnerSaveSeqRef.current) return;
        applySavedProfile(saved);
        // Not after unmount: the flush below deliberately completes its write on
        // the way out, and its toast would otherwise land on whatever page the
        // user navigated to, with no context and nothing to act on.
        if (options?.toastTitle && isMountedRef.current) {
          toast({ title: options.toastTitle, description: options.toastDescription });
        }
      } catch (error: any) {
        // Was swallowed unless the caller opted in, so a failing autosave looked
        // exactly like a successful one -- the failure mode this arc exists to end.
        captureException(error, { context: 'DancerDashboard.persistPartnerAutosave' });
        // The success arm checks the ticket and this one did not, so a stale
        // failure rolled back state a LATER save had already committed: toggle on
        // during a blip, tap a badge, and run 1's onError closed the editor and
        // set looking_for_partner false while run 2's success repainted it true --
        // leaving an error toast for a write the database accepted.
        if (ticket !== partnerSaveSeqRef.current || !isMountedRef.current) return;
        toast({ title: 'Error saving', description: error.message, variant: 'destructive' });
        options?.onError?.();
      }
    };

    // SERIALISED, one save at a time. The ticket above orders the REPAINTS, not
    // the writes: two badge taps 100ms apart issue overlapping POSTs, HTTP/2
    // guarantees no ordering, and if the first UPDATE commits last the sidecar
    // keeps the older value while the ticket makes the screen confidently show
    // the newer one. Chaining on both settlement paths so one failure does not
    // wedge every later save.
    partnerSaveChainRef.current = partnerSaveChainRef.current.then(run, run);
    return partnerSaveChainRef.current;
  };

  const schedulePartnerAutosave = (nextForm: EditFormData) => {
    cancelPendingPartnerAutosave();
    pendingPartnerFormRef.current = nextForm;
    partnerDebounceRef.current = setTimeout(() => {
      partnerDebounceRef.current = null;
      const pending = pendingPartnerFormRef.current;
      pendingPartnerFormRef.current = null;
      if (pending) void persistPartnerAutosave(pending);
    }, PARTNER_AUTOSAVE_DEBOUNCE_MS);
  };

  /**
   * Sends a pending debounced save NOW and hands its form back, for the callers
   * that are about to discard editForm. Returning it matters: the save is async,
   * so re-hydrating from `profile` in the same tick would still read the row as
   * it was BEFORE this save lands.
   */
  const flushPendingPartnerAutosave = (): EditFormData | null => {
    const pending = cancelPendingPartnerAutosave();
    if (pending) void persistPartnerAutosave(pending);
    return pending;
  };

  // Leaving the page mid-sentence must not discard the sentence.
  useEffect(
    () => () => {
      // Flush FIRST, then mark unmounted: the write still goes, its UI does not.
      void flushPendingPartnerAutosave();
      isMountedRef.current = false;
    },
    []
  );

  // The save used to sit INSIDE the setEditForm updater, which React double-runs
  // in development -- two SECURITY DEFINER writes per tap.
  //
  // Both handlers used to guard the save on `isInlinePartnerEditorOpen`, which
  // is necessarily TRUE wherever their badges render: a reader had to prove the
  // guard vacuous before concluding these behave like the role badge and the
  // textarea beside them, which save unconditionally.
  const togglePartnerSearchLevel = (level: string) => {
    const next = applyEditForm((prev) => ({
      ...prev,
      partner_search_level: prev.partner_search_level.includes(level)
        ? prev.partner_search_level.filter((item) => item !== level)
        : [...prev.partner_search_level, level],
    }));
    void persistPartnerAutosave(next);
  };

  const togglePartnerPracticeGoal = (goal: string) => {
    const next = applyEditForm((prev) => ({
      ...prev,
      partner_practice_goals: prev.partner_practice_goals.includes(goal)
        ? prev.partner_practice_goals.filter((item) => item !== goal)
        : [...prev.partner_practice_goals, goal],
    }));
    void persistPartnerAutosave(next);
  };

  const addArrayItem = (key: 'favorite_songs' | 'achievements', rawValue: string, reset: () => void) => {
    const value = rawValue.trim();
    if (!value) return;
    if (editForm[key].includes(value)) {
      reset();
      return;
    }
    applyEditForm((prev) => ({ ...prev, [key]: [...prev[key], value] }));
    reset();
  };

  const removeArrayItem = (key: 'favorite_songs' | 'achievements', index: number) => {
    applyEditForm((prev) => ({
      ...prev,
      [key]: prev[key].filter((_, currentIndex) => currentIndex !== index),
    }));
  };

  const handlePartnerTileToggle = () => {
    if (!profile) return;

    // This switch sits OUTSIDE the editor, so editForm may never have been
    // hydrated -- and the save it triggers sends the whole partner section.
    // Rebuild from the loaded row unless the editor is already open, in which
    // case editForm holds live edits that the profile row does not have yet.
    const baseForm = isInlinePartnerEditorOpen ? editFormRef.current : buildEditForm(profile);
    const previousLookingForPartner = Boolean(profile.looking_for_partner);
    const nextLookingForPartner = !previousLookingForPartner;
    const nextForm = { ...baseForm, looking_for_partner: nextLookingForPartner };

    applyEditForm(nextForm);
    setProfile((prev) => (prev ? { ...prev, looking_for_partner: nextLookingForPartner } : prev));
    setIsInlinePartnerEditorOpen(nextLookingForPartner);
    void persistPartnerAutosave(nextForm, {
      toastTitle: nextLookingForPartner ? 'Partner search enabled' : 'Partner search paused',
      toastDescription: nextLookingForPartner
        ? 'Complete role and preferred levels to be fully active.'
        : undefined,
      // The switch and the inline editor render optimistically. Without this the
      // error toast fired and the UI kept the new state anyway, so the switch sat
      // ON over a row that still said false, every later badge tap saved against
      // a state the server never accepted, and a reload silently undid all of it.
      onError: () => {
        setProfile((prev) => (prev ? { ...prev, looking_for_partner: previousLookingForPartner } : prev));
        applyEditForm((prev) => ({ ...prev, looking_for_partner: previousLookingForPartner }));
        setIsInlinePartnerEditorOpen(previousLookingForPartner);
      },
    });
  };

  const markAttendancePending = (eventId: string, pending: boolean) => {
    setPendingAttendanceIds((prev) => {
      if (pending) {
        return prev.includes(eventId) ? prev : [...prev, eventId];
      }
      return prev.filter((id) => id !== eventId);
    });
  };

  const setAttendanceForKind = (kind: AttendanceKind, updater: (items: AttendanceCard[]) => AttendanceCard[]) => {
    if (kind === 'events') {
      setSelectedEvents((prev) => updater(prev));
      return;
    }
    setSelectedFestivals((prev) => updater(prev));
  };

  const writeAttendance = async (eventId: string, status: AttendanceStatus | null) => {
    if (!user?.id) return;
    await setAttendanceRpc(eventId, status);
  };

  const handleAddAttendance = async (kind: AttendanceKind, eventItem: AttendanceSearchResult) => {
    if (!user?.id) {
      toast({
        title: 'Sign in required',
        description: 'Sign in to save attendance plans.',
        variant: 'destructive',
      });
      return;
    }

    const existing = (kind === 'events' ? selectedEvents : selectedFestivals).some((item) => item.event_id === eventItem.id);
    if (existing) return;

    const optimisticStatus: AttendanceStatus = 'interested';
    const optimisticCard: AttendanceCard = {
      event_id: eventItem.id,
      name: eventItem.name,
      date: eventItem.date,
      city: eventItem.city,
      status: optimisticStatus,
      kind,
    };

    setAttendanceForKind(kind, (prev) => [optimisticCard, ...prev]);
    if (kind === 'events') {
      setEventSearchResults((prev) => prev.filter((item) => item.id !== eventItem.id));
    } else {
      setFestivalSearchResults((prev) => prev.filter((item) => item.id !== eventItem.id));
    }

    markAttendancePending(eventItem.id, true);
    try {
      await writeAttendance(eventItem.id, optimisticStatus);
    } catch (error: any) {
      setAttendanceForKind(kind, (prev) => prev.filter((item) => item.event_id !== eventItem.id));
      toast({
        title: 'Could not add attendance',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      markAttendancePending(eventItem.id, false);
    }
  };

  const handleRemoveAttendance = async (kind: AttendanceKind, item: AttendanceCard) => {
    const confirmed = window.confirm(`Remove ${item.name} from your ${kind === 'events' ? 'events' : 'festivals'} list?`);
    if (!confirmed) return;

    const previousItems = kind === 'events' ? selectedEvents : selectedFestivals;
    setAttendanceForKind(kind, (prev) => prev.filter((entry) => entry.event_id !== item.event_id));

    markAttendancePending(item.event_id, true);
    try {
      await writeAttendance(item.event_id, null);
    } catch (error: any) {
      setAttendanceForKind(kind, () => previousItems);
      toast({
        title: 'Could not remove attendance',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      markAttendancePending(item.event_id, false);
    }
  };

  const handleCycleAttendanceStatus = async (kind: AttendanceKind, item: AttendanceCard) => {
    const currentIndex = attendanceStatusCycle.indexOf(item.status);
    const nextStatus = attendanceStatusCycle[(currentIndex + 1) % attendanceStatusCycle.length];
    const previousItems = kind === 'events' ? selectedEvents : selectedFestivals;

    setAttendanceForKind(kind, (prev) =>
      prev.map((entry) => (entry.event_id === item.event_id ? { ...entry, status: nextStatus } : entry))
    );

    markAttendancePending(item.event_id, true);
    try {
      await writeAttendance(item.event_id, nextStatus);
    } catch (error: any) {
      setAttendanceForKind(kind, () => previousItems);
      toast({
        title: 'Could not update status',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      markAttendancePending(item.event_id, false);
    }
  };

  useEffect(() => {
    const term = eventSearchTerm.trim();
    if (!term) {
      setEventSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingEvents(true);
      try {
        let query = supabase
          .from('events')
          .select('id, name, date, city, type, city_slug')
          .ilike('name', `%${term}%`)
          .eq('lifecycle_status', 'published')
          .order('date', { ascending: true })
          .limit(8);

        if (citySlug) {
          query = query.eq('city_slug', citySlug);
        }

        const { data, error } = await query;
        if (error) throw error;

        const selectedIds = new Set(selectedEvents.map((item) => item.event_id));
        const result = ((data || []) as AttendanceSearchResult[])
          .filter((item) => !isFestivalType(item.type))
          .filter((item) => !selectedIds.has(item.id));

        setEventSearchResults(result);
      } catch (error) {
        captureException(error, { context: 'DancerDashboard.eventSearch' });
      } finally {
        setIsSearchingEvents(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [citySlug, eventSearchTerm, selectedEvents]);

  useEffect(() => {
    const term = festivalSearchTerm.trim();
    if (!term) {
      setFestivalSearchResults([]);
      return;
    }

    const timeoutId = setTimeout(async () => {
      setIsSearchingFestivals(true);
      try {
        let query = supabase
          .from('events')
          .select('id, name, date, city, type, city_slug')
          .ilike('name', `%${term}%`)
          .eq('lifecycle_status', 'published')
          .eq('type', 'festival')
          .order('date', { ascending: true })
          .limit(8);

        if (citySlug) {
          query = query.eq('city_slug', citySlug);
        }

        const { data, error } = await query;
        if (error) throw error;

        const selectedIds = new Set(selectedFestivals.map((item) => item.event_id));
        const result = ((data || []) as AttendanceSearchResult[]).filter((item) => !selectedIds.has(item.id));
        setFestivalSearchResults(result);
      } catch (error) {
        captureException(error, { context: 'DancerDashboard.festivalSearch' });
      } finally {
        setIsSearchingFestivals(false);
      }
    }, 250);

    return () => clearTimeout(timeoutId);
  }, [citySlug, festivalSearchTerm, selectedFestivals]);

  const saveEditor = async () => {
    if (!profile || !activeEditor) return;

    setIsSaving(true);
    try {
      let cityId: string | undefined;
      // `undefined` means "this save did not resolve a city", which applySavedProfile
      // reads as "keep the one already on screen".
      let savedCity: { name: string } | undefined;

      if (activeEditor === 'identity') {
        const city = normalizeRequiredCity(editForm.city);
        if (!hasRequiredCity(city)) {
          toast({ title: 'City is required', description: 'Select your city before saving.', variant: 'destructive' });
          return;
        }

        if (!isValidDateString(editForm.dancing_start_date)) {
          toast({ title: 'Invalid date', description: 'Choose a valid dance start date.', variant: 'destructive' });
          return;
        }

        const canonicalCity = await resolveCanonicalCity(city);
        if (!canonicalCity) {
          toast({ title: 'Select a valid city', description: 'Pick your city from the city picker list.', variant: 'destructive' });
          return;
        }

        cityId = canonicalCity.cityId;
        savedCity = { name: canonicalCity.cityName };
      }

      // The direct UPDATE this replaces could not have succeeded even with the
      // grant: its identity payload set `city_id`, `dancing_start_date`,
      // `partner_role` and `photo_url`, and only the last of those exists -- as a
      // MIRROR the function maintains, never a column a client should write.
      // There is no `partner` arm here on purpose: openEditor routes that section
      // to the inline editor and never sets activeEditor, so the branch that used
      // to sit here was unreachable, and a second unreachable write path is
      // exactly where the next silent divergence would have grown.
      const saved = await saveMyDancerProfile(
        buildDashboardSectionPayload(activeEditor, editForm, { cityId })
      );

      if (activeEditor === 'identity') {
        const { error: metadataError } = await supabase.auth.updateUser({
          data: {
            first_name: editForm.first_name.trim(),
            surname: editForm.surname.trim() || null,
          },
        });

        if (metadataError) {
          captureException(metadataError, { context: 'DancerDashboard.syncAuthMetadata' });
        }
      }

      applySavedProfile(saved, savedCity);
      setActiveEditor(null);
      toast({ title: 'Profile updated', description: 'Your changes have been saved.' });
    } catch (error: any) {
      captureException(error, { context: 'DancerDashboard.saveEditor' });
      toast({ title: 'Error saving profile', description: error.message, variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const nextStep = useMemo(() => {
    if (!hasIdentity) {
      return {
        label: 'Complete profile basics',
        helper: 'Add your name and city to activate your identity tile.',
        onClick: () => openEditor('identity'),
      };
    }
    if (!hasMedia) {
      return {
        label: 'Add profile photo',
        helper: 'Add a photo so people can instantly recognize you.',
        onClick: () => openEditor('identity'),
      };
    }
    if (!hasActivity) {
      return {
        label: 'Find your next event',
        helper: 'Mark events as going or interested to build momentum.',
        onClick: () => navigate(calendarPath),
      };
    }
    if (!hasEngagement) {
      return {
        label: 'Activate partner mode',
        helper: 'Turn on partner visibility and define your search preferences.',
        onClick: () => openEditor('partner'),
      };
    }
    if (!hasSocial) {
      return {
        label: 'Add one contact link',
        helper: 'Set at least one social/contact channel for easy connection.',
        onClick: () => openEditor('social'),
      };
    }

    return {
      label: 'Tune dance profile',
      helper: 'Keep your profile sharp and current.',
      onClick: () => openEditor('career'),
    };
  }, [calendarPath, hasActivity, hasEngagement, hasIdentity, hasMedia, hasSocial]);

  const tiles: CoreTile[] = [
    {
      key: 'identity',
      title: 'Identity',
      subtitle: hasIdentity ? 'Identity live' : 'Needs basics',
      preview: profile?.cities?.name ? `${fullName} • ${profile.cities.name}` : 'Add your name and city',
      actionLabel: 'Edit identity',
      status: hasIdentity && hasMedia ? 'live' : 'attention',
      icon: UserRound,
      sizeClass: 'col-span-6 lg:col-span-4 lg:row-span-1',
      onAction: () => openEditor('identity'),
    },
    {
      key: 'activity',
      title: 'Activity',
      subtitle: hasActivity ? 'Momentum live' : 'Needs events',
      preview: nextEvent ? `${nextEvent.name}${nextEventLabel ? ` • ${nextEventLabel}` : ''}` : 'No upcoming events',
      actionLabel: 'Open calendar',
      status: hasActivity ? 'live' : 'attention',
      icon: CalendarDays,
      sizeClass: 'col-span-6 lg:col-span-4 lg:row-span-1',
      onAction: () => navigate(calendarPath),
    },
    {
      key: 'engagement',
      title: 'Partner Mode',
      subtitle: profile?.looking_for_partner
        ? (dancerRoleFromStored(profile.partner_search_role) && (profile.partner_search_level?.length || 0) > 0 ? 'Active' : 'Needs setup')
        : 'Paused',
      preview: profile?.partner_search_role
        ? `${dancerRoleFromStored(profile.partner_search_role)} • ${(profile.partner_search_level || []).slice(0, 2).join(', ') || 'All levels'}`
        : 'Set role, levels, and goals',
      actionLabel: 'Open editor',
      status: profile?.looking_for_partner && dancerRoleFromStored(profile.partner_search_role) && (profile.partner_search_level?.length || 0) > 0 ? 'live' : 'attention',
      icon: Users,
      sizeClass: 'col-span-12 lg:col-span-8 lg:row-span-1',
      onAction: () => openEditor('partner'),
    },
    {
      key: 'career',
      title: 'Dance Story',
      subtitle: profile?.favorite_styles?.length ? 'Styles selected' : 'Needs dance identity',
      preview: profile?.favorite_styles?.length
        ? profile.favorite_styles.slice(0, 3).join(' • ')
        : 'Add styles, songs, and achievements',
      actionLabel: 'Edit story',
      status: (profile?.favorite_styles?.length || 0) > 0 ? 'live' : 'attention',
      icon: Target,
      sizeClass: 'col-span-6 lg:col-span-4 lg:row-span-1',
      onAction: () => openEditor('career'),
    },
    {
      key: 'social',
      title: 'Contact Grid',
      subtitle: hasSocial ? 'Reachable' : 'No links yet',
      preview: hasSocial
        ? [profile?.instagram, profile?.facebook, profile?.website].filter(Boolean).slice(0, 2).join(' • ')
        : 'Add Instagram, Facebook, WhatsApp, or website',
      actionLabel: 'Edit links',
      status: hasSocial ? 'live' : 'attention',
      icon: Link2,
      sizeClass: 'col-span-6 lg:col-span-4 lg:row-span-1',
      onAction: () => openEditor('social'),
    },
  ];

  if (isLoading) {
    return (
      <div className="pb-24 pt-28 px-4">
        <div className="max-w-6xl mx-auto space-y-3">
          <Skeleton className="h-52 rounded-2xl" />
          <div className="grid grid-cols-12 gap-3">
            <Skeleton className="h-40 col-span-12 lg:col-span-6 rounded-2xl" />
            <Skeleton className="h-40 col-span-12 lg:col-span-6 rounded-2xl" />
            <Skeleton className="h-40 col-span-12 lg:col-span-4 rounded-2xl" />
            <Skeleton className="h-40 col-span-12 lg:col-span-8 rounded-2xl" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="pb-24 relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(20,184,166,0.14),_transparent_58%)]" />
      <div className="absolute -top-32 right-8 h-80 w-80 rounded-full bg-orange-400/20 blur-3xl" />
      <div className="absolute bottom-0 left-10 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />

      <div className="relative z-10 pt-28 px-4">
        <div className="max-w-6xl mx-auto space-y-3">
          <motion.div
            className="grid grid-cols-12 gap-3"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
          >
            <Card className="col-span-12 lg:col-span-7 lg:row-span-2 rounded-2xl border border-cyan-400/30 bg-slate-950/75 backdrop-blur-xl shadow-[0_24px_60px_rgba(14,116,144,0.25)]">
              <CardContent className="p-5 sm:p-6 h-full flex flex-col justify-between gap-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-14 w-14 rounded-full border border-cyan-400/30 bg-slate-900/70 overflow-hidden flex items-center justify-center">
                      {avatarUrl ? (
                        <img src={optimizedImageUrl(avatarUrl, 160)} alt={fullName} className="h-full w-full object-cover" loading="lazy" />
                      ) : (
                        <span className="text-sm font-bold text-cyan-100">{fullName.slice(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div>
                      <div className="inline-flex items-center gap-2 text-[11px] text-cyan-100/80">
                        <Sparkles className="w-3.5 h-3.5" />
                        Concept B command center
                      </div>
                      <h1 className="text-xl sm:text-2xl font-semibold text-white">{fullName}</h1>
                      <p className="text-xs text-slate-300">{profile.cities?.name || 'City missing'} • {danceYears} year(s) dancing</p>
                    </div>
                  </div>
                  <Badge className="border border-cyan-300/40 bg-cyan-500/15 text-cyan-100">{completionPercent}% ready</Badge>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-xl border border-cyan-400/35 bg-slate-900/65 p-3">
                    <p className="text-[11px] text-slate-300">Completion</p>
                    <p className="text-lg font-semibold text-white">{completionPercent}%</p>
                    <p className="text-[11px] text-slate-400">{completionCount}/5 core tiles live</p>
                  </div>
                  <div className="rounded-xl border border-emerald-400/35 bg-slate-900/65 p-3">
                    <p className="text-[11px] text-slate-300">Upcoming</p>
                    <p className="text-lg font-semibold text-white">{confirmedEvents.length}</p>
                    <p className="text-[11px] text-slate-400">Events in your queue</p>
                  </div>
                  <div className="rounded-xl border border-orange-400/35 bg-slate-900/65 p-3">
                    <p className="text-[11px] text-slate-300">Momentum</p>
                    <p className="text-lg font-semibold text-white">{momentumScore}%</p>
                    <p className="text-[11px] text-slate-400">Weekly pulse</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="h-2 rounded-full bg-slate-900 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-orange-400 via-cyan-300 to-emerald-300 transition-all duration-700" style={{ width: `${momentumScore}%` }} />
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <Button className="h-10 bg-gradient-to-r from-orange-400 to-cyan-300 text-black font-semibold hover:opacity-95" onClick={nextStep.onClick}>
                      {nextStep.label}
                    </Button>
                    <Button variant="outline" className="h-10 border-cyan-300/40 bg-slate-900/40 hover:bg-cyan-500/15" onClick={() => navigate('/create-dancers-profile')}>
                      Use wizard
                    </Button>
                  </div>
                  <p className="text-xs text-slate-300">{nextStep.helper}</p>
                </div>
              </CardContent>
            </Card>

          </motion.div>

          <div className="grid grid-cols-12 auto-rows-[minmax(128px,auto)] gap-3">
            {tiles.map((tile, index) => {
              const TileIcon = tile.icon;
              const isEngagementTile = tile.key === 'engagement';
              return (
                <motion.div
                  key={tile.key}
                  className={`${tile.sizeClass} ${isEngagementTile && isInlinePartnerEditorOpen ? 'lg:row-span-2' : ''}`.trim()}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: index * 0.05 }}
                  whileHover={{ y: -4, scale: 1.01 }}
                >
                  <Card className="h-full rounded-2xl border border-slate-700/70 bg-slate-950/80 backdrop-blur-xl transition-all duration-300 hover:border-cyan-300/45 hover:shadow-[0_0_0_1px_rgba(103,232,249,0.22),0_20px_40px_rgba(15,23,42,0.45)]">
                    <CardContent className="p-4 h-full flex flex-col justify-between gap-4">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="inline-flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-slate-900 border border-slate-700">
                              <TileIcon className="w-4 h-4 text-cyan-100" />
                            </span>
                            <div>
                              <p className="text-sm font-semibold text-white leading-none">{tile.title}</p>
                              <p className="text-[11px] text-slate-400 mt-1">{tile.subtitle}</p>
                            </div>
                          </div>
                          <Badge className={`text-[10px] border ${statusTone[tile.status]}`}>
                            {tile.status === 'live' ? 'Live' : 'Needs action'}
                          </Badge>
                        </div>
                        <p className="text-xs text-slate-300 leading-relaxed">{tile.preview}</p>
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        {isEngagementTile ? (
                          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/70 px-2.5 py-1.5">
                            <span className="text-[11px] text-slate-300">Searching</span>
                            <Switch
                              checked={Boolean(profile.looking_for_partner)}
                              onCheckedChange={() => handlePartnerTileToggle()}
                            />
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-500">Tap to update</span>
                        )}

                        {!isEngagementTile && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 border-cyan-300/35 bg-slate-900/35 hover:bg-cyan-400/15"
                            onClick={tile.onAction}
                          >
                            {tile.actionLabel}
                          </Button>
                        )}
                      </div>

                      {isEngagementTile && isInlinePartnerEditorOpen && (
                        <div className="mt-3 space-y-3 rounded-xl border border-slate-700 bg-slate-900/60 p-3">
                          <div className="space-y-1.5">
                            <p className="text-xs text-slate-400">Looking for role</p>
                            <div className="flex flex-wrap gap-1.5">
                              {PARTNER_SEARCH_ROLE_OPTIONS.map((role) => (
                                <Badge
                                  key={role}
                                  variant={editForm.partner_search_role === role ? 'default' : 'outline'}
                                  className="cursor-pointer"
                                  onClick={() => {
                                    void persistPartnerAutosave(
                                      applyEditForm((prev) => ({ ...prev, partner_search_role: role }))
                                    );
                                  }}
                                >
                                  {role}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs text-slate-400">Preferred levels</p>
                            <div className="flex flex-wrap gap-1.5">
                              {PARTNER_SEARCH_LEVEL_OPTIONS.map((level) => (
                                <Badge
                                  key={level}
                                  variant={editForm.partner_search_level.includes(level) ? 'default' : 'outline'}
                                  className="cursor-pointer"
                                  onClick={() => togglePartnerSearchLevel(level)}
                                >
                                  {level}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1.5">
                            <p className="text-xs text-slate-400">Practice goals</p>
                            <div className="flex flex-wrap gap-1.5">
                              {PARTNER_PRACTICE_GOAL_OPTIONS.map((goal) => (
                                <Badge
                                  key={goal}
                                  variant={editForm.partner_practice_goals.includes(goal) ? 'default' : 'outline'}
                                  className="cursor-pointer"
                                  onClick={() => togglePartnerPracticeGoal(goal)}
                                >
                                  {goal}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          <div className="space-y-1">
                            <p className="text-xs text-slate-400">Details</p>
                            <Textarea
                              value={editForm.partner_details}
                              onChange={(event) => {
                                const value = event.target.value;
                                schedulePartnerAutosave(
                                  applyEditForm((prev) => ({ ...prev, partner_details: value }))
                                );
                              }}
                              placeholder="Availability, preferred practice rhythm, or expectations..."
                              className="bg-slate-900/80 border-slate-700"
                            />
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>

          <div className="grid grid-cols-12 gap-3 pt-1">
            <Card className="col-span-12 lg:col-span-6 rounded-2xl border border-cyan-300/30 bg-slate-950/80 backdrop-blur-xl">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Events</p>
                    <p className="text-xs text-slate-300">Classes, socials, and local workshops</p>
                  </div>
                  <Badge className="border border-cyan-300/35 bg-cyan-400/10 text-cyan-100">{selectedEvents.length} saved</Badge>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <Input
                    value={eventSearchTerm}
                    onChange={(event) => setEventSearchTerm(event.target.value)}
                    placeholder="Search events to add..."
                    className="pl-9 bg-slate-900/75 border-slate-700"
                  />

                  {(eventSearchTerm.trim() || isSearchingEvents) && (
                    <div className="absolute z-30 mt-2 w-full rounded-xl border border-slate-700 bg-slate-900/95 shadow-xl">
                      {isSearchingEvents ? (
                        <p className="px-3 py-2 text-xs text-slate-400">Searching events...</p>
                      ) : eventSearchResults.length ? (
                        <div className="max-h-64 overflow-y-auto py-1">
                          {eventSearchResults.map((result) => (
                            <div key={result.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-slate-800/75">
                              <div className="min-w-0">
                                <p className="text-sm text-slate-100 truncate">{result.name}</p>
                                <p className="text-[11px] text-slate-400">{formatAttendanceDate(result.date)} • {result.city || 'City TBA'}</p>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 px-2.5 bg-cyan-500/20 text-cyan-100 hover:bg-cyan-500/30"
                                onClick={() => void handleAddAttendance('events', result)}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-400">No matching events found.</p>
                      )}
                    </div>
                  )}
                </div>

                {selectedEvents.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-700 bg-slate-900/55 p-4 text-center">
                    <p className="text-sm text-slate-200">Tell the community where you’re dancing next.</p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <AnimatePresence initial={false}>
                      {selectedEvents.map((item) => (
                        <motion.div
                          key={item.event_id}
                          layout
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => void handleCycleAttendanceStatus('events', item)}
                          className="w-full text-left rounded-xl border border-slate-700 bg-slate-900/65 p-3 hover:border-cyan-300/50 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-white truncate">{item.name}</p>
                              <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                                <span>{formatAttendanceDate(item.date)}</span>
                                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.city || 'City TBA'}</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge className={`text-[10px] border ${attendanceBadgeTone[item.status]}`}>
                                {item.status[0].toUpperCase() + item.status.slice(1)}
                              </Badge>
                              <button
                                type="button"
                                aria-label="Remove event"
                                className="h-6 w-6 rounded-full text-slate-400 hover:text-slate-100 hover:bg-slate-800"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void handleRemoveAttendance('events', item);
                                }}
                                disabled={pendingAttendanceIds.includes(item.event_id)}
                              >
                                <X className="h-3.5 w-3.5 mx-auto" />
                              </button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-12 lg:col-span-6 rounded-2xl border border-violet-300/35 bg-gradient-to-br from-slate-950 via-slate-900 to-violet-950/35 shadow-[0_14px_36px_rgba(76,29,149,0.25)]">
              <CardContent className="p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-white">Festivals</p>
                    <p className="text-xs text-slate-300">Your premium dance travel lineup</p>
                  </div>
                  <Badge className="border border-violet-300/45 bg-violet-500/20 text-violet-100 inline-flex items-center gap-1">
                    <BadgeCheck className="h-3.5 w-3.5" />
                    {selectedFestivals.length} locked
                  </Badge>
                </div>

                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-violet-200/70" />
                  <Input
                    value={festivalSearchTerm}
                    onChange={(event) => setFestivalSearchTerm(event.target.value)}
                    placeholder="Search festivals to add..."
                    className="pl-9 bg-slate-900/75 border-violet-300/30"
                  />

                  {(festivalSearchTerm.trim() || isSearchingFestivals) && (
                    <div className="absolute z-30 mt-2 w-full rounded-xl border border-violet-400/30 bg-slate-900/95 shadow-xl">
                      {isSearchingFestivals ? (
                        <p className="px-3 py-2 text-xs text-slate-300">Searching festivals...</p>
                      ) : festivalSearchResults.length ? (
                        <div className="max-h-64 overflow-y-auto py-1">
                          {festivalSearchResults.map((result) => (
                            <div key={result.id} className="flex items-center justify-between gap-2 px-3 py-2 hover:bg-violet-900/20">
                              <div className="min-w-0">
                                <p className="text-sm text-slate-100 truncate">{result.name}</p>
                                <p className="text-[11px] text-slate-300">{formatAttendanceDate(result.date)} • {result.city || 'City TBA'}</p>
                              </div>
                              <Button
                                size="sm"
                                className="h-7 px-2.5 bg-violet-500/25 text-violet-100 hover:bg-violet-500/35"
                                onClick={() => void handleAddAttendance('festivals', result)}
                              >
                                <Plus className="w-3.5 h-3.5 mr-1" />
                                Add
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="px-3 py-2 text-xs text-slate-300">No matching festivals found.</p>
                      )}
                    </div>
                  )}
                </div>

                {selectedFestivals.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-violet-400/30 bg-slate-900/45 p-4 text-center">
                    <p className="text-sm text-slate-200">Tell the community where you’re dancing next.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <AnimatePresence initial={false}>
                      {selectedFestivals.map((item) => (
                        <motion.div
                          key={item.event_id}
                          layout
                          initial={{ opacity: 0, y: 14 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -12 }}
                          transition={{ duration: 0.2 }}
                          onClick={() => void handleCycleAttendanceStatus('festivals', item)}
                          className="text-left rounded-xl border border-violet-300/30 bg-slate-900/55 p-3 hover:border-violet-200/50 cursor-pointer"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-violet-50 truncate">{item.name}</p>
                              <p className="mt-1 text-[11px] text-slate-300">{formatAttendanceDate(item.date)}</p>
                              <p className="mt-0.5 text-[11px] text-slate-300 inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{item.city || 'City TBA'}</p>
                            </div>
                            <button
                              type="button"
                              aria-label="Remove festival"
                              className="h-6 w-6 rounded-full text-violet-200/80 hover:text-white hover:bg-violet-900/35"
                              onClick={(event) => {
                                event.stopPropagation();
                                void handleRemoveAttendance('festivals', item);
                              }}
                              disabled={pendingAttendanceIds.includes(item.event_id)}
                            >
                              <X className="h-3.5 w-3.5 mx-auto" />
                            </button>
                          </div>
                          <div className="mt-2">
                            <Badge className={`text-[10px] border ${attendanceBadgeTone[item.status]}`}>
                              {item.status[0].toUpperCase() + item.status.slice(1)}
                            </Badge>
                          </div>
                        </motion.div>
                      ))}
                    </AnimatePresence>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <Dialog open={Boolean(activeEditor)} onOpenChange={(isOpen) => !isOpen && setActiveEditor(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto border-cyan-300/35 bg-slate-950 text-slate-100">
          <DialogHeader>
            <DialogTitle>
              {activeEditor === 'identity' && 'Edit identity'}
              {activeEditor === 'career' && 'Edit dance story'}
              {activeEditor === 'social' && 'Edit contact grid'}
            </DialogTitle>
            <DialogDescription className="text-slate-400">
              {activeEditor === 'identity' && 'Update your core profile details.'}
              {activeEditor === 'career' && 'Set styles, songs, achievements, and festival plans.'}
              {activeEditor === 'social' && 'Set your social/contact links for networking.'}
            </DialogDescription>
          </DialogHeader>

          {activeEditor === 'identity' && (
            <div className="space-y-3">
              <Input
                placeholder="First name"
                value={editForm.first_name}
                onChange={(event) => applyEditForm((prev) => ({ ...prev, first_name: event.target.value }))}
                className="bg-slate-900/80 border-slate-700"
              />
              <Input
                placeholder="Surname"
                value={editForm.surname}
                onChange={(event) => applyEditForm((prev) => ({ ...prev, surname: event.target.value }))}
                className="bg-slate-900/80 border-slate-700"
              />
              <CityPicker
                value={editForm.city}
                onChange={(city) => applyEditForm((prev) => ({ ...prev, city }))}
                placeholder="Select city..."
                className="bg-slate-900/80 border-slate-700"
              />
              <Input
                placeholder="Photo URL"
                value={editForm.photo_url}
                onChange={(event) => applyEditForm((prev) => ({ ...prev, photo_url: event.target.value }))}
                className="bg-slate-900/80 border-slate-700"
              />
              <div className="space-y-1">
                <p className="text-xs text-slate-400">Started dancing</p>
                <ExperiencePicker
                  value={editForm.dancing_start_date}
                  onChange={(date) => applyEditForm((prev) => ({ ...prev, dancing_start_date: date }))}
                  showLabel={false}
                />
              </div>
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400">Role</p>
                <div className="flex flex-wrap gap-1.5">
                  {PARTNER_ROLE_OPTIONS.map((role) => (
                    <Badge
                      key={role}
                      variant={editForm.partner_role === role ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => applyEditForm((prev) => ({ ...prev, partner_role: role }))}
                    >
                      {role}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          )}

          {activeEditor === 'career' && (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <p className="text-xs text-slate-400">Favorite styles</p>
                <div className="flex flex-wrap gap-1.5">
                  {FAVORITE_STYLE_OPTIONS.map((style) => (
                    <Badge
                      key={style}
                      variant={editForm.favorite_styles.includes(style) ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => toggleStyle(style)}
                    >
                      {style}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">Favorite songs</p>
                <Input
                  placeholder="Add song and press Enter"
                  value={newFavoriteSong}
                  onChange={(event) => setNewFavoriteSong(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addArrayItem('favorite_songs', newFavoriteSong, () => setNewFavoriteSong(''));
                    }
                  }}
                  className="bg-slate-900/80 border-slate-700"
                />
                <div className="flex flex-wrap gap-1.5">
                  {editForm.favorite_songs.map((song, index) => (
                    <Badge key={`${song}-${index}`} variant="secondary" className="cursor-pointer" onClick={() => removeArrayItem('favorite_songs', index)}>
                      {song} ×
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-slate-400">Achievements</p>
                <Input
                  placeholder="Add achievement and press Enter"
                  value={newAchievement}
                  onChange={(event) => setNewAchievement(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addArrayItem('achievements', newAchievement, () => setNewAchievement(''));
                    }
                  }}
                  className="bg-slate-900/80 border-slate-700"
                />
                <div className="flex flex-wrap gap-1.5">
                  {editForm.achievements.map((achievement, index) => (
                    <Badge key={`${achievement}-${index}`} variant="secondary" className="cursor-pointer" onClick={() => removeArrayItem('achievements', index)}>
                      {achievement} ×
                    </Badge>
                  ))}
                </div>
              </div>

            </div>
          )}

          {activeEditor === 'social' && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Instagram className="h-4 w-4 text-slate-300" />
                <Input
                  placeholder="@username"
                  value={editForm.instagram}
                  onChange={(event) => applyEditForm((prev) => ({ ...prev, instagram: event.target.value }))}
                  className="bg-slate-900/80 border-slate-700"
                />
              </div>
              <div className="flex items-center gap-2">
                <Facebook className="h-4 w-4 text-slate-300" />
                <Input
                  placeholder="facebook.com/username"
                  value={editForm.facebook}
                  onChange={(event) => applyEditForm((prev) => ({ ...prev, facebook: event.target.value }))}
                  className="bg-slate-900/80 border-slate-700"
                />
              </div>
              <Input
                placeholder="+44 7XXX XXX XXX"
                value={editForm.whatsapp}
                onChange={(event) => applyEditForm((prev) => ({ ...prev, whatsapp: event.target.value }))}
                className="bg-slate-900/80 border-slate-700"
              />
              <Input
                placeholder="https://your-site.com"
                value={editForm.website}
                onChange={(event) => applyEditForm((prev) => ({ ...prev, website: event.target.value }))}
                className="bg-slate-900/80 border-slate-700"
              />
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" className="border-slate-600" onClick={() => setActiveEditor(null)}>
              Cancel
            </Button>
            <Button onClick={saveEditor} disabled={isSaving} className="bg-gradient-to-r from-orange-400 to-cyan-300 text-black hover:opacity-95">
              {isSaving ? 'Saving...' : 'Save changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
