import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Flame, Loader2, MapPin, Plus, Search, Trash2, Upload, X, Copy, ExternalLink, Share2, Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import type { VendorDashboardFormState, VendorProduct, VendorRow } from "@/modules/vendor/types";
import {
  isRlsError,
  normalizeProducts,
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
  country: "",
  photo_url: [],
  products: [],
  product_categories: [],
  ships_international: false,
  promo_code: "",
  promo_discount_type: "percent",
  promo_discount_value: "",
  email: "",
  phone: "",
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
  city: vendor.city || "",
  country: vendor.country || "",
  photo_url: normalizeStringArray(vendor.photo_url),
  products: normalizeProducts(vendor.products),
  product_categories: normalizeStringArray(vendor.product_categories),
  ships_international: Boolean(vendor.ships_international),
  promo_code: vendor.promo_code || "",
  promo_discount_type: vendor.promo_discount_type || "percent",
  promo_discount_value:
    typeof vendor.promo_discount_value === "number" ? String(vendor.promo_discount_value) : "",
  email: vendor.email || "",
  phone: vendor.phone || "",
  whatsapp: vendor.whatsapp || "",
  website: vendor.website || "",
  instagram: vendor.instagram || "",
  facebook: vendor.facebook || "",
  faq: vendor.faq || "",
  upcoming_events: normalizeStringArray(vendor.upcoming_events),
  meta_data: vendor.meta_data,
  team: vendor.team,
});

const DASHBOARD_SECTIONS = [
  "profile",
  "media",
  "products",
  "categories",
  "promo",
  "events",
  "contact",
  "social",
  "faq",
  "team",
  "save",
  "advanced",
] as const;

type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

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
  forcedSection?: DashboardSection | null;
  embedded?: boolean;
  onSaved?: () => void;
};

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

