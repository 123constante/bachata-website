import { useEffect, useMemo, useState } from "react";
import { CalendarDays, Flame, Loader2, MapPin, Plus, Search, Trash2, Upload, X, Copy, ExternalLink, Share2, Check } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Json } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { captureException } from "@/lib/sentry";
import { validateImageFile } from "@/lib/upload-validation";
import type { VendorDashboardFormState, VendorProduct, VendorRow, VendorRowWithCity, VendorPromoDiscountType } from "@/modules/vendor/types";
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
  public_email: "",
  phone: "",
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
  country: (vendor as any).country || "",
  photo_url: normalizeStringArray(vendor.photo_url),
  products: normalizeProducts(vendor.products),
  product_categories: normalizeStringArray(vendor.product_categories),
  ships_international: Boolean(vendor.ships_international),
  promo_code: vendor.promo_code || "",
  promo_discount_type: vendor.promo_discount_type || "percent",
  promo_discount_value:
    typeof vendor.promo_discount_value === "number" ? String(vendor.promo_discount_value) : "",
  public_email: vendor.public_email || "",
  phone: (vendor as any).phone || "",
  whatsapp: vendor.whatsapp || "",
  website: vendor.website || "",
  instagram: vendor.instagram || "",
  facebook: vendor.facebook || "",
  faq: vendor.faq || "",
  meta_data: vendor.meta_data,
});

// Phase 5.5 retired the "events" and "team" sections from the self-service
// portal. Both surfaces are now admin-managed via Phase 3 booth RPCs and the
// Phase 5 vendor_team_members RPCs respectively.
const DASHBOARD_SECTIONS = [
  "profile",
  "media",
  "products",
  "categories",
  "promo",
  "contact",
  "social",
  "faq",
  "save",
  "advanced",
] as const;

type DashboardSection = (typeof DASHBOARD_SECTIONS)[number];

type VendorDashboardProps = {
  forcedSection?: DashboardSection | null;
  embedded?: boolean;
  onSaved?: () => void;
};

const getFriendlyVendorSaveError = (error: any): string => {
  const message = String(error?.message || "");
  const schemaPattern = /Could not find the '([^']+)' column of 'vendors'/i;
  const schemaMatch = message.match(schemaPattern);

  if (schemaMatch) {
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
  const [categoryInput, setCategoryInput] = useState("");

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

  const showSection = (section: DashboardSection) => {
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
      } else {
        setForm(emptyForm);
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

  // Phase 5.5 retired in-portal event linking and team editing. Both flows
  // are now admin-managed via Phase 3 booth RPCs and the Phase 5
  // vendor_team_members RPCs respectively. The "events" and "team" sections
  // were removed from DASHBOARD_SECTIONS so the navigation never lands here.

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

  // Phase 5.5: upcoming_events helpers retired; admin attaches vendors to
  // events via admin_attach_vendor_to_event_v1 (Phase 3).

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

  const saveVendor = async () => {
    if (!user?.id) return;

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

      // Phase 5.5: vendors.team and vendors.upcoming_events were dropped.
      // Team membership is admin-managed via admin_set_vendor_team_v1
      // (Phase 5); event linking via admin_attach_vendor_to_event_v1
      // (Phase 3). Both keys must NOT appear in this payload.
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
        phone: form.phone.trim() || null,
        whatsapp: form.whatsapp.trim() || null,
        website: form.website.trim() || null,
        instagram: form.instagram.trim() || null,
        facebook: form.facebook.trim() || null,
        faq: form.faq.trim() || null,
        meta_data: form.meta_data,
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
        setPrimaryFile(null);
        toast({ title: "Vendor profile created" });
        onSaved?.();
      }
    } catch (saveError: any) {
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
            </div>
          </CardContent>
        </Card>
        )}

        {/* Phase 5.5: events section retired — admins link vendors to events
            via the admin event editor (admin_attach_vendor_to_event_v1). */}

        {showSection("contact") && (
        <Card id="portal-section-contact" className={sectionCardClass("contact")}>
          <CardHeader><CardTitle>6) Contact (Portal only)</CardTitle></CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-3">
            <div>
              <Label>Public contact email</Label>
              <Input value={form.public_email} onChange={(e) => setForm((prev) => ({ ...prev, public_email: e.target.value }))} />
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

        {/* Phase 5.5: team section retired — admins manage vendor team
            membership via the admin VendorTeamTab (admin_set_vendor_team_v1).
            The Phase 5 invariant requires every active vendor to have ≥1
            Leader; the admin tab enforces this with toast + UI guard. */}

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
