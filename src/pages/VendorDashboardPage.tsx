import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CircleHelp, Flame, Loader2, MapPin, Plus, Search, Trash2, Upload, Copy, ExternalLink, Share2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  VENDOR_DASHBOARD_SECTIONS,
  type VendorDashboardFormState,
  type VendorDashboardProgressMap,
  type VendorDashboardSavePayload,
  type VendorDashboardSection,
  type VendorProduct,
  type VendorRow,
  type VendorRowWithCity,
  type VendorPromoDiscountType,
} from "@/modules/vendor/types";
import {
  isRlsError,
  normalizeProducts,
  normalizeSocialUrl,
  normalizeStringArray,
  toNullableNumber,
} from "@/modules/vendor/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CityPicker } from '@/components/ui/city-picker';
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import { cn, resolveEventImage } from '@/lib/utils';
import { useCity } from '@/contexts/CityContext';
import { Checkbox } from '@/components/ui/checkbox';

const emptyForm: VendorDashboardFormState = {
  id: null,
  business_name: "",
  city: "",
  photo_url: [],
  products: [],
  product_categories: [],
  ships_international: false,
  promo_code: "",
  promo_discount_type: "percent",
  promo_discount_value: "",
  public_email: "",
  whatsapp: "",
  website: "",
  instagram: "",
  facebook: "",
  faq: "",
  upcoming_events: [],
  meta_data: null,
  team: null,
};

const toFormState = (vendor: VendorRow): VendorDashboardFormState => ({
  id: vendor.id,
  business_name: vendor.business_name || "",
  city: (vendor as VendorRowWithCity).cities?.name || "",
  photo_url: normalizeStringArray(vendor.photo_url),
  products: normalizeProducts(vendor.products),
  product_categories: normalizeStringArray(vendor.product_categories),
  ships_international: Boolean(vendor.ships_international),
  promo_code: vendor.promo_code || "",
  promo_discount_type: vendor.promo_discount_type || "percent",
  promo_discount_value:
    typeof vendor.promo_discount_value === "number" ? String(vendor.promo_discount_value) : "",
  public_email: vendor.public_email || "",
  whatsapp: vendor.whatsapp || "",
  website: vendor.website || "",
  instagram: vendor.instagram || "",
  facebook: vendor.facebook || "",
  faq: vendor.faq || "",
  upcoming_events: normalizeStringArray(vendor.upcoming_events),
  meta_data: vendor.meta_data,
  team: vendor.team,
});

const QUICK_CATEGORY_OPTIONS = [
  "Dance Shoes",
  "Heels",
  "Dancewear",
  "Menswear",
  "Performance Costumes",
  "Practice Outfits",
  "Dance Accessories",
  "Jewelry",
  "Hair Products",
  "Makeup",
] as const;

type EventSuggestion = {
  id: string;
  name: string;
  date: string | null;
  city: string | null;
  location?: string | null;
  imageUrl?: string | null;
  hasParty?: boolean;
  hasClass?: boolean;
};

type TeamMemberOption = {
  id: string;
  displayName: string;
  city: string | null;
};

type VendorDashboardProps = {
  forcedSection?: VendorDashboardSection | null;
  embedded?: boolean;
  profileFocus?: "name" | "location" | null;
  onSaved?: (payload?: VendorDashboardSavePayload) => void;
  onProgressChange?: (progress: VendorDashboardProgressMap) => void;
};

const SECTION_SAVE_TARGETS: VendorDashboardSection[] = [
  "profile",
  "media",
  "categories",
  "products",
  "promo",
  "events",
  "contact",
  "social",
  "faq",
  "team",
  "save",
];

const getFriendlyVendorSaveError = (error: any, eventsOnlyMode: boolean): string => {
  const message = String(error?.message || "");
  const schemaPattern = /Could not find the '([^']+)' column of 'vendors'/i;
  const schemaMatch = message.match(schemaPattern);

  if (schemaMatch) {
    if (eventsOnlyMode) {
      return "Vendor profile schema is outdated. Event links were processed in events-only mode; refresh and try again if needed.";
    }
    return "Vendor profile schema is outdated. Some profile fields need a schema sync before full save works.";
  }

  return message || "Failed to save vendor profile.";
};

const SectionHint = ({ text }: { text: string }) => (
  <Tooltip>
    <TooltipTrigger asChild>
      <button type="button" className="text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festival-teal/60 rounded-sm transition-colors" aria-label="Section help">
        <CircleHelp className="h-4 w-4" />
      </button>
    </TooltipTrigger>
    <TooltipContent>{text}</TooltipContent>
  </Tooltip>
);

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^\+?[\d\s().-]{6,}$/;

const normalizeHttpUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;

  try {
    return new URL(withProtocol).toString();
  } catch {
    return null;
  }
};