const VendorDashboard = ({ forcedSection = null, embedded = false, onSaved }: VendorDashboardProps) => {
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
  const [focusedSection, setFocusedSection] = useState<string | null>(null);

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

  const [touched, setTouched] = useState({
    businessName: false,
    promoValue: false,
    products: false,
  });

  const requestedSection = forcedSection ?? searchParams.get("section");
  const activeDashboardSection: DashboardSection | null =
    requestedSection && DASHBOARD_SECTIONS.includes(requestedSection as DashboardSection)
      ? (requestedSection as DashboardSection)
      : null;

  const eventsOnlyMode = embedded && activeDashboardSection === "events";

  const showSection = (section: DashboardSection) => {
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
        .select("*")
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
      } else {
        setForm(emptyForm);
        setTeamInput("");
      }

      setFetchingVendor(false);
    };

    if (!authLoading) {
      void fetchByOwner();
    }
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (embedded) return;
    if (authLoading || fetchingVendor) return;

    const section = activeDashboardSection;
    if (!section) return;

    const target = document.getElementById(`portal-section-${section}`);
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
          .from("dancers")
          .select("id, first_name, surname, city")
          .or(`first_name.ilike.%${safeQuery}%,surname.ilike.%${safeQuery}%`)
          .limit(8);

        if (error) throw error;

        const mapped: TeamMemberOption[] = (data || []).map((row: any) => {
          const displayName = `${row.first_name || ""} ${row.surname || ""}`.trim() || "Unnamed dancer";
          return {
            id: row.id,
            displayName,
            city: row.city || null,
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
    };

    const nextTeam = [...currentTeam, newEntry];
    setTeamInput(JSON.stringify(nextTeam, null, 2));
    toast({ title: "Team member added" });
  };

  const removeTeamMember = (dancerId: number) => {
    let currentTeam: any[] = [];
    try {
      if (teamInput.trim()) {
        const parsed = JSON.parse(teamInput);
        if (Array.isArray(parsed)) currentTeam = parsed;
      }
    } catch {
      // ignore
    }
    const nextTeam = currentTeam.filter((t: any) => t.dancer_id !== dancerId);
    setTeamInput(JSON.stringify(nextTeam, null, 2));
  };

  const embeddedCardClass = embedded
    ? "dashboard-card border-festival-teal/35 bg-background/70 backdrop-blur-sm"
    : "";

  const sectionCardClass = (section: string) =>
    cn(
      embeddedCardClass,
      focusedSection === section ? "ring-2 ring-primary ring-offset-2 transition" : ""
    );

  const isEditMode = Boolean(form.id);

  const promoValueParsed = toNullableNumber(form.promo_discount_value);
  const hasPromoValueError =
    form.promo_discount_value.trim().length > 0 && promoValueParsed === null;
  const hasBusinessNameError = form.business_name.trim().length === 0;
  const hasInvalidProducts = form.products.some((item) => item.name.trim().length === 0);
  const isSaveDisabled =
    savePending ||
    uploadPending ||
    hasBusinessNameError ||
    hasPromoValueError ||
    hasInvalidProducts;

  const showBusinessNameError = touched.businessName && hasBusinessNameError;
  const showPromoValueError = touched.promoValue && hasPromoValueError;
  const showProductErrors = touched.products && hasInvalidProducts;

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

  const addUpcomingEventId = (eventId: string) => {
    const value = eventId.trim();
    if (!value) return;
    setForm((prev) => ({
      ...prev,
      upcoming_events: Array.from(new Set([...prev.upcoming_events, value])),
    }));
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

  const quickAddEvents = useMemo(() => {
    return addableEventSuggestions.slice(0, 3);
  }, [addableEventSuggestions]);

  const removeCategory = (value: string) => {
    setForm((prev) => ({
      ...prev,
      product_categories: prev.product_categories.filter((item) => item !== value),
    }));
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
        toast({ title: "Events updated" });
        onSaved?.();
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
      promoValue: true,
      products: true,
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
        city: canonicalCity.cityName,
        photo_url: photoUrl.length > 0 ? photoUrl : null,
        product_categories: categories.length > 0 ? categories : null,
        products: normalizedProductsJson,
        ships_international: form.ships_international,
        promo_code: form.promo_code.trim() || null,
        promo_discount_type: form.promo_code.trim() ? form.promo_discount_type.trim() || null : null,
        promo_discount_value: form.promo_code.trim() ? promoValue : null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        website: form.website.trim() || null,
        instagram: form.instagram.trim() || null,
        facebook: form.facebook.trim() || null,
        faq: form.faq.trim() || null,
        upcoming_events: upcomingEvents.length > 0 ? upcomingEvents : null,
        meta_data: form.meta_data,
        team: parsedTeam,
      };

      if (isEditMode && form.id) {
        const { data, error: updateError } = await supabase
          .from("vendors")
          .update(payload)
          .eq("id", form.id)
          .eq("user_id", user.id)
          .select("*")
          .single();

        if (updateError) {
          if (isRlsError(updateError)) {
            setNotAuthorized(true);
            return;
          }
          throw updateError;
        }

        setForm(toFormState(data as VendorRow));
        setTeamInput(data?.team ? JSON.stringify(data.team, null, 2) : "");
        setPrimaryFile(null);
        toast({ title: "Vendor profile updated" });
        onSaved?.();
      } else {
        const { data, error: insertError } = await supabase
          .from("vendors")
          .insert({ ...payload, user_id: user.id })
          .select("*")
          .single();

        if (insertError) {
          if (isRlsError(insertError)) {
            setNotAuthorized(true);
            return;
          }
          throw insertError;
        }

        setForm(toFormState(data as VendorRow));
        setTeamInput(data?.team ? JSON.stringify(data.team, null, 2) : "");
        setPrimaryFile(null);
        toast({ title: "Vendor profile created" });
        onSaved?.();
      }
    } catch (saveError: any) {
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
            <h1 className="text-3xl font-bold">Vendor Dashboard</h1>
            <p className="text-muted-foreground">
              {activeDashboardSection
                ? `Editing section: ${activeDashboardSection}`
                : isEditMode
                  ? "Edit your vendor profile."
                  : "Create your vendor profile."}
            </p>
          </div>
        )}

        {error && (
          <Card className={embeddedCardClass}>
            <CardContent className="pt-6 text-destructive">{error}</CardContent>
          </Card>
        )}

        {uploadPending && (
          <Card className={embeddedCardClass}>
            <CardContent className="pt-6 space-y-2">
              <p className="text-sm text-muted-foreground">Uploading media...</p>
              <Progress value={uploadProgress} />
              <p className="text-xs text-muted-foreground">{uploadProgress}% complete</p>
            </CardContent>
          </Card>
        )}

        {isEditMode && !embedded && (
          <Card className="bg-gradient-to-br from-primary/10 via-primary/5 to-background border-primary/20 shadow-sm">
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
                      className="pr-10 bg-background/80"
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
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
        <Card id="portal-section-profile" className={sectionCardClass("profile")}>
          <CardHeader><CardTitle>1) Profile basics</CardTitle></CardHeader>
          <CardContent className="space-y-4">
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
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <Label>City</Label>
                <CityPicker
                  value={form.city}
                  onChange={(city) => setForm((prev) => ({ ...prev, city }))}
                  placeholder="Select city..."
                />
              </div>
              <div>
                <Label>Country</Label>
                <Input value={form.country} onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))} />
                <p className="text-xs text-muted-foreground mt-1">Display-only for now (not saved to database).</p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Team members are managed in section 10) Team. Individual representative/first/surname fields were removed.
            </p>
          </CardContent>
        </Card>
        )}

        {showSection("media") && (
        <Card id="portal-section-media" className={sectionCardClass("media")}>
          <CardHeader><CardTitle>2) Media</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label>Primary image</Label>
              <div className="mt-2 flex flex-wrap gap-3 items-center">
                {form.photo_url[0] && (
                  <div className="relative h-24 w-24 rounded-md overflow-hidden border">
                    <img src={form.photo_url[0]} alt="Primary" className="h-full w-full object-cover" />
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
                  Upload primary
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

            <div>
              <Label>Product images</Label>
              <p className="text-xs text-muted-foreground mt-2">
                Individual product images are managed inside each product entry.
              </p>
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("products") && (
        <Card id="portal-section-products" className={sectionCardClass("products")}>
          <CardHeader><CardTitle>3) Products (JSONB)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Product records are stored as JSON with keys: name, price, variants, image_url, description.
            </p>
            {form.products.map((product, index) => (
              <div key={index} className="border rounded-lg p-4 space-y-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  <Input
                    placeholder="Name"
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
                <Input
                  placeholder="Image URL"
                  value={product.image_url || ""}
                  onChange={(e) => updateProduct(index, { image_url: e.target.value })}
                />
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
                <Button type="button" variant="ghost" onClick={() => removeProduct(index)}>
                  <Trash2 className="h-4 w-4 mr-1" />
                  Remove product
                </Button>
              </div>
            ))}
            <Button type="button" variant="outline" onClick={addProduct}>
              <Plus className="h-4 w-4 mr-1" />
              Add product
            </Button>
          </CardContent>
        </Card>
        )}

        {showSection("categories") && (
        <Card id="portal-section-categories" className={sectionCardClass("categories")}>
          <CardHeader><CardTitle>4) Categories + shipping</CardTitle></CardHeader>
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
              <Button type="button" onClick={addCategory}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {form.product_categories.map((item) => (
                <Badge key={item} variant="secondary" className="gap-2">
                  {item}
                  <button type="button" onClick={() => removeCategory(item)}>×</button>
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

        {showSection("promo") && (
        <Card id="portal-section-promo" className={sectionCardClass("promo")}>
          <CardHeader><CardTitle>5) Promo</CardTitle></CardHeader>
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
                onChange={(e) => setForm((prev) => ({ ...prev, promo_discount_type: e.target.value }))}
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
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("events") && (
        <Card id="portal-section-events" className={sectionCardClass("events")}>
          <CardHeader><CardTitle>Upcoming events</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">Select from your live calendar feed and add multiple events in one click.</p>

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
                    <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => removeUpcomingEvent(event.id)}>
                      Remove
                    </Button>
                  </div>
                ))}
                {selectedEventItems.length === 0 && (
                  <p className="text-xs text-muted-foreground">No events selected yet.</p>
                )}
              </div>
            </div>

            {quickAddEvents.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Quick add</p>
                <div className="flex flex-wrap gap-2">
                  {quickAddEvents.map((event) => (
                    <Button
                      key={`quick-${event.id}`}
                      type="button"
                      size="sm"
                      className="h-7 text-[11px]"
                      variant="outline"
                      onClick={() => {
                        addUpcomingEventId(event.id);
                        toast({ title: "Event added" });
                      }}
                    >
                      {event.name}
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <Input
              placeholder="Search events by name"
              value={eventSearchInput}
              onChange={(e) => setEventSearchInput(e.target.value)}
            />

            <div className="space-y-2 rounded-md border border-festival-teal/25 p-2.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-muted-foreground">Calendar events</p>
                <Button type="button" size="sm" className="h-7 text-[11px]" disabled={pendingEventIds.length === 0} onClick={addPendingEvents}>
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
                    <div key={event.id} className="flex items-center justify-between gap-3 rounded-md border border-border/50 p-2">
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
                      <Button type="button" size="sm" className="h-7 text-[11px]" variant="outline" onClick={() => {
                        addUpcomingEventId(event.id);
                        toast({ title: "Event added" });
                      }}>
                        Add
                      </Button>
                    </div>
                  );
                })
              )}
            </div>

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
                <Button type="button" onClick={addUpcomingEvent}>Add</Button>
              </div>
            </details>

            {eventsOnlyMode && (
              <div className="sticky bottom-0 z-20 border border-festival-teal/35 bg-background/95 backdrop-blur-sm rounded-lg p-2.5 flex items-center justify-between gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 text-[12px]"
                  disabled={pendingEventIds.length === 0}
                  onClick={addPendingEvents}
                >
                  Add selected{pendingEventIds.length ? ` (${pendingEventIds.length})` : ""}
                </Button>
                <Button
                  type="button"
                  className="h-8 text-[12px]"
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
        <Card id="portal-section-contact" className={sectionCardClass("contact")}>
          <CardHeader><CardTitle>6) Contact (Portal only)</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Email</Label>
              <Input value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>
            <div>
              <Label>WhatsApp</Label>
              <Input value={form.whatsapp} onChange={(e) => setForm((prev) => ({ ...prev, whatsapp: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("social") && (
        <Card id="portal-section-social" className={sectionCardClass("social")}>
          <CardHeader><CardTitle>7) Social</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Website</Label>
              <Input value={form.website} onChange={(e) => setForm((prev) => ({ ...prev, website: e.target.value }))} />
            </div>
            <div>
              <Label>Instagram</Label>
              <Input value={form.instagram} onChange={(e) => setForm((prev) => ({ ...prev, instagram: e.target.value }))} />
            </div>
            <div>
              <Label>Facebook</Label>
              <Input value={form.facebook} onChange={(e) => setForm((prev) => ({ ...prev, facebook: e.target.value }))} />
            </div>
          </CardContent>
        </Card>
        )}

        {showSection("faq") && (
        <Card id="portal-section-faq" className={sectionCardClass("faq")}>
          <CardHeader><CardTitle>FAQ</CardTitle></CardHeader>
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
        <Card id="portal-section-team" className={sectionCardClass("team")}>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Team</CardTitle>
            <Button type="button" variant="outline" size="sm" onClick={() => navigate('/dancers')}>
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
                        <div className="text-sm font-medium">{member.name}</div>
                        {member.city && <div className="text-xs text-muted-foreground">{member.city}</div>}
                      </div>
                    </div>
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
                ))}
              </div>
            </div>

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
          </CardContent>
        </Card>
        )}

        {showSection("save") && (
        <Card id="portal-section-save" className={sectionCardClass("save")}>
          <CardHeader><CardTitle>8) Save</CardTitle></CardHeader>
          <CardContent>
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
        <Card id="portal-section-advanced" className={sectionCardClass("advanced")}>
          <CardHeader><CardTitle>9) Advanced</CardTitle></CardHeader>
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

        {!embedded && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs text-muted-foreground">
                Internal privacy rule: contact fields are shown only in this vendor editor, never in public vendor pages.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default VendorDashboard;
