import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, CalendarDays, CircleHelp, Flame, Loader2, MapPin, Plus, Search, Trash2, Upload, Copy, ExternalLink, Share2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { PostgrestError } from "@supabase/supabase-js";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { uploadToR2 } from "@/lib/uploadToR2";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { captureException } from "@/lib/sentry";
import { validateImageFile } from "@/lib/upload-validation";
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
import { optimizedImageUrl } from '@/lib/imageCdn';
import { cn, resolveEventImage } from '@/lib/utils';
import { useCity } from '@/contexts/CityContext';
import { Checkbox } from '@/components/ui/checkbox';
import GlobalLayout from '@/components/layout/GlobalLayout';

import { buildBreadcrumbs } from '@/lib/breadcrumbs';
const VENDOR_DASHBOARD_BREADCRUMBS = buildBreadcrumbs('profile.vendorDashboard');

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
  meta_data: null,
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
  meta_data: vendor.meta_data,
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

type VendorDashboardProps = {
  forcedSection?: VendorDashboardSection | null;
  embedded?: boolean;
  profileFocus?: "name" | "location" | null;
  onSaved?: (payload?: VendorDashboardSavePayload) => void;
  onProgressChange?: (progress: VendorDashboardProgressMap) => void;
};

// Phase 5.5: "events" and "team" are no longer self-service-editable. Both
// move to admin-managed RPCs (admin_attach_vendor_to_event_v1 from Phase 3
// and admin_set_vendor_team_v1 from Phase 5).
const SECTION_SAVE_TARGETS: VendorDashboardSection[] = [
  "profile",
  "media",
  "categories",
  "products",
  "promo",
  "contact",
  "social",
  "faq",
  "save",
];

/**
 * What these handlers actually read off a thrown value. A catch binding is
 * `unknown`, and every site below touches only `message` / `details` -- so
 * narrow to that shape once rather than reaching for `any` four times.
 */
type ErrorLike = { message?: unknown; details?: unknown };

const asErrorLike = (error: unknown): ErrorLike =>
  error && typeof error === "object" ? (error as ErrorLike) : {};