const VendorDashboard = ({ forcedSection = null, embedded = false, profileFocus = null, onSaved, onProgressChange }: VendorDashboardProps) => {
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();
  const { toast } = useToast();
  const { citySlug } = useCity();
  const [searchParams] = useSearchParams();

  const [form, setForm] = useState<VendorDashboardFormState>(emptyForm);
  const [fetchingVendor, setFetchingVendor] = useState(true);
  const [savePending, setSavePending] = useState(false);
  const [deletePending, setDeletePending] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notAuthorized, setNotAuthorized] = useState(false);
  const [focusedSection, setFocusedSection] = useState<VendorDashboardSection | null>(null);
  const [expertMode, setExpertMode] = useState(false);
  const [sectionSavedAt, setSectionSavedAt] = useState<Partial<Record<VendorDashboardSection, string>>>({});

  const [primaryFile, setPrimaryFile] = useState<File | null>(null);
  const [teamInput, setTeamInput] = useState("");
  const [categoryInput, setCategoryInput] = useState("");
  const [upcomingEventsInput, setUpcomingEventsInput] = useState("");
  const [eventSearchInput, setEventSearchInput] = useState("");
  const [eventSuggestions, setEventSuggestions] = useState<EventSuggestion[]>([]);
  const [loadingEventSuggestions, setLoadingEventSuggestions] = useState(false);
  const [pendingEventIds, setPendingEventIds] = useState<string[]>([]);
  
  // Team search
  const [teamSearch, setTeamSearch] = useState("");
  const [teamResults, setTeamResults] = useState<TeamMemberOption[]>([]);
  const [isSearchingTeam, setIsSearchingTeam] = useState(false);
  const [teamSearchError, setTeamSearchError] = useState<string | null>(null);
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [localDraftSavedAt, setLocalDraftSavedAt] = useState<string | null>(null);

  const getCurrentLeaderId = () => {
    const meta = form.meta_data;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const value = (meta as Record<string, unknown>).business_leader_dancer_id;
      return typeof value === "string" ? value : null;
    }
    return null;
  };

  const updateLeaderMeta = (leaderId: string | null, leaderName: string | null) => {
    setForm((prev) => {
      const currentMeta = (prev.meta_data && typeof prev.meta_data === "object" && !Array.isArray(prev.meta_data))
        ? { ...(prev.meta_data as Record<string, unknown>) }
        : {};

      if (leaderId) {
        currentMeta.business_leader_dancer_id = leaderId;
        currentMeta.business_leader_name = leaderName || null;
      } else {
        delete currentMeta.business_leader_dancer_id;
        delete currentMeta.business_leader_name;
      }

      return {
        ...prev,
        meta_data: Object.keys(currentMeta).length > 0 ? (currentMeta as Json) : null,
      };
    });
  };

  const setTeamLeader = (leaderDancerId: string) => {
    let currentTeam: any[] = [];
    try {
      if (teamInput.trim()) {
        const parsed = JSON.parse(teamInput);
        if (Array.isArray(parsed)) currentTeam = parsed;
      }
    } catch {
      return;
    }

    const leaderMember = currentTeam.find((member: any) => String(member.dancer_id) === String(leaderDancerId));
    if (!leaderMember) return;

    const normalizedTeam = currentTeam.map((member: any) => ({
      ...member,
      is_leader: String(member.dancer_id) === String(leaderDancerId),
    }));

    setTeamInput(JSON.stringify(normalizedTeam, null, 2));
    updateLeaderMeta(String(leaderDancerId), typeof leaderMember.name === "string" ? leaderMember.name : null);
    toast({ title: "Business leader updated" });
  };

  const [touched, setTouched] = useState({
    businessName: false,
    city: false,
    promoValue: false,
    products: false,
    email: false,
    website: false,
    whatsapp: false,
  });

  const requestedSection = forcedSection ?? searchParams.get("section");
  const activeDashboardSection: VendorDashboardSection | null =
    requestedSection && VENDOR_DASHBOARD_SECTIONS.includes(requestedSection as VendorDashboardSection)
      ? (requestedSection as VendorDashboardSection)
      : null;

  const eventsOnlyMode = embedded && activeDashboardSection === "events";
  const isEmbeddedFocusedSectionMode = embedded && Boolean(forcedSection);
  const draftStorageKey = user?.id ? `vendor_dashboard_draft_${user.id}` : null;

  const applySectionSaveStamp = (section: VendorDashboardSection, timestamp: string) => {
    setSectionSavedAt((prev) => ({
      ...prev,
      [section]: timestamp,
      save: timestamp,
    }));
  };

  const getDraftSavedLabel = () => {
    if (!localDraftSavedAt) return null;
    const parsed = new Date(localDraftSavedAt);
    if (Number.isNaN(parsed.getTime())) return "Draft saved locally";
    return `Draft saved at ${parsed.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}`;
  };

  const clearLocalDraft = () => {
    if (!draftStorageKey) return;

    const confirmed = window.confirm("Clear your local draft? Unsaved local changes will be removed.");
    if (!confirmed) return;

    localStorage.removeItem(draftStorageKey);
    setLocalDraftSavedAt(null);

    if (isEditMode) {
      setCategoryInput("");
      setUpcomingEventsInput("");
      setEventSearchInput("");
      toast({ title: "Draft cleared", description: "Saved profile data is still loaded." });
      return;
    }

    setForm(emptyForm);
    setTeamInput("");
    setCategoryInput("");
    setUpcomingEventsInput("");
    setEventSearchInput("");
    setPendingEventIds([]);
    setPrimaryFile(null);
    toast({ title: "Draft cleared" });
  };

  const showSection = (section: VendorDashboardSection) => {
    if (isEmbeddedFocusedSectionMode) return activeDashboardSection === section;
    if (eventsOnlyMode && section === "save") return false;
    if (!activeDashboardSection) return true;
    return activeDashboardSection === section || section === "save";
  };

  useEffect(() => {
    const fetchByOwner = async () => {
      if (!user?.id) {
        setFetchingVendor(false);
        return;
      }

      setFetchingVendor(true);
      setError(null);
      setNotAuthorized(false);

      const { data, error: fetchError } = await supabase
        .from("vendors")
        .select("*, cities(name)")
        .eq("user_id", user.id)
        .maybeSingle();

      if (fetchError) {
        if (isRlsError(fetchError)) {
          setNotAuthorized(true);
        } else {
          setError(fetchError.message || "Failed to fetch vendor profile.");
        }
        setForm(emptyForm);
      } else if (data) {
        const nextForm = toFormState(data as VendorRow);
        setForm(nextForm);
        setTeamInput(nextForm.team ? JSON.stringify(nextForm.team, null, 2) : "");
        const createdAt = (data as VendorRow)?.created_at || null;
        if (createdAt) {
          setSectionSavedAt(
            SECTION_SAVE_TARGETS.reduce<Partial<Record<VendorDashboardSection, string>>>((acc, section) => {
              acc[section] = createdAt;
              return acc;
            }, {})
          );
        }
      } else {
        setForm(emptyForm);
        setTeamInput("");
        setSectionSavedAt({});
      }

      setFetchingVendor(false);
    };

    if (!authLoading) {
      void fetchByOwner();
    }
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (authLoading || fetchingVendor) return;
    if (!draftStorageKey || draftHydrated) return;

    try {
      const raw = localStorage.getItem(draftStorageKey);
      if (!raw) {
        setDraftHydrated(true);
        return;
      }

      const parsed = JSON.parse(raw) as {
        form?: VendorDashboardFormState;
        teamInput?: string;
        categoryInput?: string;
        upcomingEventsInput?: string;
        eventSearchInput?: string;
        expertMode?: boolean;
        savedAt?: string;
      };

      const hasRestoredDraft = Boolean(
        parsed.form ||
          typeof parsed.teamInput === "string" ||
          typeof parsed.categoryInput === "string" ||
          typeof parsed.upcomingEventsInput === "string" ||
          typeof parsed.eventSearchInput === "string"
      );

      if (parsed.form) setForm(parsed.form);
      if (typeof parsed.teamInput === "string") setTeamInput(parsed.teamInput);
      if (typeof parsed.categoryInput === "string") setCategoryInput(parsed.categoryInput);
      if (typeof parsed.upcomingEventsInput === "string") setUpcomingEventsInput(parsed.upcomingEventsInput);
      if (typeof parsed.eventSearchInput === "string") setEventSearchInput(parsed.eventSearchInput);
      if (typeof parsed.expertMode === "boolean") setExpertMode(parsed.expertMode);
      if (typeof parsed.savedAt === "string") setLocalDraftSavedAt(parsed.savedAt);

      if (hasRestoredDraft && !embedded) {
        toast({ title: "Draft restored", description: "Your unsaved vendor edits were loaded." });
      }
    } catch {
      // ignore malformed local draft
    } finally {
      setDraftHydrated(true);
    }
  }, [authLoading, draftHydrated, draftStorageKey, embedded, fetchingVendor, toast]);

  useEffect(() => {
    if (!draftHydrated || !draftStorageKey) return;
    if (authLoading || fetchingVendor) return;

    const timer = window.setTimeout(() => {
      const savedAt = new Date().toISOString();
      const payload = {
        form,
        teamInput,
        categoryInput,
        upcomingEventsInput,
        eventSearchInput,
        expertMode,
        savedAt,
      };

      localStorage.setItem(draftStorageKey, JSON.stringify(payload));
      setLocalDraftSavedAt(savedAt);
    }, 450);

    return () => window.clearTimeout(timer);
  }, [
    authLoading,
    categoryInput,
    draftHydrated,
    draftStorageKey,
    eventSearchInput,
    expertMode,
    fetchingVendor,
    form,
    teamInput,
    upcomingEventsInput,
  ]);

  useEffect(() => {
    if (embedded) return;
    if (authLoading || fetchingVendor) return;

    const section = activeDashboardSection;
    if (!section) return;

    const target = document.getElementById(`dashboard-section-${section}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocusedSection(section);

    const timer = window.setTimeout(() => {
      setFocusedSection((current) => (current === section ? null : current));
    }, 1800);

    return () => window.clearTimeout(timer);
  }, [searchParams, authLoading, fetchingVendor, activeDashboardSection, embedded]);

  useEffect(() => {
    const loadEventSuggestions = async () => {
      if (!user?.id) {
        setEventSuggestions([]);
        return;
      }

      setLoadingEventSuggestions(true);

      try {
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + 60);

        if (citySlug) {
          const { data, error: rpcError } = await supabase.rpc('get_calendar_events' as any, {
            range_start: startDate.toISOString(),
            range_end: endDate.toISOString(),
            city_slug_param: citySlug,
          });

          if (rpcError) {
            console.error("Failed to load calendar events:", rpcError);
            setEventSuggestions([]);
          } else {
            const raw = Array.isArray(data) ? data : [];
            const dedupedById = new Map<string, EventSuggestion>();

            for (const row of raw as any[]) {
              if (!row?.event_id || !row?.name) continue;
              const eventId = String(row.event_id);
              if (!dedupedById.has(eventId)) {
                dedupedById.set(eventId, {
                  id: eventId,
                  name: String(row.name),
                  date: row.instance_date ? String(row.instance_date) : null,
                  city: null,
                  location: row.location ? String(row.location) : null,
                  imageUrl: resolveEventImage(row.photo_url, row.cover_image_url),
                  hasParty: Boolean(row.has_party),
                  hasClass: Boolean(row.has_class),
                });
              }
            }

            setEventSuggestions(Array.from(dedupedById.values()));
          }
        } else {
          const today = new Date().toISOString().slice(0, 10);
          let query = (supabase as any)
            .from("events")
            .select("id, name, date, city")
            .gte("date", today)
            .order("date", { ascending: true })
            .limit(20);

          if (form.city?.trim()) {
            query = query.ilike("city", `%${form.city.trim()}%`);
          }

          const { data, error: eventsError } = await query;
          if (eventsError) {
            console.error("Failed to load fallback event suggestions:", eventsError);
            setEventSuggestions([]);
          } else {
            const mapped = Array.isArray(data)
              ? data
                  .filter((row: any) => row?.id && row?.name)
                  .map((row: any) => ({
                    id: String(row.id),
                    name: String(row.name),
                    date: row.date ? String(row.date) : null,
                    city: row.city ? String(row.city) : null,
                    location: null,
                    imageUrl: null,
                    hasParty: false,
                    hasClass: false,
                  }))
              : [];
            setEventSuggestions(mapped);
          }
        }
      } finally {
        setLoadingEventSuggestions(false);
      }
    };

    if (!authLoading && !fetchingVendor) {
      void loadEventSuggestions();
    }
  }, [authLoading, fetchingVendor, user?.id, form.city, citySlug]);

  useEffect(() => {
    const query = teamSearch.trim();
    setTeamSearchError(null);
    if (query.length < 2) {
      setTeamResults([]);
      setIsSearchingTeam(false);
      return;
    }

    const loadTeamMatches = async () => {
      setIsSearchingTeam(true);
      try {
        const safeQuery = query.replace(/[,%()]/g, " ").trim();
        if (!safeQuery) {
          setTeamResults([]);
          return;
        }

        const { data, error } = await supabase
          .from("dancer_profiles")
          .select("id, first_name, surname")
          .or(`first_name.ilike.%${safeQuery}%,surname.ilike.%${safeQuery}%`)
          .limit(8);

        if (error) throw error;

        const mapped: TeamMemberOption[] = (data || []).map((row: any) => {
          const displayName = `${row.first_name || ""} ${row.surname || ""}`.trim() || "Unnamed dancer";
          return {
            id: row.id,
            displayName,
            city: null,
          };
        });

        setTeamResults(mapped);
      } catch {
        setTeamResults([]);
        setTeamSearchError("Couldn’t load dancer matches. Create/select dancers first, then link them here.");
      } finally {
        setIsSearchingTeam(false);
      }
    };

    const timer = window.setTimeout(loadTeamMatches, 250);
    return () => window.clearTimeout(timer);
  }, [teamSearch]);

  const addTeamMember = (member: TeamMemberOption) => {
    setTeamSearch("");
    setTeamResults([]);
    
    // Parse current team array
    let currentTeam: any[] = [];
    try {
      if (teamInput.trim()) {
        const parsed = JSON.parse(teamInput);
        if (Array.isArray(parsed)) currentTeam = parsed;
      }
    } catch {
      // ignore
    }

    // Check overlap
    if (currentTeam.some((t: any) => t.dancer_id === member.id)) {
      toast({ title: "Already in team" });
      return;
    }

    const newEntry = {
      dancer_id: member.id,
      name: member.displayName,
      city: member.city || null,
      is_leader: false,
    };

    const existingLeaderId = getCurrentLeaderId();
    const shouldBecomeLeader = !existingLeaderId && currentTeam.length === 0;
    if (shouldBecomeLeader) {
      newEntry.is_leader = true;
    }

    const nextTeam = [...currentTeam, newEntry];
    setTeamInput(JSON.stringify(nextTeam, null, 2));
    if (shouldBecomeLeader) {
      updateLeaderMeta(member.id, member.displayName);
    }
    toast({ title: "Team member added" });
  };

  const removeTeamMember = (dancerId: string | number) => {
    let currentTeam: any[] = [];
    try {
      if (teamInput.trim()) {
        const parsed = JSON.parse(teamInput);
        if (Array.isArray(parsed)) currentTeam = parsed;
      }
    } catch {
      // ignore
    }
    const normalizedDancerId = String(dancerId);
    const removedMember = currentTeam.find((t: any) => String(t.dancer_id) === normalizedDancerId) || null;
    const nextTeam = currentTeam.filter((t: any) => String(t.dancer_id) !== normalizedDancerId);
    const currentLeaderId = getCurrentLeaderId();

    if (currentLeaderId && currentLeaderId === normalizedDancerId) {
      if (nextTeam.length > 0) {
        const newLeaderId = String(nextTeam[0].dancer_id);
        const newLeaderName = typeof nextTeam[0].name === "string" ? nextTeam[0].name : null;
        const normalizedTeam = nextTeam.map((member: any, index: number) => ({
          ...member,
          is_leader: index === 0,
        }));
        setTeamInput(JSON.stringify(normalizedTeam, null, 2));
        updateLeaderMeta(newLeaderId, newLeaderName);
      } else {
        setTeamInput(JSON.stringify([], null, 2));
        updateLeaderMeta(null, null);
      }
      toast({ title: "Leader reassigned", description: removedMember?.name ? `${removedMember.name} was removed.` : undefined });
      return;
    }

    setTeamInput(JSON.stringify(nextTeam, null, 2));
  };

  const embeddedCardClass = embedded
    ? "dashboard-card border-festival-teal/35 bg-background/70 backdrop-blur-sm shadow-md ring-1 ring-festival-teal/15"
    : "";

  const sectionAccentTone: Record<VendorDashboardSection, string> = {
    profile: "border-l-2 border-l-cyan-400/70",
    media: "border-l-2 border-l-sky-400/70",
    categories: "border-l-2 border-l-indigo-400/70",
    products: "border-l-2 border-l-emerald-400/70",
    promo: "border-l-2 border-l-amber-400/70",
    events: "border-l-2 border-l-orange-400/70",
    contact: "border-l-2 border-l-teal-400/70",
    social: "border-l-2 border-l-violet-400/70",
    faq: "border-l-2 border-l-fuchsia-400/70",
    team: "border-l-2 border-l-cyan-300/70",
    save: "border-l-2 border-l-emerald-300/70",
    advanced: "border-l-2 border-l-red-400/70",
  };

  const sectionCardClass = (section: VendorDashboardSection) =>
    cn(
      embeddedCardClass,
      sectionAccentTone[section],
      focusedSection === section ? "ring-2 ring-primary ring-offset-2 transition" : ""
    );

  const isEditMode = Boolean(form.id);

  const promoValueParsed = toNullableNumber(form.promo_discount_value);
  const hasPromoValueError =
    form.promo_discount_value.trim().length > 0 && promoValueParsed === null;
  const normalizedWebsite = normalizeHttpUrl(form.website);
  const hasEmailFormatError =
    form.public_email.trim().length > 0 && !EMAIL_PATTERN.test(form.public_email.trim());
  const hasWebsiteFormatError =
    form.website.trim().length > 0 && normalizedWebsite === null;
  const hasWhatsappFormatHint =
    form.whatsapp.trim().length > 0 && !PHONE_PATTERN.test(form.whatsapp.trim());
  const hasBusinessNameError = form.business_name.trim().length === 0;
  const hasCityError = !hasRequiredCity(normalizeRequiredCity(form.city));
  const hasInvalidProducts = form.products.some((item) => item.name.trim().length === 0);
  const isSaveDisabled =
    savePending ||
    uploadPending ||
    hasBusinessNameError ||
    hasPromoValueError ||
    hasEmailFormatError ||
    hasWebsiteFormatError ||
    hasInvalidProducts;

  const showBusinessNameError = touched.businessName && hasBusinessNameError;
  const showCityError = touched.city && hasCityError;
  const showPromoValueError = touched.promoValue && hasPromoValueError;
  const showEmailFormatError = touched.email && hasEmailFormatError;
  const showWebsiteFormatError = touched.website && hasWebsiteFormatError;
  const showWhatsappFormatHint = touched.whatsapp && hasWhatsappFormatHint;
  const showProductErrors = touched.products && hasInvalidProducts;
  const isFocusedProfileEdit = embedded && forcedSection === "profile";
  const showBusinessNameField = !(isFocusedProfileEdit && profileFocus === "location");
  const showCityField = !(isFocusedProfileEdit && profileFocus === "name");
  const profileIntroText = showBusinessNameField && showCityField
    ? "Add business name and city."
    : showCityField
      ? "Add your city."
      : "Add your business name.";

  const saveBlockers = useMemo(() => {
    const blockers: Array<{ section: VendorDashboardSection; label: string }> = [];

    if (hasBusinessNameError || hasCityError) {
      blockers.push({ section: "profile", label: "Finish business basics" });
    }
    if (hasInvalidProducts) {
      blockers.push({ section: "products", label: "Fix product names" });
    }
    if (hasPromoValueError) {
      blockers.push({ section: "promo", label: "Fix promo value" });
    }
    if (hasEmailFormatError) {
      blockers.push({ section: "contact", label: "Fix email format" });
    }
    if (hasWebsiteFormatError) {
      blockers.push({ section: "social", label: "Fix website link" });
    }

    return blockers;
  }, [
    hasBusinessNameError,
    hasCityError,
    hasEmailFormatError,
    hasInvalidProducts,
    hasPromoValueError,
    hasWebsiteFormatError,
  ]);

  const jumpToSection = (section: VendorDashboardSection) => {
    const target = document.getElementById(`dashboard-section-${section}`);
    if (!target) return;

    target.scrollIntoView({ behavior: "smooth", block: "start" });
    setFocusedSection(section);

    window.setTimeout(() => {
      setFocusedSection((current) => (current === section ? null : current));
    }, 1600);
  };

  const addCategory = () => {
    const value = categoryInput.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      product_categories: Array.from(new Set([...prev.product_categories, value])),
    }));
    setCategoryInput("");
  };

  const addUpcomingEvent = () => {
    const value = upcomingEventsInput.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      upcoming_events: Array.from(new Set([...prev.upcoming_events, value])),
    }));
    setUpcomingEventsInput("");
  };

  const removeUpcomingEvent = (value: string) => {
    setForm((prev) => ({
      ...prev,
      upcoming_events: prev.upcoming_events.filter((item) => item !== value),
    }));
  };

  const formatEventDate = (value: string | null) => {
    if (!value) return "TBA";
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return "TBA";
    return parsed.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const filteredEventSuggestions = useMemo(() => {
    const term = eventSearchInput.trim().toLowerCase();
    const base = !term
      ? eventSuggestions
      : eventSuggestions.filter((event) => event.name.toLowerCase().includes(term));

    return [...base].sort((a, b) => {
      const aSelected = form.upcoming_events.includes(a.id) ? 1 : 0;
      const bSelected = form.upcoming_events.includes(b.id) ? 1 : 0;
      return bSelected - aSelected;
    });
  }, [eventSuggestions, eventSearchInput, form.upcoming_events]);

  const selectedEventItems = useMemo(() => {
    return form.upcoming_events.map((eventId) => {
      const match = eventSuggestions.find((event) => event.id === eventId);
      return {
        id: eventId,
        name: match?.name || `Event ${eventId}`,
        date: match?.date || null,
        city: match?.city || null,
        location: match?.location || null,
        imageUrl: match?.imageUrl || null,
        hasParty: Boolean(match?.hasParty),
        hasClass: Boolean(match?.hasClass),
      };
    });
  }, [form.upcoming_events, eventSuggestions]);

  const addableEventSuggestions = useMemo(() => {
    return filteredEventSuggestions.filter((event) => !form.upcoming_events.includes(event.id));
  }, [filteredEventSuggestions, form.upcoming_events]);

  const togglePendingEvent = (eventId: string) => {
    setPendingEventIds((prev) =>
      prev.includes(eventId) ? prev.filter((id) => id !== eventId) : [...prev, eventId]
    );
  };

  const addPendingEvents = () => {
    if (pendingEventIds.length === 0) return;
    setForm((prev) => ({
      ...prev,
      upcoming_events: Array.from(new Set([...prev.upcoming_events, ...pendingEventIds])),
    }));
    const count = pendingEventIds.length;
    setPendingEventIds([]);
    toast({ title: `${count} event(s) added` });
  };

  const removeCategory = (value: string) => {
    setForm((prev) => ({
      ...prev,
      product_categories: prev.product_categories.filter((item) => item !== value),
    }));
  };

  const orderedSelectedCategories = useMemo(() => {
    const quick = form.product_categories.filter((item) =>
      QUICK_CATEGORY_OPTIONS.includes(item as (typeof QUICK_CATEGORY_OPTIONS)[number])
    );
    const custom = form.product_categories.filter(
      (item) => !QUICK_CATEGORY_OPTIONS.includes(item as (typeof QUICK_CATEGORY_OPTIONS)[number])
    );
    return [...quick, ...custom];
  }, [form.product_categories]);

  const toggleCategory = (value: string) => {
    setForm((prev) => {
      const hasValue = prev.product_categories.includes(value);
      return {
        ...prev,
        product_categories: hasValue
          ? prev.product_categories.filter((item) => item !== value)
          : Array.from(new Set([...prev.product_categories, value])),
      };
    });
  };

  const addProduct = () => {
    setForm((prev) => ({
      ...prev,
      products: [...prev.products, { name: "", price: null, variants: [], description: "", image_url: "" }],
    }));
  };

  const updateProduct = (index: number, patch: Partial<VendorProduct>) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.map((item, itemIndex) => (itemIndex === index ? { ...item, ...patch } : item)),
    }));
  };

  const removeProduct = (index: number) => {
    setForm((prev) => ({
      ...prev,
      products: prev.products.filter((_, itemIndex) => itemIndex !== index),
    }));
  };

  const removePrimaryImage = () => {
    setForm((prev) => ({
      ...prev,
      photo_url: [],
    }));
  };

  const uploadProductImage = async (index: number, file: File | null) => {
    if (!file) return;

    try {
      const [uploadedUrl] = await uploadToImagesBucket([file]);
      if (!uploadedUrl) {
        throw new Error("No image URL returned from upload.");
      }
      updateProduct(index, { image_url: uploadedUrl });
      toast({ title: "Product image uploaded" });
    } catch (uploadError: any) {
      const message = uploadError?.message || "Could not upload product image.";
      toast({
        title: "Upload failed",
        description: message,
        variant: "destructive",
      });
    }
  };

  const uploadToImagesBucket = async (files: File[]): Promise<string[]> => {
    if (!user?.id || files.length === 0) return [];

    setUploadPending(true);
    setUploadProgress(0);

    const uploaded: string[] = [];

    const formatUploadErrorMessage = (error: any) => {
      const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
      if (text.includes("bucket") || text.includes("not found")) {
        return "Upload failed: storage bucket 'images' is missing. Create it and allow authenticated uploads.";
      }
      if (text.includes("row-level security") || text.includes("permission") || text.includes("not authorized")) {
        return "Upload blocked by storage permissions. Check RLS policy for bucket 'images' for authenticated users.";
      }
      return error?.message || "Upload failed. Please try again.";
    };

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension = file.name.split(".").pop() || "jpg";
      const path = `vendors/${user.id}/${Date.now()}-${index}.${extension}`;

      const { error: uploadError } = await supabase.storage.from("images").upload(path, file, {
        upsert: false,
      });

      if (uploadError) {
        setUploadPending(false);
        setUploadProgress(0);
        throw new Error(formatUploadErrorMessage(uploadError));
      }

      const { data } = supabase.storage.from("images").getPublicUrl(path);
      uploaded.push(data.publicUrl);
      setUploadProgress(Math.round(((index + 1) / files.length) * 100));
    }

    setUploadPending(false);
    return uploaded;
  };

  const normalizedProductsJson: Json = useMemo(() => {
    const parsed = form.products
      .map((item) => {
        const name = item.name.trim();
        if (!name) return null;

        const record: Record<string, Json> = {
          name,
        };

        if (typeof item.price === "number" && Number.isFinite(item.price)) {
          record.price = item.price;
        }

        if (item.description?.trim()) {
          record.description = item.description.trim();
        }

        if (item.image_url?.trim()) {
          record.image_url = item.image_url.trim();
        }

        if (Array.isArray(item.variants) && item.variants.length > 0) {
          record.variants = item.variants as Json;
        }

        return record as Json;
      })
      .filter((item): item is Json => Boolean(item));

    return parsed;
  }, [form.products]);

  const parsedTeamDisplay = useMemo(() => {
    try {
      if (!teamInput.trim()) return [];
      const parsed = JSON.parse(teamInput);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }, [teamInput]);

  const currentLeaderDancerId = useMemo(() => {
    const meta = form.meta_data;
    if (meta && typeof meta === "object" && !Array.isArray(meta)) {
      const value = (meta as Record<string, unknown>).business_leader_dancer_id;
      return typeof value === "string" ? value : null;
    }
    const teamLeader = parsedTeamDisplay.find((member: any) => member?.is_leader);
    if (!teamLeader) return null;
    return String(teamLeader.dancer_id);
  }, [form.meta_data, parsedTeamDisplay]);

  const sectionProgress = useMemo<VendorDashboardProgressMap>(() => {
    const hasCity = hasRequiredCity(normalizeRequiredCity(form.city));
    const hasPrimaryImage = Boolean(primaryFile) || Boolean(form.photo_url[0]);
    const hasAnyProduct = form.products.length > 0;
    const productsComplete = hasAnyProduct && form.products.every((product) => {
      const hasName = product.name.trim().length > 0;
      const hasPrice = typeof product.price === "number" && Number.isFinite(product.price);
      const hasImage = Boolean(product.image_url?.trim());
      return hasName && hasPrice && hasImage;
    });

    const hasPromoCode = form.promo_code.trim().length > 0;
    const promoComplete = !hasPromoCode || (toNullableNumber(form.promo_discount_value) !== null);
    const hasAnyContact = [form.public_email, form.whatsapp].some((item) => item.trim().length > 0);
    const hasAnySocial = [form.website, form.instagram, form.facebook].some((item) => item.trim().length > 0);
    const hasTeamMembers = parsedTeamDisplay.length > 0;

    return {
      profile: { complete: form.business_name.trim().length > 0 && hasCity },
      media: { complete: hasPrimaryImage },
      categories: { complete: form.product_categories.length > 0 },
      products: { complete: productsComplete },
      promo: { complete: promoComplete },
      events: { complete: form.upcoming_events.length > 0 },
      contact: { complete: hasAnyContact },
      social: { complete: hasAnySocial },
      faq: { complete: form.faq.trim().length > 0 },
      team: { complete: hasTeamMembers && Boolean(currentLeaderDancerId) },
      save: {
        complete:
          form.business_name.trim().length > 0 &&
          hasCity &&
          promoComplete &&
          !hasInvalidProducts,
      },
      advanced: { complete: Boolean(form.id) },
    };
  }, [
    currentLeaderDancerId,
    form.business_name,
    form.city,
    form.public_email,
    form.facebook,
    form.faq,
    form.id,
    form.instagram,
    form.photo_url,
    form.product_categories,
    form.products,
    form.promo_code,
    form.promo_discount_value,
    form.upcoming_events,
    form.website,
    form.whatsapp,
    hasInvalidProducts,
    parsedTeamDisplay.length,
    primaryFile,
  ]);

  useEffect(() => {
    onProgressChange?.(sectionProgress);
  }, [onProgressChange, sectionProgress]);

  const saveVendor = async () => {
    if (!user?.id) return;

    if (eventsOnlyMode) {
      if (!isEditMode || !form.id) {
        toast({
          title: "Create vendor profile first",
          description: "You need a vendor profile before linking events.",
          variant: "destructive",
        });
        return;
      }

      setSavePending(true);
      setError(null);
      setNotAuthorized(false);

      try {
        const mergedEvents = normalizeStringArray([...form.upcoming_events, ...pendingEventIds]);
        const { error: updateError } = await supabase
          .from("vendors")
          .update({
            upcoming_events: mergedEvents.length > 0 ? mergedEvents : null,
          })
          .eq("id", form.id)
          .eq("user_id", user.id);

        if (updateError) {
          if (isRlsError(updateError)) {
            setNotAuthorized(true);
            return;
          }
          throw updateError;
        }

        setForm((prev) => ({ ...prev, upcoming_events: mergedEvents }));
        setPendingEventIds([]);
        const savedAt = new Date().toISOString();
        applySectionSaveStamp("events", savedAt);
        if (draftStorageKey) {
          localStorage.removeItem(draftStorageKey);
          setLocalDraftSavedAt(null);
        }
        toast({ title: "Events updated" });
        onSaved?.({
          section: "events",
          savedAt,
          progress: sectionProgress,
        });
      } catch (saveError: any) {
        const friendlyMessage = getFriendlyVendorSaveError(saveError, true);
        setError(friendlyMessage);
        toast({
          title: "Save issue",
          description: friendlyMessage,
          variant: "destructive",
        });
      } finally {
        setSavePending(false);
      }

      return;
    }

    setTouched({
      businessName: true,
      city: true,
      promoValue: true,
      products: true,
      email: true,
      website: true,
      whatsapp: true,
    });

    const businessName = form.business_name.trim();
    if (!businessName) {
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
        description: 'Please choose city from the city picker list.',
        variant: 'destructive',
      });
      return;
    }

    if (hasEmailFormatError) {
      toast({
        title: "Enter a valid email",
        description: "Please check your contact email format.",
        variant: "destructive",
      });
      return;
    }

    if (hasWebsiteFormatError) {
      toast({
        title: "Enter a valid website",
        description: "Use a full URL or domain (for example: yoursite.com).",
        variant: "destructive",
      });
      return;
    }

    let parsedTeam: Json | null = null;
    const teamText = teamInput.trim();
    if (teamText) {
      try {
        parsedTeam = JSON.parse(teamText) as Json;
      } catch {
        toast({
          title: "Invalid team JSON",
          description: "Team must be valid JSON (example: [{\"name\":\"Ana\",\"role\":\"Sales\"}]).",
          variant: "destructive",
        });
        return;
      }
    }

    setSavePending(true);
    setError(null);
    setNotAuthorized(false);

    try {
      let photoUrl = normalizeStringArray(form.photo_url).slice(0, 1);

      if (primaryFile) {
        const [uploadedPrimary] = await uploadToImagesBucket([primaryFile]);
        photoUrl = uploadedPrimary ? [uploadedPrimary] : [];
      }

      const promoValue = toNullableNumber(form.promo_discount_value);
      const categories = normalizeStringArray(form.product_categories);
      const upcomingEvents = normalizeStringArray(form.upcoming_events);

      const payload = {
        business_name: businessName,
        city_id: canonicalCity.cityId,
        photo_url: photoUrl.length > 0 ? photoUrl : null,
        product_categories: categories.length > 0 ? categories : null,
        products: normalizedProductsJson,
        ships_international: form.ships_international,
        promo_code: form.promo_code.trim() || null,
        promo_discount_type: form.promo_code.trim() ? form.promo_discount_type.trim() || null : null,
        promo_discount_value: form.promo_code.trim() ? promoValue : null,
        public_email: form.public_email.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        website: normalizedWebsite,
        instagram: normalizeSocialUrl('instagram', form.instagram) || null,
        facebook: normalizeSocialUrl('facebook', form.facebook) || null,
        faq: form.faq.trim() || null,
        upcoming_events: upcomingEvents.length > 0 ? upcomingEvents : null,
        meta_data: form.meta_data,
        team: parsedTeam,
      };

      const { data: savedVendorData, error: saveError } = isEditMode && form.id
        ? await supabase
            .from("vendors")
            .update(payload)
            .eq("id", form.id)
            .eq("user_id", user.id)
            .select("*")
            .single()
        : await supabase
            .from("vendors")
            .insert({ ...payload, user_id: user.id })
            .select("*")
            .single();

      if (saveError) throw saveError;

      const savedVendor = savedVendorData as VendorRow;
      setForm(toFormState(savedVendor));
      setTeamInput(savedVendor?.team ? JSON.stringify(savedVendor.team, null, 2) : "");
      setPrimaryFile(null);
      const savedAt = new Date().toISOString();
      const savedSection = activeDashboardSection ?? "save";
      applySectionSaveStamp(savedSection, savedAt);
      if (draftStorageKey) {
        localStorage.removeItem(draftStorageKey);
        setLocalDraftSavedAt(null);
      }
      toast({ title: isEditMode ? "Vendor profile updated" : "Vendor profile created" });
      onSaved?.({
        section: savedSection,
        savedAt,
        vendor: savedVendor,
        progress: sectionProgress,
      });
    } catch (saveError: any) {
      if (isRlsError(saveError)) {
        setNotAuthorized(true);
        return;
      }
      const friendlyMessage = getFriendlyVendorSaveError(saveError, false);
      setError(friendlyMessage);
      toast({
        title: "Save issue",
        description: friendlyMessage,
        variant: "destructive",
      });
    } finally {
      setSavePending(false);
      setUploadPending(false);
      setUploadProgress(0);
    }
  };

  const deleteVendor = async () => {
    if (!user?.id || !form.id) return;
    setDeletePending(true);
    setError(null);
    setNotAuthorized(false);

    const { error: deleteError } = await supabase
      .from("vendors")
      .delete()
      .eq("id", form.id)
      .eq("user_id", user.id);

    if (deleteError) {
      if (isRlsError(deleteError)) {
        setNotAuthorized(true);
      } else {
        setError(deleteError.message || "Failed to delete profile.");
      }
    } else {
      setForm(emptyForm);
      setTeamInput("");
      setPrimaryFile(null);
      if (draftStorageKey) {
        localStorage.removeItem(draftStorageKey);
        setLocalDraftSavedAt(null);
      }
      toast({ title: "Vendor profile deleted" });
    }

    setDeletePending(false);
  };

  if (authLoading || fetchingVendor) {
    return (
      <div className={embedded ? "py-8 flex items-center justify-center gap-2 text-muted-foreground" : "min-h-screen pt-[95px] px-4 pb-24 flex items-center justify-center gap-2 text-muted-foreground"}>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading vendor dashboard...</span>
      </div>
    );
  }

  if (notAuthorized) {
    return (
      <div className={embedded ? "" : "min-h-screen pt-[95px] px-4 pb-24"}>
        <div className={embedded ? "" : "max-w-3xl mx-auto"}>
          <Card className={embeddedCardClass}>
            <CardContent className="pt-6 text-center space-y-2">
              <h1 className="text-2xl font-semibold">Not authorized</h1>
              <p className="text-muted-foreground">You do not have permission to access this vendor profile.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className={embedded ? "" : "min-h-screen pt-[95px] px-4 pb-24"}>
      <div
        className={cn(
          embedded
            ? "space-y-6 rounded-xl border border-festival-teal/25 bg-[radial-gradient(circle_at_top,_hsl(var(--festival-teal)_/_0.12),_transparent_62%)] p-2"
            : "max-w-4xl mx-auto space-y-6"
        )}
      >
        {!embedded && (
          <div className="space-y-2">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
                <p className="text-muted-foreground">
                  {activeDashboardSection
                    ? `Editing section: ${activeDashboardSection}`
                    : isEditMode
                      ? "Edit your vendor profile."
                      : "Create your vendor profile."}
                </p>
              </div>
              <Button
                type="button"
                size="sm"
                variant={expertMode ? "default" : "outline"}
                className="h-8 text-[11px] focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors"
                onClick={() => setExpertMode((prev) => !prev)}
              >
                {expertMode ? "Expert mode: On" : "Expert mode"}
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-muted-foreground">
                {getDraftSavedLabel() || "Draft auto-saves on this device."}
              </p>
              {draftStorageKey && (
                <Button type="button" size="sm" variant="ghost" className="h-6 text-[11px] text-amber-200 hover:text-amber-100 hover:bg-amber-500/10 focus-visible:ring-2 focus-visible:ring-amber-400/50" onClick={clearLocalDraft}>
                  Clear draft
                </Button>
              )}
            </div>
          </div>
        )}

        {error && (
          <Card className={embeddedCardClass}>
            <CardContent className="pt-6 text-destructive border border-destructive/30 bg-destructive/10 rounded-md flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </CardContent>
          </Card>
        )}

        {uploadPending && (
          <Card className={embeddedCardClass}>
            <CardContent className="pt-6 space-y-2 border border-festival-teal/30 bg-festival-teal/5 rounded-md">
              <p className="text-sm text-muted-foreground">Uploading media...</p>
              <Progress value={uploadProgress} />
              <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
            </CardContent>
          </Card>
        )}

        {isEditMode && !embedded && (
          <Card className="border-primary/30 bg-primary/5 shadow-sm">
            <CardContent className="pt-6">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <h3 className="font-semibold text-lg flex items-center gap-2 text-primary">
                    <Share2 className="h-5 w-5" />
                    Share your profile
                  </h3>
                  <p className="text-sm text-foreground/80">
                    Your public profile is live! Share this link to get more exposure.
                  </p>
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <div className="relative flex-1 sm:w-64">
                    <Input
                      readOnly
                      value={`${window.location.origin}/vendors/${form.id}`}
                      className="pr-10 bg-muted/40 border-dashed border-festival-teal/35 text-muted-foreground"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent focus-visible:ring-2 focus-visible:ring-primary/60"
                      onClick={() => {
                         navigator.clipboard.writeText(`${window.location.origin}/vendors/${form.id}`);
                         toast({ title: "Link copied to clipboard" });
                      }}
                    >
                      <Copy className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </div>
                  <Button
                    size="sm"
                    variant="default" 
                    className="shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/60 transition-all"
                    onClick={() => window.open(`/vendors/${form.id}`, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">View Public</span>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {showSection("profile") && (
        <Card id="dashboard-section-profile" className={sectionCardClass("profile")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">1) Business basics <SectionHint text="Add name and city so buyers can find you." /></CardTitle>
            <p className="text-xs text-muted-foreground">{profileIntroText}</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {showBusinessNameField && (
              <div>
                <Label>Business name *</Label>
                <Input
                  value={form.business_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, business_name: e.target.value }))}
                  onBlur={() => setTouched((prev) => ({ ...prev, businessName: true }))}
                  placeholder="Your business name"
                />
                {showBusinessNameError && (
                  <p className="text-xs text-destructive mt-1">Business name is required.</p>
                )}
              </div>
            )}
            {showCityField && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                <Label>City *</Label>
                <CityPicker
                  value={form.city}
                  onChange={(city) => { setForm((prev) => ({ ...prev, city })); setTouched((prev) => ({ ...prev, city: true })); }}
                  placeholder="Select city..."
                />
                {showCityError && (
                  <p className="text-xs text-destructive mt-1">City is required.</p>
                )}
              </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Team members are managed in section 10.
            </p>
          </CardContent>
        </Card>
        )}

        {showSection("media") && (
        <Card id="dashboard-section-media" className={sectionCardClass("media")}>
          <CardHeader>
            <CardTitle>2) Business logo</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Logo image</Label>
              <p className="mt-1 text-xs text-muted-foreground">Upload a clear square logo.</p>
              <div className="mt-2 flex flex-wrap gap-3 items-center">
                {form.photo_url[0] && (
                  <div className="relative h-24 w-24 rounded-md overflow-hidden border">
                    <img src={form.photo_url[0]} alt="Business logo" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      className="absolute top-1 right-1 rounded-full bg-black/70 text-white px-1"
                      onClick={removePrimaryImage}
                    >
                      ×
                    </button>
                  </div>
                )}
                <Label className="inline-flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer">
                  <Upload className="h-4 w-4" />
                  Upload logo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => setPrimaryFile(e.target.files?.[0] || null)}
                  />
                </Label>
                {primaryFile && <Badge variant="outline">{primaryFile.name}</Badge>}
              </div>
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("categories") && (
        <Card id="dashboard-section-categories" className={sectionCardClass("categories")}>
          <CardHeader>
            <CardTitle>3) Categories & shipping</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                placeholder="Add category"
                value={categoryInput}
                onChange={(e) => setCategoryInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addCategory();
                  }
                }}
              />
              <Button type="button" className="focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors" onClick={addCategory}>Add</Button>
            </div>
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Quick categories</p>
              <div className="flex flex-wrap gap-2">
                {QUICK_CATEGORY_OPTIONS.map((option) => {
                  const selected = form.product_categories.includes(option);
                  return (
                    <Button
                      key={option}
                      type="button"
                      size="sm"
                      variant={selected ? "default" : "outline"}
                      className="h-7 text-[11px] focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors"
                      onClick={() => toggleCategory(option)}
                    >
                      {option}
                    </Button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {orderedSelectedCategories.map((item) => (
                <Badge key={item} variant="secondary" className="gap-2">
                  {item}
                  <button type="button" className="rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-festival-teal/60" onClick={() => removeCategory(item)}>×</button>
                </Badge>
              ))}
            </div>
            <div className="flex items-center justify-between border rounded-md p-3">
              <Label>Ships internationally</Label>
              <Switch
                checked={form.ships_international}
                onCheckedChange={(checked) => setForm((prev) => ({ ...prev, ships_international: checked }))}
              />
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("products") && (
        <Card id="dashboard-section-products" className={sectionCardClass("products")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">4) Product catalog <SectionHint text="Complete product cards help buyers decide." /></CardTitle>
            <p className="text-xs text-muted-foreground">Add name, price, image, and details.</p>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.products.map((product, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Name *"
                    value={product.name}
                    onChange={(e) => {
                      updateProduct(index, { name: e.target.value });
                      if (!touched.products) {
                        setTouched((prev) => ({ ...prev, products: true }));
                      }
                    }}
                  />
                  <Input
                    type="number"
                    placeholder="Price"
                    value={typeof product.price === "number" ? product.price : ""}
                    onChange={(e) => {
                      const parsed = e.target.value.trim() ? Number(e.target.value) : null;
                      updateProduct(index, { price: Number.isFinite(parsed) ? parsed : null });
                    }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Label className="inline-flex items-center gap-2 border rounded-md px-3 py-2 cursor-pointer text-xs">
                    <Upload className="h-3.5 w-3.5" />
                    Upload image
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] || null;
                        void uploadProductImage(index, file);
                        e.currentTarget.value = "";
                      }}
                    />
                  </Label>
                  {product.image_url?.trim() && (
                    <a
                      href={product.image_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-muted-foreground underline"
                    >
                      View uploaded image
                    </a>
                  )}
                </div>
                <Input
                  placeholder="Variants (comma separated)"
                  value={(product.variants || []).join(", ")}
                  onChange={(e) => {
                    const variants = e.target.value
                      .split(",")
                      .map((item) => item.trim())
                      .filter(Boolean);
                    updateProduct(index, { variants });
                  }}
                />
                <Textarea
                  placeholder="Description"
                  value={product.description || ""}
                  onChange={(e) => updateProduct(index, { description: e.target.value })}
                />
                {showProductErrors && product.name.trim().length === 0 && (
                  <p className="text-xs text-destructive">Product name is required.</p>
                )}
                <Button type="button" variant="ghost" className="hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-red-400/50 transition-colors" onClick={() => removeProduct(index)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove product
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" className="focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors" onClick={addProduct}>
              <Plus className="h-4 w-4 mr-1" />
              Add product
            </Button>
          </CardContent>
        </Card>
        )}

        {showSection("promo") && (
        <Card id="dashboard-section-promo" className={sectionCardClass("promo")}>
          <CardHeader>
            <CardTitle>5) Promo offer</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Promo code</Label>
              <Input value={form.promo_code} onChange={(e) => setForm((prev) => ({ ...prev, promo_code: e.target.value }))} />
            </div>
            <div>
              <Label>Discount type</Label>
              <select
                className="h-10 w-full rounded-md border border-input bg-background px-3"
                value={form.promo_discount_type}
                onChange={(e) => setForm((prev) => ({ ...prev, promo_discount_type: e.target.value as VendorPromoDiscountType }))}
              >
                <option value="percent">percent</option>
                <option value="fixed">fixed</option>
              </select>
            </div>
            <div>
              <Label>Discount value</Label>
              <Input
                type="number"
                value={form.promo_discount_value}
                onChange={(e) => setForm((prev) => ({ ...prev, promo_discount_value: e.target.value }))}
                onBlur={() => setTouched((prev) => ({ ...prev, promoValue: true }))}
              />
              {showPromoValueError && (
                <p className="text-xs text-destructive mt-1">Discount value must be a valid number.</p>
              )}
              {form.promo_code.trim().length > 0 && form.promo_discount_value.trim().length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">Required when promo code is set.</p>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("events") && (
        <Card id="dashboard-section-events" className={sectionCardClass("events")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">6) Event visibility <SectionHint text="Link events to help buyers discover your storefront." /></CardTitle>
            <p className="text-xs text-muted-foreground">Link upcoming events.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground">Selected events</p>
              <div className="space-y-2">
                {selectedEventItems.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-3 rounded-md border border-festival-teal/25 p-2">
                    <div className="min-w-0 flex items-center gap-2.5">
                      <div className="h-12 w-12 rounded-md overflow-hidden border border-border/50 bg-muted/20 shrink-0">
                        {event.imageUrl ? (
                          <img src={event.imageUrl} alt={event.name} className="h-full w-full object-cover" />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center text-muted-foreground">
                            <CalendarDays className="h-4 w-4" />
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{event.name}</p>
                        <p className="text-xs text-muted-foreground">{formatEventDate(event.date)}{event.location ? ` • ${event.location}` : event.city ? ` • ${event.city}` : ""}</p>
                        <div className="flex gap-1 mt-1">
                          {event.hasParty && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Party</Badge>}
                          {event.hasClass && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Class</Badge>}
                        </div>
                      </div>
                    </div>
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[11px] focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors" onClick={() => removeUpcomingEvent(event.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
                {selectedEventItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">No events selected yet.</p>
                )}
              </div>
            </div>

            <Input
              placeholder="Search events by name"
              value={eventSearchInput}
              onChange={(e) => setEventSearchInput(e.target.value)}
            />

            <div className="space-y-2 rounded-md border border-festival-teal/25 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Calendar events</p>
                <Button type="button" size="sm" className="h-7 text-[11px] shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/60 transition-all" disabled={pendingEventIds.length === 0} onClick={addPendingEvents}>
                  Add selected{pendingEventIds.length ? ` (${pendingEventIds.length})` : ""}
                </Button>
              </div>

              {loadingEventSuggestions ? (
                <p className="text-xs text-muted-foreground">Loading calendar events…</p>
              ) : addableEventSuggestions.length === 0 ? (
                <p className="text-xs text-muted-foreground">No suggested events found.</p>
              ) : (
                addableEventSuggestions.slice(0, 8).map((event) => {
                  return (
                    <div key={event.id} className="flex items-center gap-3 rounded-md border border-border/50 p-2">
                      <label className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer">
                        <Checkbox checked={pendingEventIds.includes(event.id)} onCheckedChange={() => togglePendingEvent(event.id)} className="mt-0.5" />
                        <span className="min-w-0 flex items-center gap-2.5">
                          <span className="h-12 w-12 rounded-md overflow-hidden border border-border/50 bg-muted/20 shrink-0">
                            {event.imageUrl ? (
                              <img src={event.imageUrl} alt={event.name} className="h-full w-full object-cover" />
                            ) : (
                              <span className="h-full w-full flex items-center justify-center text-muted-foreground"><CalendarDays className="h-4 w-4" /></span>
                            )}
                          </span>
                          <span className="min-w-0">
                            <span className="text-sm font-medium truncate block">{event.name}</span>
                            <span className="text-xs text-muted-foreground inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{event.location || event.city || "Location TBA"}</span>
                            <span className="text-xs text-muted-foreground block">{formatEventDate(event.date)}</span>
                            <span className="flex gap-1 mt-1">
                              {event.hasParty && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5"><Flame className="h-3 w-3 mr-0.5" />Party</Badge>}
                              {event.hasClass && <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5">Class</Badge>}
                            </span>
                          </span>
                        </span>
                      </label>
                    </div>
                  );
                })
              )}
            </div>

            {expertMode ? (
              <details className="rounded-md border border-border/50 p-2.5">
                <summary className="cursor-pointer text-xs text-muted-foreground">Advanced: add by event ID</summary>
                <div className="flex gap-2 mt-2">
                  <Input
                    placeholder="Add event id"
                    value={upcomingEventsInput}
                    onChange={(e) => setUpcomingEventsInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addUpcomingEvent();
                      }
                    }}
                  />
                  <Button type="button" className="focus-visible:ring-2 focus-visible:ring-primary/60 transition-colors" onClick={addUpcomingEvent}>Add</Button>
                </div>
              </details>
            ) : (
              <p className="text-xs text-muted-foreground">Need exact event IDs? Enable Expert mode.</p>
            )}

            {eventsOnlyMode && (
              <div className="sticky bottom-0 z-20 border border-festival-teal/35 bg-background/95 backdrop-blur-sm rounded-lg p-2.5 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-[12px] focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors"
                  disabled={pendingEventIds.length === 0}
                  onClick={addPendingEvents}
                >
                  Add selected{pendingEventIds.length ? ` (${pendingEventIds.length})` : ""}
                </Button>
                <Button
                  type="button"
                  className="h-8 text-[12px] shadow-sm hover:shadow-md focus-visible:ring-2 focus-visible:ring-primary/60 transition-all"
                  disabled={savePending || uploadPending || deletePending}
                  onClick={saveVendor}
                >
                  {savePending ? "Saving..." : "Done"}
                </Button>
              </div>
            )}

          </CardContent>
        </Card>
        )}

        {showSection("contact") && (
        <Card id="dashboard-section-contact" className={sectionCardClass("contact")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">7) Contact methods <SectionHint text="Add contact options so buyers can reach you." /></CardTitle>
            <p className="text-xs text-muted-foreground">Add at least two contact methods.</p>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Public contact email</Label>
              <Input
                value={form.public_email}
                onChange={(e) => setForm((prev) => ({ ...prev, public_email: e.target.value }))}
                onBlur={() => setTouched((prev) => ({ ...prev, email: true }))}
              />
              {showEmailFormatError && (
                <p className="text-xs text-destructive mt-1">Enter a valid email address.</p>
              )}
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input
                value={form.whatsapp}
                onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))}
                onBlur={() => setTouched((prev) => ({ ...prev, whatsapp: true }))}
              />
              {showWhatsappFormatHint ? (
                <p className="text-xs text-amber-200 mt-1">Tip: use international format, for example +44 7123 456789.</p>
              ) : (
                <p className="text-xs text-muted-foreground mt-1">Optional: include country code so buyers can message directly.</p>
              )}
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("social") && (
        <Card id="dashboard-section-social" className={sectionCardClass("social")}>
          <CardHeader>
            <CardTitle>8) Website & social links</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Website</Label>
              <Input
                value={form.website}
                onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))}
                onBlur={() => setTouched((prev) => ({ ...prev, website: true }))}
              />
              {showWebsiteFormatError && (
                <p className="text-xs text-destructive mt-1">Enter a valid website URL or domain.</p>
              )}
            </div>
            <div>
              <Label>Instagram</Label>
              <Input
                value={form.instagram}
                onChange={(e) => setForm((prev) => ({ ...prev, instagram: e.target.value }))}
                onBlur={() => setForm((prev) => ({ ...prev, instagram: normalizeSocialUrl('instagram', prev.instagram) }))}
              />
            </div>
            <div>
              <Label>Facebook</Label>
              <Input
                value={form.facebook}
                onChange={(e) => setForm((prev) => ({ ...prev, facebook: e.target.value }))}
                onBlur={() => setForm((prev) => ({ ...prev, facebook: normalizeSocialUrl('facebook', prev.facebook) }))}
              />
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("faq") && (
        <Card id="dashboard-section-faq" className={sectionCardClass("faq")}>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">9) Buyer FAQ <SectionHint text="Answer common questions to reduce buyer friction." /></CardTitle>
            <p className="text-xs text-muted-foreground">Use short answers about shipping, sizing, returns, and pickup.</p>
          </CardHeader>
          <CardContent>
            <Textarea
              rows={6}
              value={form.faq}
              onChange={(e) => setForm((prev) => ({ ...prev, faq: e.target.value }))}
              placeholder="FAQ content"
            />
          </CardContent>
        </Card>
        )}

        {showSection("team") && (
        <Card id="dashboard-section-team" className={sectionCardClass("team")}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <div>
              <CardTitle>10) Team operations</CardTitle>
            </div>
            <Button type="button" variant="outline" size="sm" className="focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors" onClick={() => navigate('/dancers')}>
              Manage Dancers
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Add team member</Label>
              <div className="relative">
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search dancers by name..."
                      value={teamSearch}
                      onChange={(e) => setTeamSearch(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>
                
                {(teamResults.length > 0 || isSearchingTeam || teamSearchError) && (
                  <div className="absolute top-full left-0 right-0 z-10 mt-1 max-h-60 overflow-y-auto rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95">
                    {isSearchingTeam && (
                      <div className="flex items-center justify-center p-4 text-sm text-muted-foreground">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Searching...
                      </div>
                    )}
                    
                    {teamSearchError && (
                      <div className="p-2 text-sm text-destructive">{teamSearchError}</div>
                    )}

                    {!isSearchingTeam && teamResults.length === 0 && !teamSearchError && (
                       <div className="p-2 text-sm text-muted-foreground">No matches found.</div>
                    )}

                    {!isSearchingTeam && teamResults.map((dancer) => (
                      <button
                        key={dancer.id}
                        type="button"
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground border-b last:border-0 transition-colors"
                        onClick={() => addTeamMember(dancer)}
                      >
                        <div className="font-medium">{dancer.displayName}</div>
                        {dancer.city && <div className="text-xs text-muted-foreground">{dancer.city}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>Current team</Label>
              <div className="space-y-2">
                {parsedTeamDisplay.length === 0 && (
                  <p className="text-sm text-muted-foreground italic">No team members added yet.</p>
                )}
                {parsedTeamDisplay.map((member: any, i: number) => (
                  <div key={member.dancer_id || i} className="flex items-center justify-between border rounded-md p-2 bg-background/50">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs uppercase">
                        {(member.name || "?")[0]}
                      </div>
                      <div>
                        <div className="text-sm font-medium flex items-center gap-2">
                          {member.name}
                          {String(member.dancer_id) === String(currentLeaderDancerId || "") && (
                            <Badge variant="secondary" className="text-[10px]">Leader</Badge>
                          )}
                        </div>
                        {member.city && <div className="text-xs text-muted-foreground">{member.city}</div>}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {String(member.dancer_id) !== String(currentLeaderDancerId || "") && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="h-8 text-[11px]"
                          onClick={() => setTeamLeader(String(member.dancer_id))}
                        >
                          Set leader
                        </Button>
                      )}
                      <Button 
                        type="button" 
                        variant="ghost" 
                        size="sm" 
                        className="h-8 w-8 p-0"
                        onClick={() => removeTeamMember(member.dancer_id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {expertMode ? (
              <details className="pt-2">
                <summary className="text-xs text-muted-foreground cursor-pointer hover:underline">Advanced: Edit raw JSON</summary>
                 <Textarea
                  rows={5}
                  value={teamInput}
                  onChange={(e) => setTeamInput(e.target.value)}
                  placeholder='[{"name":"Ana","role":"Sales"}]'
                  className="mt-2 text-xs font-mono"
                />
              </details>
            ) : (
              <p className="text-xs text-muted-foreground">Need manual JSON editing? Enable Expert mode.</p>
            )}
          </CardContent>
        </Card>
        )}

        {showSection("save") && (
        <Card id="dashboard-section-save" className={sectionCardClass("save")}>
          <CardHeader>
            <CardTitle>11) Save & publish</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {saveBlockers.length > 0 && (
              <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2.5 space-y-2">
                <p className="text-xs text-amber-100">Complete these before publishing:</p>
                <div className="flex flex-wrap gap-2">
                  {saveBlockers.map((blocker) => (
                    <Button
                      key={`${blocker.section}-${blocker.label}`}
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 text-[11px]"
                      onClick={() => jumpToSection(blocker.section)}
                    >
                      {blocker.label}
                    </Button>
                  ))}
                </div>
              </div>
            )}
            <Button onClick={saveVendor} disabled={isSaveDisabled}>
              {savePending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditMode ? "Save changes" : "Create vendor profile"
              )}
            </Button>
          </CardContent>
        </Card>
        )}

        {showSection("advanced") && isEditMode && (
        <Card id="dashboard-section-advanced" className={sectionCardClass("advanced")}>
          <CardHeader><CardTitle>12) Advanced</CardTitle></CardHeader>
          <CardContent>
            <details className="text-sm text-muted-foreground">
              <summary className="cursor-pointer hover:underline">Danger Zone</summary>
              <div className="mt-4 border border-destructive/20 rounded-md p-4 bg-destructive/5 space-y-3">
                <p className="text-destructive font-medium">Delete Vendor Profile</p>
                <p>Once you delete your profile, there is no going back. Please be certain.</p>
                 <Button
                    variant="destructive"
                    onClick={deleteVendor}
                    disabled={deletePending || savePending || uploadPending}
                  >
                    {deletePending ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Deleting...
                      </>
                    ) : (
                      "Delete Profile"
                    )}
                 </Button>
              </div>
            </details>
          </CardContent>
        </Card>
        )}

        {isEmbeddedFocusedSectionMode && (
          <div className="flex justify-end">
            <Button onClick={saveVendor} disabled={isSaveDisabled}>
              {savePending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                isEditMode ? "Save changes" : "Create vendor profile"
              )}
            </Button>
          </div>
        )}

        {!embedded && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">
                Contact fields are shown only in your dashboard editor, never on public vendor pages unless surfaced explicitly.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VendorDashboard;