const getFriendlyVendorSaveError = (error: unknown): string => {
  const message = String(asErrorLike(error).message || "");
  const schemaPattern = /Could not find the '([^']+)' column of 'vendors'/i;
  const schemaMatch = message.match(schemaPattern);

  if (schemaMatch) {
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
  const [categoryInput, setCategoryInput] = useState("");
  const [draftHydrated, setDraftHydrated] = useState(false);
  const [localDraftSavedAt, setLocalDraftSavedAt] = useState<string | null>(null);

  // Phase 5.5: getCurrentLeaderId / updateLeaderMeta / setTeamLeader all
  // retired — leader assignment goes through admin_set_vendor_team_v1
  // (which raises 'vendor_requires_leader' if the resulting team has no
  // active Leader). meta_data.business_leader_dancer_id is now a
  // legacy-only marker and no longer written by the self-service portal.

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
      toast({ title: "Draft cleared", description: "Saved profile data is still loaded." });
      return;
    }

    setForm(emptyForm);
    setCategoryInput("");
    setPrimaryFile(null);
    toast({ title: "Draft cleared" });
  };

  const showSection = (section: VendorDashboardSection) => {
    if (isEmbeddedFocusedSectionMode) return activeDashboardSection === section;
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

      // Phase 5.5: teamInput / upcomingEventsInput / eventSearchInput drafts
      // ignored — those flows moved to admin RPCs. Keep the stash key shape
      // backward-compatible (older payloads still parse, just ignored).
      const hasRestoredDraft = Boolean(
        parsed.form || typeof parsed.categoryInput === "string"
      );

      if (parsed.form) setForm(parsed.form);
      if (typeof parsed.categoryInput === "string") setCategoryInput(parsed.categoryInput);
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
        categoryInput,
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
    expertMode,
    fetchingVendor,
    form,
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

  // Phase 5.5: loadEventSuggestions, team-search effect, addTeamMember,
  // removeTeamMember helpers all retired. Their data flows now go through
  // admin RPCs (admin_attach_vendor_to_event_v1, admin_set_vendor_team_v1)
  // and the canonical relations (event_vendor_booths, vendor_team_members).

  const embeddedCardClass = embedded
    ? "dashboard-card border-festival-teal/35 bg-background/70 backdrop-blur-sm shadow-md ring-1 ring-festival-teal/15"
    : "";

  // Phase 5.5: events / team accent tones no longer needed (sections retired).
  const sectionAccentTone: Record<VendorDashboardSection, string> = {
    profile: "border-l-2 border-l-cyan-400/70",
    media: "border-l-2 border-l-sky-400/70",
    categories: "border-l-2 border-l-indigo-400/70",
    products: "border-l-2 border-l-emerald-400/70",
    promo: "border-l-2 border-l-amber-400/70",
    contact: "border-l-2 border-l-teal-400/70",
    social: "border-l-2 border-l-violet-400/70",
    faq: "border-l-2 border-l-fuchsia-400/70",
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

  // Phase 5.5: upcoming_events helpers retired.

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
    } catch (uploadError) {
      const message = String(asErrorLike(uploadError).message || "Could not upload product image.");
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

    const formatUploadErrorMessage = (error: unknown) => {
      const e = asErrorLike(error);
      const text = `${String(e.message || "")} ${String(e.details || "")}`.toLowerCase();
      if (text.includes("bucket") || text.includes("not found")) {
        return "Upload failed: storage bucket 'images' is missing. Create it and allow authenticated uploads.";
      }
      if (text.includes("row-level security") || text.includes("permission") || text.includes("not authorized")) {
        return "Upload blocked by storage permissions. Check RLS policy for bucket 'images' for authenticated users.";
      }
      return String(e.message || "Upload failed. Please try again.");
    };

    for (let index = 0; index < files.length; index += 1) {
      const file = files[index];
      const extension = file.name.split(".").pop() || "jpg";
      const path = `vendors/${user.id}/${Date.now()}-${index}.${extension}`;

      let publicUrl: string;
      try {
        publicUrl = await uploadToR2(file, "images", path);
      } catch (uploadError) {
        setUploadPending(false);
        setUploadProgress(0);
        throw new Error(formatUploadErrorMessage(uploadError));
      }

      uploaded.push(publicUrl);
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

  // Phase 5.5: parsedTeamDisplay + currentLeaderDancerId no longer derived
  // here — admin team RPCs are the canonical source. The "events" and "team"
  // section progress entries are also gone (those sections were retired).
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

    return {
      profile: { complete: form.business_name.trim().length > 0 && hasCity },
      media: { complete: hasPrimaryImage },
      categories: { complete: form.product_categories.length > 0 },
      products: { complete: productsComplete },
      promo: { complete: promoComplete },
      contact: { complete: hasAnyContact },
      social: { complete: hasAnySocial },
      faq: { complete: form.faq.trim().length > 0 },
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
    form.website,
    form.whatsapp,
    hasInvalidProducts,
    primaryFile,
  ]);

  useEffect(() => {
    onProgressChange?.(sectionProgress);
  }, [onProgressChange, sectionProgress]);

  const saveVendor = async () => {
    if (!user?.id) return;

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

      // Phase 5.5: vendors.team and vendors.upcoming_events are dropped.
      // Team membership flows through admin_set_vendor_team_v1 (Phase 5);
      // event linking through admin_attach_vendor_to_event_v1 (Phase 3).
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
        meta_data: form.meta_data,
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
    } catch (saveError) {
      // isRlsError takes a PostgrestError; a catch binding is `unknown`, and the
      // helper already guards its own null/shape access.
      if (isRlsError(saveError as PostgrestError | null)) {
        setNotAuthorized(true);
        return;
      }
      const friendlyMessage = getFriendlyVendorSaveError(saveError);
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
    const loadingContent = (
      <div className={embedded ? "py-8 flex items-center justify-center gap-2 text-muted-foreground" : "px-4 pb-24 flex items-center justify-center gap-2 text-muted-foreground min-h-[40vh]"}>
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading vendor dashboard...</span>
      </div>
    );
    return embedded ? loadingContent : (
      <GlobalLayout breadcrumbs={VENDOR_DASHBOARD_BREADCRUMBS} backHref="/profile?role=vendor">
        {loadingContent}
      </GlobalLayout>
    );
  }

  if (notAuthorized) {
    const notAuthorizedContent = (
      <div className={embedded ? "" : "px-4 pb-24"}>
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
    return embedded ? notAuthorizedContent : (
      <GlobalLayout breadcrumbs={VENDOR_DASHBOARD_BREADCRUMBS} backHref="/profile?role=vendor">
        {notAuthorizedContent}
      </GlobalLayout>
    );
  }

  const mainContent = (
    <div className={embedded ? "" : "px-4 pb-24"}>
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
                    <img src={optimizedImageUrl(form.photo_url[0], 320)} alt="Business logo" loading="lazy" className="h-full w-full object-cover" />
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
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (!f) return;
                      const check = validateImageFile(f);
                      if (!check.ok) { toast({ title: check.message, variant: 'destructive' }); return; }
                      setPrimaryFile(f);
                    }}
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
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const check = validateImageFile(file);
                        if (!check.ok) { toast({ title: check.message, variant: 'destructive' }); e.currentTarget.value = ""; return; }
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

        {/* Phase 5.5: events section retired — admins link vendors to events
            via the admin event editor (admin_attach_vendor_to_event_v1). */}

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

        {/* Phase 5.5: team section retired — admins manage vendor team
            membership via the admin VendorTeamTab (admin_set_vendor_team_v1).
            The Phase 5 invariant requires every active vendor to have ≥1
            Leader; the admin tab enforces this with toast + UI guard. */}

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

  return embedded ? mainContent : (
    <GlobalLayout breadcrumbs={VENDOR_DASHBOARD_BREADCRUMBS} backHref="/profile?role=vendor">
      {mainContent}
    </GlobalLayout>
  );
};

export default VendorDashboard;
