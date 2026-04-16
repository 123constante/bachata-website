import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { CircleHelp, Upload } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { validateImageFile } from "@/lib/upload-validation";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { AuthStepper } from "@/components/auth/AuthStepper";
import { AuthFormProvider } from "@/contexts/AuthFormContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { triggerMicroConfetti } from "@/lib/confetti";
import { hasRequiredCity, normalizeRequiredCity } from '@/lib/profile-validation';
import { resolveCanonicalCity } from '@/lib/city-canonical';
import { ensureDancerProfile } from "@/lib/ensureDancerProfile";
import { normalizeProducts, normalizeSocialUrl } from "@/modules/vendor/utils";

const STEP_INVITE = 0;
const STEP_IDENTITY = 1;
const STEP_SHOWCASE = 2;
const STEP_PRESENCE = 3;
const STEP_ACCESS = 4;
const STAGE_LABELS = ["Foundations", "Catalog", "Products", "Visibility & Offers", "Trust & Publish"] as const;
const STAGE_HELP_COPY = [
  "Set your core identity and team link first.",
  "Choose categories so customers can discover you.",
  "Build a complete catalog with strong product cards.",
  "Add events and promo hooks to increase traffic.",
  "Finalize trust signals and pass strict publish checks.",
] as const;
const PRIMARY_CTA_CLASS = "bg-gradient-to-r from-festival-teal to-cyan-400 text-black font-semibold hover:opacity-95 transition-all duration-200 active:scale-[0.98]";

type VendorProduct = {
  id: string;
  name: string;
  price: string;
  variants: string[];
  imageUrl: string;
};

type VendorDraft = {
  businessName: string;
  logoUrl: string;
  city: string;
  productCategories: string[];
  products: VendorProduct[];
  upcomingEvents: string[];
  promoCode: string;
  promoDiscountType: "percent" | "fixed";
  promoDiscountValue: string;
  faq: string;
  shipsInternational: boolean;
  website: string;
  instagram: string;
  facebook: string;
  whatsapp: string;
  email: string;
};

type TeamMemberOption = {
  id: string;
  displayName: string;
  city: string | null;
  cityId?: string | null;
};

const defaultDraft: VendorDraft = {
  businessName: "",
  logoUrl: "",
  city: "",
  productCategories: [],
  products: [],
  upcomingEvents: [],
  promoCode: "",
  promoDiscountType: "percent",
  promoDiscountValue: "",
  faq: "",
  shipsInternational: false,
  website: "",
  instagram: "",
  facebook: "",
  whatsapp: "",
  email: "",
};

const CreateVendorProfile = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { toast } = useToast();
  const returnTo = `${location.pathname}${location.search}`;
  const [step, setStep] = useState(STEP_INVITE);
  const [pendingSubmit, setPendingSubmit] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [draft, setDraft] = useState<VendorDraft>(defaultDraft);
  const [pendingLogoFile, setPendingLogoFile] = useState<File | null>(null);
  const [pendingProductFiles, setPendingProductFiles] = useState<Record<string, File | null>>({});
  const [hasTriggeredConfetti, setHasTriggeredConfetti] = useState(false);
  const [showShowcaseErrors, setShowShowcaseErrors] = useState(false);
  const [faqMode, setFaqMode] = useState<"builder" | "markdown">("builder");
  const [faqItems, setFaqItems] = useState<Array<{ id: string; question: string; answer: string }>>([]);
  const [hasLoadedExisting, setHasLoadedExisting] = useState(false);
  const categoryOptions = useMemo(() => [
    "Dance shoes",
    "Dancewear",
    "Accessories",
    "Merchandise",
    "Gifts",
    "Training tools",
    "Wellness",
  ], []);
  const [variantInputs, setVariantInputs] = useState<Record<string, string>>({});
  const [eventOptions, setEventOptions] = useState<Array<{ id: string; name: string; date: string | null }>>([]);
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [teamSearch, setTeamSearch] = useState("");
  const [teamResults, setTeamResults] = useState<TeamMemberOption[]>([]);
  const [isSearchingTeam, setIsSearchingTeam] = useState(false);
  const [teamSearchError, setTeamSearchError] = useState<string | null>(null);
  const [selectedTeamMembers, setSelectedTeamMembers] = useState<TeamMemberOption[]>([]);
  const [leaderDancerId, setLeaderDancerId] = useState<string>("");
  const faqPresets = [
    "What sizes do you carry?",
    "Do you ship internationally?",
    "What is your return policy?",
    "Can I pick up at an event?",
    "How do I use the promo code?",
  ];

  useEffect(() => {
    const loadEvents = async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, name, date")
        .order("date", { ascending: true });

      if (error) {
        console.error("Failed to load events:", error);
        return;
      }

      setEventOptions((data || []).map((event: any) => ({
        id: event.id,
        name: event.name,
        date: event.date || null,
      })));
    };

    loadEvents();
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('vendors')
        .select('id, business_name, city, city_id, cities(name), photo_url, product_categories, products, upcoming_events, promo_code, promo_discount_type, promo_discount_value, faq, ships_international, website, instagram, facebook, whatsapp, public_email')
        .eq('user_id', user.id)
        .maybeSingle();

      if (cancelled || error || !data?.id) return;

      if (!hasLoadedExisting) {
        const normalizedProducts = normalizeProducts(data.products).map((product) => ({
          id: product.id || (typeof crypto !== "undefined" && "randomUUID" in crypto
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random().toString(36).slice(2)}`),
          name: product.name,
          price: product.price != null ? String(product.price) : "",
          variants: product.variants || [],
          imageUrl: product.image_url || "",
        }));

        setDraft({
          ...defaultDraft,
          businessName: data.business_name || "",
          logoUrl: Array.isArray(data.photo_url) ? (data.photo_url[0] || "") : "",
          city: data.cities?.name || data.city || "",
          productCategories: Array.isArray(data.product_categories) ? data.product_categories : [],
          products: normalizedProducts,
          upcomingEvents: Array.isArray(data.upcoming_events) ? data.upcoming_events : [],
          promoCode: data.promo_code || "",
          promoDiscountType: data.promo_discount_type === "fixed" ? "fixed" : "percent",
          promoDiscountValue: data.promo_discount_value != null ? String(data.promo_discount_value) : "",
          faq: data.faq || "",
          shipsInternational: Boolean(data.ships_international),
          website: data.website || "",
          instagram: data.instagram || "",
          facebook: data.facebook || "",
          whatsapp: data.whatsapp || "",
          email: data.public_email || "",
        });

        if (data.faq) {
          setFaqMode("markdown");
        }

        setHasLoadedExisting(true);
      }

      toast({
        title: "Profile loaded",
        description: "You can continue editing your vendor profile here.",
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [hasLoadedExisting, toast, user?.id]);

  useEffect(() => {
    const accountEmail = user?.email?.trim();
    if (!accountEmail) return;

    setDraft((prev) => {
      if (prev.email.trim().length > 0) return prev;
      return { ...prev, email: accountEmail };
    });
  }, [user?.email]);

  useEffect(() => {
    if (!user?.id) return;

    let cancelled = false;

    const ensureOwnerDancerAsLeader = async () => {
      const metadata = (user.user_metadata || {}) as Record<string, unknown>;
      const metadataFirstName = typeof metadata.first_name === "string" ? metadata.first_name : null;
      const metadataSurname = typeof metadata.surname === "string" ? metadata.surname : null;
      const metadataCity = typeof metadata.city === "string" ? metadata.city : null;

      await ensureDancerProfile({
        userId: user.id,
        email: user.email || null,
        firstName: metadataFirstName,
        surname: metadataSurname,
        city: metadataCity,
      });

      const { data: ownDancer } = await supabase
        .from("dancer_profiles")
        .select("id, first_name, surname, based_city_id")
        .eq("created_by", user.id)
        .maybeSingle();

      if (cancelled || !ownDancer?.id) return;

      const ownDisplayName = `${ownDancer.first_name || ""} ${ownDancer.surname || ""}`.trim() || "Business owner";
      const ownMember: TeamMemberOption = {
        id: ownDancer.id,
        displayName: ownDisplayName,
        city: null,
        cityId: ownDancer.based_city_id || null,
      };

      setSelectedTeamMembers((prev) => {
        if (prev.some((item) => item.id === ownMember.id)) return prev;
        return [ownMember, ...prev];
      });

      setLeaderDancerId((prev) => prev || ownDancer.id);
    };

    void ensureOwnerDancerAsLeader();

    return () => {
      cancelled = true;
    };
  }, [user?.email, user?.id, user?.user_metadata]);

  useEffect(() => {
    if (!leaderDancerId) {
      if (selectedTeamMembers.length > 0) {
        setLeaderDancerId(selectedTeamMembers[0].id);
      }
      return;
    }
    const stillExists = selectedTeamMembers.some((member) => member.id === leaderDancerId);
    if (!stillExists) {
      setLeaderDancerId(selectedTeamMembers[0]?.id || "");
    }
  }, [leaderDancerId, selectedTeamMembers]);

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

        const mapped = (data || []).map((row: any) => {
          const displayName = `${row.first_name || ""} ${row.surname || ""}`.trim() || "Unnamed dancer";
          return {
            id: row.id,
            displayName,
            city: null,
            cityId: null,
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

  const addExistingTeamMember = (member: TeamMemberOption) => {
    setSelectedTeamMembers((prev) => {
      if (prev.some((item) => item.id === member.id)) return prev;
      return [...prev, member];
    });
    setTeamSearch("");
    setTeamResults([]);
  };

  const removeTeamMember = (memberId: string) => {
    setSelectedTeamMembers((prev) => prev.filter((item) => item.id !== memberId));
  };

  const getVendorInitials = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) return "VN";
    const matches = trimmed.match(/[A-Za-z0-9]+/g) || [];
    const first = matches[0]?.[0] || "";
    const second = matches[1]?.[0] || "";
    const initials = `${first}${second}`.toUpperCase();
    return initials || "VN";
  };

  const formatEventDate = (value: string | null) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const createPreviewUrl = (currentUrl: string, file: File) => {
    if (currentUrl && currentUrl.startsWith("blob:")) {
      URL.revokeObjectURL(currentUrl);
    }
    return URL.createObjectURL(file);
  };

  const handleLocalLogoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    const check = validateImageFile(file);
    if (!check.ok) { toast({ title: check.message, variant: "destructive" }); return; }
    const previewUrl = createPreviewUrl(draft.logoUrl, file);
    setPendingLogoFile(file);
    setDraft((prev) => ({ ...prev, logoUrl: previewUrl }));
  };

  const handleLocalProductImageChange = (productId: string, event: React.ChangeEvent<HTMLInputElement>) => {
    if (!event.target.files?.length) return;
    const file = event.target.files[0];
    const check = validateImageFile(file);
    if (!check.ok) { toast({ title: check.message, variant: "destructive" }); return; }
    const currentUrl = draft.products.find((product) => product.id === productId)?.imageUrl || "";
    const previewUrl = createPreviewUrl(currentUrl, file);
    setPendingProductFiles((prev) => ({ ...prev, [productId]: file }));
    updateProductImage(productId, previewUrl);
  };

  const formatUploadErrorMessage = (error: any) => {
    const text = `${error?.message || ""} ${error?.details || ""}`.toLowerCase();
    if (text.includes("bucket") || text.includes("not found")) {
      return "Upload failed: images storage bucket is missing. Create bucket 'images' and allow vendor uploads.";
    }
    if (text.includes("row-level security") || text.includes("permission") || text.includes("not authorized")) {
      return "Upload blocked by storage permissions. Check RLS policies for bucket 'images' to allow authenticated vendor uploads.";
    }
    return error?.message || "Image upload failed. Please try again.";
  };

  const uploadVendorImage = async (file: File) => {
    if (!user?.id) {
      throw new Error("You must be logged in to upload images.");
    }
    const fileExt = file.name.split(".").pop();
    const fileName = `${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}.${fileExt}`;
    const filePath = `vendors/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from("images")
      .upload(filePath, file);

    if (uploadError) {
      throw new Error(formatUploadErrorMessage(uploadError));
    }

    const { data } = supabase.storage
      .from("images")
      .getPublicUrl(filePath);

    return data.publicUrl;
  };

  const submitForm = async () => {
    const businessName = draft.businessName.trim();
    if (!businessName) {
      toast({
        title: "Storefront name is required",
        variant: "destructive",
      });
      return;
    }

    if (draft.productCategories.length === 0) {
      setStep(STEP_IDENTITY);
      window.scrollTo(0, 0);
      toast({
        title: "Add at least one category",
        description: "Choose at least one product category before publishing.",
        variant: "destructive",
      });
      return;
    }

    if (draft.products.length === 0) {
      setShowShowcaseErrors(true);
      setStep(STEP_SHOWCASE);
      window.scrollTo(0, 0);
      toast({
        title: "Add at least one product",
        description: "Create at least one complete product card before publishing.",
        variant: "destructive",
      });
      return;
    }

    const hasIncompleteProducts = draft.products.some((product) => {
      const nameOk = Boolean(product.name.trim());
      const parsedPrice = Number(product.price);
      const priceOk = Number.isFinite(parsedPrice) && parsedPrice > 0;
      const variantsOk = product.variants.length > 0;
      const imageOk = Boolean(product.imageUrl.trim());
      return !(nameOk && priceOk && variantsOk && imageOk);
    });

    if (hasIncompleteProducts) {
      setShowShowcaseErrors(true);
      setStep(STEP_SHOWCASE);
      window.scrollTo(0, 0);
      toast({
        title: "Finish each product card",
        description: "Need: name + price + image + at least one option.",
        variant: "destructive",
      });
      return;
    }

    if (!draft.faq.trim()) {
      setStep(STEP_ACCESS);
      window.scrollTo(0, 0);
      toast({
        title: "FAQ is required",
        description: "Add FAQ content before publishing.",
        variant: "destructive",
      });
      return;
    }

    const hasContactMethod = Boolean(draft.email.trim() || draft.whatsapp.trim());
    if (!hasContactMethod) {
      setStep(STEP_ACCESS);
      window.scrollTo(0, 0);
      toast({
        title: "Add contact details",
        description: "Provide at least one contact method: email or WhatsApp.",
        variant: "destructive",
      });
      return;
    }

    const hasSocialOrWebsite = Boolean(
      draft.website.trim() || draft.instagram.trim() || draft.facebook.trim()
    );
    if (!hasSocialOrWebsite) {
      setStep(STEP_ACCESS);
      window.scrollTo(0, 0);
      toast({
        title: "Add social or website link",
        description: "Provide at least one of: website, Instagram, or Facebook.",
        variant: "destructive",
      });
      return;
    }

    const candidateCityIds = Array.from(new Set(
      selectedTeamMembers
        .map((member) => normalizeRequiredCity(member.cityId || ""))
        .filter((value) => hasRequiredCity(value))
    ));

    const candidateCities = Array.from(new Set(
      [
        normalizeRequiredCity(draft.city),
        ...selectedTeamMembers.map((member) => normalizeRequiredCity(member.city || "")),
      ].filter((value) => hasRequiredCity(value))
    ));

    let canonicalCity: Awaited<ReturnType<typeof resolveCanonicalCity>> = null;
    for (const candidateCityId of candidateCityIds) {
      canonicalCity = await resolveCanonicalCity(candidateCityId);
      if (canonicalCity) break;
    }

    for (const candidate of candidateCities) {
      if (canonicalCity) break;
      canonicalCity = await resolveCanonicalCity(candidate);
      if (canonicalCity) break;
    }

    if (!canonicalCity) {
      toast({
        title: "Could not determine city",
        description: "Add at least one team member with a valid city.",
        variant: "destructive",
      });
      return;
    }

    if (selectedTeamMembers.length === 0) {
      toast({
        title: "Add at least one team member",
        description: "Pick an existing dancer or add a new dancer before publishing.",
        variant: "destructive",
      });
      return;
    }

    if (!leaderDancerId) {
      toast({
        title: "Choose a business leader",
        description: "Select which team member is the business leader for this profile.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const leaderMember = selectedTeamMembers.find((member) => member.id === leaderDancerId) || null;
      const teamPayload = selectedTeamMembers.length
        ? selectedTeamMembers.map((member) => ({
          dancer_id: member.id,
          name: member.displayName,
          city: member.city || null,
          is_leader: member.id === leaderDancerId,
        }))
        : null;

      let resolvedLogoUrl = draft.logoUrl.trim();
      let resolvedProducts = [...draft.products];

      if (pendingLogoFile) {
        resolvedLogoUrl = await uploadVendorImage(pendingLogoFile);
        setPendingLogoFile(null);
        setDraft((prev) => ({ ...prev, logoUrl: resolvedLogoUrl }));
      }

      const pendingProductEntries = Object.entries(pendingProductFiles);
      if (pendingProductEntries.length > 0) {
        const uploadedMap: Record<string, string> = {};
        for (const [productId, file] of pendingProductEntries) {
          if (!file) continue;
          uploadedMap[productId] = await uploadVendorImage(file);
        }
        resolvedProducts = resolvedProducts.map((product) => (
          uploadedMap[product.id]
            ? { ...product, imageUrl: uploadedMap[product.id] }
            : product
        ));
        setPendingProductFiles({});
        setDraft((prev) => ({
          ...prev,
          products: prev.products.map((product) => (
            uploadedMap[product.id]
              ? { ...product, imageUrl: uploadedMap[product.id] }
              : product
          )),
        }));
      }

      const photoUrls = resolvedLogoUrl ? [resolvedLogoUrl] : null;
      const productCategories = draft.productCategories;
      const upcomingEventsPayload = draft.upcomingEvents;
      const productsPayload = resolvedProducts.length ? resolvedProducts.map((product) => ({
        id: product.id,
        name: product.name.trim(),
        price: product.price.trim(),
        variants: product.variants,
        image_url: product.imageUrl.trim() || null,
      })) : null;
      const promoValue = draft.promoDiscountValue.trim();
      const parsedPromoValue = promoValue ? Number(promoValue) : null;
      const promoDiscountValue = Number.isFinite(parsedPromoValue) ? parsedPromoValue : null;

      const payload = {
        business_name: businessName,
        photo_url: photoUrls,
        product_categories: productCategories.length ? productCategories : null,
        ships_international: draft.shipsInternational,
        upcoming_events: upcomingEventsPayload.length ? upcomingEventsPayload : null,
        products: productsPayload as any,
        promo_code: draft.promoCode.trim() || null,
        promo_discount_type: draft.promoCode.trim() ? draft.promoDiscountType : null,
        promo_discount_value: draft.promoCode.trim() ? promoDiscountValue : null,
        faq: draft.faq.trim() || null,
        website: normalizeSocialUrl('website', draft.website) || null,
        instagram: normalizeSocialUrl('instagram', draft.instagram) || null,
        facebook: normalizeSocialUrl('facebook', draft.facebook) || null,
        whatsapp: draft.whatsapp.trim() || null,
        public_email: draft.email.trim() || null,
        city_id: canonicalCity.cityId,
        meta_data: {
          business_leader_dancer_id: leaderDancerId,
          business_leader_name: leaderMember?.displayName || null,
        },
        team: teamPayload,
        user_id: user?.id || null,
      };

      // Strict payload check
      console.log("PAYLOAD_DEBUG:", {
        payloadKeys: Object.keys(payload),
        publicEmail: payload.public_email,
        emailPropertyInPayload: 'email' in payload,
      });

      let didUpdate = false;
      if (user?.id) {
        const { data: existing, error: existingError } = await supabase
          .from('vendors')
          .select('id, city_id, cities(name)')
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingError) throw existingError;

        if (existing?.id) {
          const { error: updateError } = await supabase
            .from('vendors')
            .update(payload as any)
            .eq('id', existing.id);

          if (updateError) throw updateError;
          didUpdate = true;
        }
      }

      if (!didUpdate) {
        const { error } = await supabase.from("vendors").insert(payload as any);
        if (error) throw error;
      }

      toast({
        title: didUpdate ? 'Vendor profile updated' : 'Vendor profile created',
        description: didUpdate ? 'Your latest details are saved.' : 'Welcome to your vendor tools.',
      });

      navigate("/profile");
    } catch (error: any) {
      toast({
        title: "Unable to create profile",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!user) {
      setPendingSubmit(true);
      setStep(STEP_ACCESS);
      toast({
        title: "Log in to publish",
        description: "Use the login panel below to publish your storefront.",
      });
      return;
    }

    await submitForm();
  };

  useEffect(() => {
    if (user && pendingSubmit) {
      setPendingSubmit(false);
      void submitForm();
    }
  }, [pendingSubmit, user]);

  const toggleCategory = (category: string) => {
    setDraft((prev) => {
      if (prev.productCategories.includes(category)) {
        return {
          ...prev,
          productCategories: prev.productCategories.filter((item) => item !== category),
        };
      }
      return {
        ...prev,
        productCategories: [...prev.productCategories, category],
      };
    });
  };

  const addUpcomingEvent = () => {
    if (!selectedEventId) return;
    setDraft((prev) => {
      if (prev.upcomingEvents.includes(selectedEventId)) return prev;
      return {
        ...prev,
        upcomingEvents: [...prev.upcomingEvents, selectedEventId],
      };
    });
    setSelectedEventId("");
  };

  const removeUpcomingEvent = (eventId: string) => {
    setDraft((prev) => ({
      ...prev,
      upcomingEvents: prev.upcomingEvents.filter((item) => item !== eventId),
    }));
  };

  const advanceToStep = (nextStep: number) => {
    setStep(nextStep);
    window.scrollTo(0, 0);
    triggerMicroConfetti(window.innerWidth / 2, 120);
  };

  const goBackToStep = (nextStep: number) => {
    setStep(nextStep);
    window.scrollTo(0, 0);
  };

  const addProduct = () => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDraft((prev) => ({
      ...prev,
      products: [...prev.products, { id, name: "", price: "", variants: [], imageUrl: "" }],
    }));
    if (!hasTriggeredConfetti) {
      triggerMicroConfetti(window.innerWidth / 2, window.innerHeight / 3);
      setHasTriggeredConfetti(true);
    }
  };

  const addSampleProduct = () => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setDraft((prev) => ({
      ...prev,
      products: [
        ...prev.products,
        {
          id,
          name: "Dance shoe",
          price: "89.00",
          variants: ["Black", "Size 38"],
          imageUrl: "",
        },
      ],
    }));
  };

  const addFaqItem = (question = "", answer = "") => {
    const id = typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    setFaqItems((prev) => [...prev, { id, question, answer }]);
  };

  const updateFaqItem = (id: string, patch: Partial<{ question: string; answer: string }>) => {
    setFaqItems((prev) => prev.map((item) => (
      item.id === id ? { ...item, ...patch } : item
    )));
  };

  const removeFaqItem = (id: string) => {
    setFaqItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addPresetQuestion = (question: string) => {
    const exists = faqItems.some((item) => item.question.trim() === question);
    if (exists) return;
    addFaqItem(question, "");
  };

  const generateFaqMarkdown = () => {
    const businessName = draft.businessName.trim() || "Our storefront";
    const city = draft.city.trim();
    const categories = draft.productCategories.join(", ");
    const shipsText = draft.shipsInternational ? "Yes, we ship internationally." : "We ship locally.";
    const promo = draft.promoCode.trim();
    const promoValue = draft.promoDiscountValue.trim();
    const promoType = draft.promoDiscountType === "fixed" ? "off" : "% off";
    const promoLine = promo
      ? `Promo code ${promo} gives ${promoValue || "a"}${promoValue ? promoType : " discount"}.`
      : "";

    const lines: string[] = [
      `## FAQ`,
      "",
      `### About ${businessName}`,
      city ? `${businessName} is based in ${city}.` : `${businessName} serves dancers worldwide.`,
      categories ? `Categories: ${categories}.` : "",
      shipsText,
      promoLine,
      "",
    ].filter(Boolean);

    faqItems.forEach((item) => {
      const question = item.question.trim();
      if (!question) return;
      const answer = item.answer.trim() || "Details coming soon.";
      lines.push(`### ${question}`);
      lines.push(answer);
      lines.push("");
    });

    const markdown = lines.join("\n").trim();
    setDraft((prev) => ({ ...prev, faq: markdown }));
    setFaqMode("markdown");
    toast({
      title: "FAQ generated",
      description: "You can edit the Markdown below before publishing.",
    });
  };

  const updateProduct = (id: string, patch: Partial<{ name: string; price: string; imageUrl: string }>) => {
    setDraft((prev) => ({
      ...prev,
      products: prev.products.map((product) => (
        product.id === id ? { ...product, ...patch } : product
      )),
    }));
  };

  const updateProductImage = (id: string, url: string) => {
    setDraft((prev) => ({
      ...prev,
      products: prev.products.map((product) => (
        product.id === id ? { ...product, imageUrl: url } : product
      )),
    }));
  };

  const addVariant = (productId: string) => {
    const value = variantInputs[productId]?.trim();
    if (!value) return;
    setDraft((prev) => ({
      ...prev,
      products: prev.products.map((product) => (
        product.id === productId
          ? { ...product, variants: [...product.variants, value] }
          : product
      )),
    }));
    setVariantInputs((prev) => ({ ...prev, [productId]: "" }));
  };

  const addCommonOptions = (productId: string, options: string[]) => {
    setDraft((prev) => ({
      ...prev,
      products: prev.products.map((product) => (
        product.id === productId
          ? {
            ...product,
            variants: Array.from(new Set([...product.variants, ...options])),
          }
          : product
      )),
    }));
  };

  const removeVariant = (productId: string, variant: string) => {
    setDraft((prev) => ({
      ...prev,
      products: prev.products.map((product) => (
        product.id === productId
          ? { ...product, variants: product.variants.filter((item) => item !== variant) }
          : product
      )),
    }));
  };

  const removeProduct = (productId: string) => {
    setDraft((prev) => ({
      ...prev,
      products: prev.products.filter((product) => product.id !== productId),
    }));
  };

  const normalizePriceInput = (value: string) => {
    const cleaned = value.replace(/[^0-9.]/g, "");
    const parts = cleaned.split(".");
    if (parts.length <= 1) return cleaned;
    return `${parts[0]}.${parts.slice(1).join("")}`;
  };

  const formatPrice = (value: string) => {
    const cleaned = normalizePriceInput(value);
    if (!cleaned) return "";
    const parsed = Number(cleaned);
    if (!Number.isFinite(parsed)) return "";
    return parsed.toFixed(2);
  };

  const isValidPrice = (value: string) => {
    const cleaned = normalizePriceInput(value);
    if (!cleaned) return false;
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) && parsed > 0;
  };

  const productIssues = useMemo(() => (
    draft.products.map((product) => ({
      id: product.id,
      nameOk: Boolean((product.name || "").trim()),
      priceOk: isValidPrice(product.price),
      variantsOk: product.variants.length > 0,
      imageOk: Boolean((product.imageUrl || "").trim()),
    }))
  ), [draft.products]);

  const hasProductIssues = productIssues.some((issue) => (
    !issue.nameOk || !issue.priceOk || !issue.variantsOk || !issue.imageOk
  ));

  const handleShowcaseNext = () => {
    if (draft.products.length > 0 && hasProductIssues) {
      setShowShowcaseErrors(true);
      toast({
        title: "Finish each product card",
        description: "Need: name + price + image + at least one option.",
        variant: "destructive",
      });
      return;
    }

    setShowShowcaseErrors(false);
    advanceToStep(STEP_PRESENCE);
  };

  const progressValue = useMemo(() => {
    const visualStage = Math.min(step + 1, 5);
    return Math.round((visualStage / 5) * 100);
  }, [step]);

  const currentStageLabel = STAGE_LABELS[Math.min(step, STAGE_LABELS.length - 1)];
  const currentStageHelp = STAGE_HELP_COPY[Math.min(step, STAGE_HELP_COPY.length - 1)];

  const hasUnsavedProgress = useMemo(() => {
    return (
      draft.businessName.trim().length > 0 ||
      draft.logoUrl.trim().length > 0 ||
      draft.city.trim().length > 0 ||
      draft.productCategories.length > 0 ||
      draft.products.length > 0 ||
      draft.upcomingEvents.length > 0 ||
      draft.promoCode.trim().length > 0 ||
      draft.promoDiscountValue.trim().length > 0 ||
      draft.faq.trim().length > 0 ||
      draft.shipsInternational ||
      draft.website.trim().length > 0 ||
      draft.instagram.trim().length > 0 ||
      draft.facebook.trim().length > 0 ||
      draft.whatsapp.trim().length > 0 ||
      draft.email.trim().length > 0 ||
      teamSearch.trim().length > 0 ||
      selectedTeamMembers.length > 0 ||
      pendingLogoFile !== null ||
      Object.values(pendingProductFiles).some(Boolean)
    );
  }, [
    draft,
    pendingLogoFile,
    pendingProductFiles,
    selectedTeamMembers.length,
    teamSearch,
  ]);

  const optionCChecklist = useMemo(() => {
    const cityCandidates = Array.from(new Set(
      [
        normalizeRequiredCity(draft.city),
        ...selectedTeamMembers.map((member) => normalizeRequiredCity(member.city || "")),
      ].filter((value) => hasRequiredCity(value))
    ));

    const hasContactMethod = Boolean(draft.email.trim() || draft.whatsapp.trim());
    const hasSocialOrWebsite = Boolean(
      draft.website.trim() || draft.instagram.trim() || draft.facebook.trim()
    );

    return [
      { key: "business", label: "Storefront name", ok: Boolean(draft.businessName.trim()), step: STEP_INVITE },
      { key: "city", label: "City provided", ok: cityCandidates.length > 0, step: STEP_INVITE },
      { key: "team", label: "At least 1 team member", ok: selectedTeamMembers.length > 0, step: STEP_INVITE },
      { key: "categories", label: "At least 1 category", ok: draft.productCategories.length > 0, step: STEP_IDENTITY },
      {
        key: "products",
        label: "At least 1 complete product",
        ok: draft.products.length > 0 && !hasProductIssues,
        step: STEP_SHOWCASE,
      },
      { key: "faq", label: "FAQ added", ok: Boolean(draft.faq.trim()), step: STEP_ACCESS },
      { key: "contact", label: "Email or WhatsApp", ok: hasContactMethod, step: STEP_ACCESS },
      { key: "social", label: "Website, Instagram, or Facebook", ok: hasSocialOrWebsite, step: STEP_ACCESS },
    ];
  }, [draft, hasProductIssues, selectedTeamMembers]);

  const optionCMissingCount = optionCChecklist.filter((item) => !item.ok).length;

  const jumpToChecklistStep = (checkKey: string, nextStep: number) => {
    if (checkKey === "faq") {
      setFaqMode("markdown");
    }

    setStep(nextStep);
    window.scrollTo(0, 0);

    const focusByCheckKey: Record<string, string> = {
      business: "vendor-storefront-name",
      city: "vendor-team-search",
      team: "vendor-team-search",
      categories: "vendor-first-category",
      products: "vendor-add-product",
      faq: "vendor-faq-markdown",
      contact: "vendor-email",
      social: "vendor-website",
    };

    const targetId = focusByCheckKey[checkKey];
    if (!targetId) return;

    window.setTimeout(() => {
      const element = document.getElementById(targetId) as HTMLElement | null;
      element?.focus();
    }, 120);
  };

  const fillMockData = () => {
    const createProductId = () => (
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    const sampleFaqItems = [
      {
        id: createProductId(),
        question: 'Do you ship internationally?',
        answer: 'Yes, we ship worldwide and share tracking details once your order leaves our studio.',
      },
      {
        id: createProductId(),
        question: 'Can I collect at events?',
        answer: 'Yes, collection is available at selected socials and festivals listed in our upcoming events.',
      },
    ];

    const sampleProducts: VendorProduct[] = [
      {
        id: createProductId(),
        name: 'Practice Heels - Midnight',
        price: '89.00',
        variants: ['Black', 'Size 37', 'Size 38'],
        imageUrl: 'https://images.unsplash.com/photo-1543163521-1bf539c55dd2',
      },
      {
        id: createProductId(),
        name: 'Performance Skirt - Flow',
        price: '54.00',
        variants: ['Red', 'S', 'M'],
        imageUrl: 'https://images.unsplash.com/photo-1483985988355-763728e1935b',
      },
    ];

    setDraft({
      businessName: 'Ritmo Boutique',
      logoUrl: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8',
      city: 'London',
      productCategories: ['Dance shoes', 'Dancewear', 'Accessories'],
      products: sampleProducts,
      upcomingEvents: eventOptions[0] ? [eventOptions[0].id] : [],
      promoCode: 'RITMO10',
      promoDiscountType: 'percent',
      promoDiscountValue: '10',
      faq: '## FAQ\n\n### Do you ship internationally?\nYes, we ship worldwide and share tracking details once dispatched.\n\n### Can I collect at events?\nYes, collection is available at selected socials and festivals listed in our upcoming events.',
      shipsInternational: true,
      website: 'https://ritmoboutique.example.com',
      instagram: 'https://instagram.com/ritmoboutique',
      facebook: 'https://facebook.com/ritmoboutique',
      whatsapp: '+44 7700 900456',
      email: 'hello@ritmoboutique.example.com',
    });

    setFaqItems(sampleFaqItems);
    setPendingLogoFile(null);
    setPendingProductFiles({});
    setVariantInputs({});
    setShowShowcaseErrors(false);

    toast({
      title: 'Mock data loaded',
      description: 'Development sample values have been filled in.',
    });
  };

  useUnsavedChangesGuard({ enabled: hasUnsavedProgress && !isSubmitting });

  const trimmedTeamSearch = teamSearch.trim();

  return (
    <div className="min-h-screen pt-20 px-4 pb-24 relative overflow-hidden">
      <div className="pointer-events-none absolute top-10 -left-20 h-64 w-64 rounded-full bg-festival-teal/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -right-24 h-72 w-72 rounded-full bg-cyan-400/20 blur-3xl" />
      <div className="max-w-2xl mx-auto">
        <div className="mb-6 flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">Vendor onboarding</p>
              <h1 className="text-2xl font-bold">Storefront setup</h1>
            </div>
            {import.meta.env.DEV && (
              <Button type="button" variant="outline" size="sm" onClick={fillMockData}>
                Fill mock data
              </Button>
            )}
          </div>
          {step >= STEP_INVITE && step <= STEP_ACCESS && (
            <div className="space-y-2 rounded-xl border border-festival-teal/35 bg-background/70 p-3 backdrop-blur-md">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Progress</span>
                <span>{currentStageLabel}</span>
              </div>
              <div className="h-2 rounded-full bg-white/15 overflow-hidden">
                <div className="h-full bg-gradient-to-r from-festival-teal to-cyan-400 transition-all" style={{ width: `${progressValue}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">{currentStageHelp}</p>
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {step === STEP_INVITE && (
            <motion.div
              key="invite"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Storefront + Team setup</h2>
                <p className="text-muted-foreground">Set your storefront basics and add your team first.</p>
              </div>

              <Card className="border-festival-teal/35 bg-background/85 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Start your storefront</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Storefront name</Label>
                    <Input
                      id="vendor-storefront-name"
                      value={draft.businessName}
                      onChange={(e) => setDraft((prev) => ({ ...prev, businessName: e.target.value }))}
                      placeholder="Your brand name"
                    />
                  </div>
                  <div>
                    <Label>Logo or hero image</Label>
                    <div className="flex items-center gap-6">
                      <div className="relative">
                        <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
                          <AvatarImage src={draft.logoUrl} className="object-cover" />
                          <AvatarFallback className="text-2xl bg-muted/50">
                            {getVendorInitials(draft.businessName)}
                          </AvatarFallback>
                        </Avatar>
                      </div>
                      <div className="flex-1 space-y-2">
                        <Button type="button" variant="outline" className="relative overflow-hidden">
                          <Upload className="w-4 h-4 mr-2" />
                          Select photo
                          <input
                            type="file"
                            className="absolute inset-0 opacity-0 cursor-pointer"
                            accept="image/*"
                            onChange={handleLocalLogoChange}
                          />
                        </Button>
                        <p className="text-[10px] text-muted-foreground">Uploads go to the images bucket when you publish.</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <Label>Team</Label>
                    <p className="text-xs text-muted-foreground mt-1">Required: add at least one team member.</p>
                    <div className="space-y-3 mt-2">
                      <Input
                        id="vendor-team-search"
                        value={teamSearch}
                        onChange={(e) => setTeamSearch(e.target.value)}
                        placeholder="Search dancers by name..."
                        onKeyDown={(event) => {
                          if (event.key !== "Enter") return;
                          if (isSearchingTeam) return;
                          if (teamResults.length === 0) return;
                          event.preventDefault();
                          addExistingTeamMember(teamResults[0]);
                        }}
                      />
                      {trimmedTeamSearch.length > 0 && trimmedTeamSearch.length < 2 && (
                        <p className="text-xs text-muted-foreground">Type at least 2 letters to search.</p>
                      )}
                      {isSearchingTeam && (
                        <p className="text-xs text-muted-foreground">Searching dancers...</p>
                      )}
                      {!isSearchingTeam && teamSearchError && (
                        <p className="text-xs text-destructive">{teamSearchError}</p>
                      )}
                      {!isSearchingTeam && !teamSearchError && trimmedTeamSearch.length >= 2 && teamResults.length === 0 && (
                        <p className="text-xs text-muted-foreground">No matches found. Create a dancer profile, then search again.</p>
                      )}
                      {!isSearchingTeam && teamResults.length > 0 && (
                        <div className="rounded-lg border border-festival-teal/30 bg-background/60 p-2 space-y-1">
                          {teamResults.map((member) => (
                            <button
                              key={member.id}
                              type="button"
                              onClick={() => addExistingTeamMember(member)}
                              className="w-full text-left rounded-md px-3 py-2 hover:bg-festival-teal/10"
                            >
                              <span className="text-sm font-medium">{member.displayName}</span>
                              <span className="ml-2 text-xs text-muted-foreground">{member.city || "No city"}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      <div className="rounded-lg border border-festival-teal/30 bg-background/60 p-3 space-y-2">
                        <p className="text-xs text-muted-foreground">Name not found? Create the dancer first, then link them as team.</p>
                        <Button type="button" variant="outline" className="border-festival-teal/35" onClick={() => navigate('/dancers')}>
                          Open dancers page
                        </Button>
                      </div>

                      {selectedTeamMembers.length > 0 && (
                        <div className="space-y-3">
                          <div className="flex flex-wrap gap-2">
                            {selectedTeamMembers.map((member) => (
                              <span key={member.id} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
                                {member.displayName}
                                <button type="button" onClick={() => removeTeamMember(member.id)}>×</button>
                              </span>
                            ))}
                          </div>

                          {selectedTeamMembers.length > 1 && (
                            <div className="rounded-lg border border-festival-teal/30 bg-background/60 p-3 space-y-2">
                              <Label>Who is the leader of this business?</Label>
                              <p className="text-xs text-muted-foreground">Required. This links the storefront to a dancer profile identity.</p>
                              <div className="flex flex-wrap gap-2">
                                {selectedTeamMembers.map((member) => {
                                  const isLeader = leaderDancerId === member.id;
                                  return (
                                    <button
                                      key={`leader-${member.id}`}
                                      type="button"
                                      onClick={() => setLeaderDancerId(member.id)}
                                      className={`rounded-full border px-3 py-1 text-xs transition ${
                                        isLeader
                                          ? "bg-festival-teal/25 text-cyan-100 border-cyan-300/70"
                                          : "bg-background border-festival-teal/30 hover:bg-festival-teal/10"
                                      }`}
                                    >
                                      {member.displayName}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                className={`w-full ${PRIMARY_CTA_CLASS}`}
                onClick={async () => {
                  if (selectedTeamMembers.length === 0) {
                    toast({
                      title: "Add at least one team member",
                      description: "Choose an existing dancer or add a new one to continue.",
                      variant: "destructive",
                    });
                    return;
                  }
                  if (!leaderDancerId) {
                    toast({
                      title: "Choose a business leader",
                      description: "Select the team member who leads this business.",
                      variant: "destructive",
                    });
                    return;
                  }
                  advanceToStep(STEP_IDENTITY);
                }}
              >
                Continue to categories
              </Button>
            </motion.div>
          )}

          {step === STEP_IDENTITY && (
            <motion.div
              key="identity"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Define your vibe</h2>
                <p className="text-muted-foreground">Choose the categories shoppers will find you in.</p>
              </div>

              <Card className="border-festival-teal/35 bg-background/85 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Category signals</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Product categories</Label>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {categoryOptions.map((category) => (
                        <button
                          key={category}
                          id={category === categoryOptions[0] ? "vendor-first-category" : undefined}
                          type="button"
                          onClick={() => toggleCategory(category)}
                          className={`px-3 py-1.5 rounded-full text-sm border transition ${
                            draft.productCategories.includes(category)
                              ? "bg-festival-teal/25 text-cyan-100 border-cyan-300/70"
                              : "bg-background border-festival-teal/30 hover:bg-festival-teal/10"
                          }`}
                        >
                          {category}
                        </button>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">Status rises with 2+ categories.</p>
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="transition-all duration-200 active:scale-[0.98]" onClick={() => goBackToStep(STEP_INVITE)}>Back</Button>
                <Button className={`flex-1 ${PRIMARY_CTA_CLASS}`} onClick={() => advanceToStep(STEP_SHOWCASE)}>Continue</Button>
              </div>
            </motion.div>
          )}

          {step === STEP_SHOWCASE && (
            <motion.div
              key="showcase"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Show what you sell</h2>
                <p className="text-muted-foreground">Add products, then continue.</p>
              </div>

              <Card className="border-festival-teal/35 bg-background/85 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Showcase</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  {showShowcaseErrors && draft.products.length > 0 && (
                    <div className="rounded-lg border border-cyan-300/40 bg-festival-teal/12 px-4 py-3 text-sm text-cyan-100">
                      Missing info in one or more products.
                    </div>
                  )}
                  <div>
                    <Label>Products</Label>
                    <p className="text-xs text-muted-foreground mt-1">Add at least one product.</p>
                    <div className="space-y-4 mt-2">
                      {draft.products.length === 0 && (
                        <div className="rounded-lg border border-dashed border-festival-teal/30 bg-background/70 p-4 text-sm text-muted-foreground">
                          No products yet.
                        </div>
                      )}
                      {draft.products.map((product, index) => {
                        const issue = productIssues.find((item) => item.id === product.id);
                        return (
                          <div key={product.id} className="rounded-xl border bg-white/70 p-4 space-y-4">
                            <div className="flex items-center justify-between">
                              <p className="text-sm font-semibold">Product {index + 1}</p>
                              <Button type="button" variant="outline" className="h-8 border-festival-teal/35" onClick={() => removeProduct(product.id)}>
                                Remove
                              </Button>
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                              <Input
                                value={product.name}
                                onChange={(e) => updateProduct(product.id, { name: e.target.value })}
                                placeholder="Product name"
                              />
                              <Input
                                type="number"
                                min="0"
                                step="0.01"
                                value={product.price}
                                onChange={(e) => updateProduct(product.id, { price: normalizePriceInput(e.target.value) })}
                                onBlur={(e) => updateProduct(product.id, { price: formatPrice(e.target.value) })}
                                placeholder="Price (GBP)"
                              />
                            </div>
                            {showShowcaseErrors && !issue?.nameOk && (
                              <p className="text-xs text-destructive">Add a product name.</p>
                            )}
                            {showShowcaseErrors && !issue?.priceOk && (
                              <p className="text-xs text-destructive">Add a valid price (greater than 0).</p>
                            )}
                            <div>
                              <p className="text-xs text-muted-foreground">Product image (required)</p>
                              <div className="flex items-center gap-3 mt-2">
                                <div className="flex items-center gap-3">
                                  <Avatar className="w-20 h-20 border-2 border-background shadow-sm">
                                    <AvatarImage src={product.imageUrl} className="object-cover" />
                                    <AvatarFallback className="text-sm bg-muted/50">IMG</AvatarFallback>
                                  </Avatar>
                                  <Button type="button" variant="outline" className="relative overflow-hidden">
                                    <Upload className="w-4 h-4 mr-2" />
                                    Select image
                                    <input
                                      type="file"
                                      className="absolute inset-0 opacity-0 cursor-pointer"
                                      accept="image/*"
                                      onChange={(event) => handleLocalProductImageChange(product.id, event)}
                                    />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-[10px] text-muted-foreground mt-2">Uploads go to the images bucket when you publish.</p>
                              {showShowcaseErrors && !issue?.imageOk && (
                                <p className="text-xs text-destructive mt-2">Add a product image.</p>
                              )}
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Options (size, color, style)</p>
                            </div>
                            <div className="flex gap-2">
                              <Input
                                value={variantInputs[product.id] || ""}
                                onChange={(e) => setVariantInputs((prev) => ({ ...prev, [product.id]: e.target.value }))}
                                placeholder="e.g., Black / Size 38"
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    addVariant(product.id);
                                  }
                                }}
                              />
                              <Button type="button" variant="outline" onClick={() => addVariant(product.id)}>Add option</Button>
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button type="button" variant="outline" className="h-8 border-festival-teal/35" onClick={() => addCommonOptions(product.id, ["S", "M", "L"]) }>
                                + S/M/L
                              </Button>
                              <Button type="button" variant="outline" className="h-8 border-festival-teal/35" onClick={() => addCommonOptions(product.id, ["Black", "White"]) }>
                                + Black/White
                              </Button>
                              <Button type="button" variant="outline" className="h-8 border-festival-teal/35" onClick={() => addCommonOptions(product.id, ["Standard", "Premium"]) }>
                                + Standard/Premium
                              </Button>
                            </div>
                            {showShowcaseErrors && !issue?.variantsOk && (
                              <p className="text-xs text-destructive">Add at least one option.</p>
                            )}
                            <div className="flex flex-wrap gap-2">
                              {product.variants.map((variant) => (
                                <span key={variant} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
                                  {variant}
                                  <button type="button" onClick={() => removeVariant(product.id, variant)}>×</button>
                                </span>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button id="vendor-add-product" type="button" onClick={addProduct} className={`flex-1 ${PRIMARY_CTA_CLASS}`}>Add product</Button>
                        <Button type="button" variant="outline" onClick={addSampleProduct} className="flex-1 border-festival-teal/35">Use sample</Button>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between rounded-lg border border-festival-teal/30 bg-background/60 p-4">
                    <div className="space-y-0.5">
                      <Label>Ships internationally</Label>
                      <p className="text-xs text-muted-foreground">Turn on if you ship outside your country.</p>
                    </div>
                    <Switch
                      checked={draft.shipsInternational}
                      onCheckedChange={(checked) => setDraft((prev) => ({ ...prev, shipsInternational: checked }))}
                    />
                  </div>
                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="transition-all duration-200 active:scale-[0.98]" onClick={() => goBackToStep(STEP_IDENTITY)}>Back</Button>
                <Button className={`flex-1 ${PRIMARY_CTA_CLASS}`} onClick={handleShowcaseNext}>Continue</Button>
              </div>
            </motion.div>
          )}

          {step === STEP_PRESENCE && (
            <motion.div
              key="presence"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Boost visibility and offers</h2>
                <p className="text-muted-foreground">Link events and create promo intent. Trust details come next.</p>
              </div>

              <Card className="border-festival-teal/35 bg-background/85 backdrop-blur-md">
                <CardHeader>
                  <CardTitle>Presence boosts</CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <Label>Upcoming events</Label>
                    <p className="text-xs text-muted-foreground">So people can see your plan.</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <select
                        value={selectedEventId}
                        onChange={(e) => setSelectedEventId(e.target.value)}
                        className="border rounded-md px-3 py-2 text-sm bg-background"
                      >
                        <option value="">Select an event</option>
                        {eventOptions.map((event) => (
                          <option key={event.id} value={event.id}>
                            {event.name}{event.date ? ` · ${formatEventDate(event.date)}` : ""}
                          </option>
                        ))}
                      </select>
                      <Button type="button" variant="outline" onClick={addUpcomingEvent}>Add</Button>
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {draft.upcomingEvents.map((eventId) => {
                        const event = eventOptions.find((item) => item.id === eventId);
                        const dateLabel = event?.date ? formatEventDate(event.date) : "";
                        return (
                          <span key={eventId} className="inline-flex items-center gap-2 rounded-full bg-muted px-3 py-1 text-xs">
                            {event?.name || eventId}{dateLabel ? ` · ${dateLabel}` : ""}
                            <button type="button" onClick={() => removeUpcomingEvent(eventId)}>×</button>
                          </span>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <Label>Promo code</Label>
                    <Input
                      value={draft.promoCode}
                      onChange={(e) => setDraft((prev) => ({ ...prev, promoCode: e.target.value }))}
                      placeholder="BACHATA10"
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Promo discount type</Label>
                      <select
                        value={draft.promoDiscountType}
                        onChange={(e) => setDraft((prev) => ({
                          ...prev,
                          promoDiscountType: e.target.value === "fixed" ? "fixed" : "percent",
                        }))}
                        className="border rounded-md px-3 py-2 text-sm bg-background w-full"
                      >
                        <option value="percent">Percent</option>
                        <option value="fixed">Fixed</option>
                      </select>
                    </div>
                    <div>
                      <Label>Promo discount value</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={draft.promoDiscountValue}
                        onChange={(e) => setDraft((prev) => ({ ...prev, promoDiscountValue: e.target.value }))}
                        placeholder={draft.promoDiscountType === "percent" ? "10" : "5"}
                      />
                    </div>
                  </div>

                </CardContent>
              </Card>

              <div className="flex flex-col sm:flex-row gap-3">
                <Button variant="outline" className="transition-all duration-200 active:scale-[0.98]" onClick={() => goBackToStep(STEP_SHOWCASE)}>Back</Button>
                <Button className={`flex-1 ${PRIMARY_CTA_CLASS}`} onClick={() => advanceToStep(STEP_ACCESS)}>Continue</Button>
              </div>
            </motion.div>
          )}

          {step === STEP_ACCESS && (
            <motion.div
              key="access"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-6"
            >
              <div className="text-center space-y-2">
                <h2 className="text-2xl font-bold">Trust and publish</h2>
                <p className="text-muted-foreground">Finalize trust signals and publish with the full strict checklist.</p>
                <p className="text-xs text-muted-foreground">After publish, your dashboard will show status tiers: Draft → Basic Published → Optimized.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                <Card className="border-festival-teal/35 bg-background/85 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Publish checklist (Option C)
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Checklist help">
                            <CircleHelp className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Strict mode is active: all checklist requirements must be complete before publish.
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      {optionCMissingCount === 0
                        ? "All required items are complete."
                        : `${optionCMissingCount} requirement(s) still missing.`}
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {optionCChecklist.map((item) => (
                        <div key={item.key} className="rounded-md border border-festival-teal/20 px-3 py-2 text-xs flex items-center justify-between gap-2">
                          <span>{item.label}</span>
                          {item.ok ? (
                            <span className="text-emerald-400">Done</span>
                          ) : (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-6 px-2 text-[10px]"
                              onClick={() => jumpToChecklistStep(item.key, item.step)}
                            >
                              Fix
                            </Button>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-festival-teal/35 bg-background/85 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle>Trust builder (FAQ)</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <p className="text-xs text-muted-foreground">Keep this short and practical. FAQ answers reduce buyer hesitation before contact.</p>
                    <div className="rounded-2xl border border-festival-teal/35 bg-gradient-to-br from-background via-festival-teal/10 to-cyan-400/10 p-4">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs uppercase tracking-wide text-muted-foreground">Mode</span>
                        <Button
                          type="button"
                          variant={faqMode === "builder" ? "default" : "outline"}
                          className={faqMode === "builder" ? PRIMARY_CTA_CLASS : "border-festival-teal/35 bg-background/70 hover:bg-festival-teal/10"}
                          onClick={() => setFaqMode("builder")}
                        >
                          Guided Builder
                        </Button>
                        <Button
                          type="button"
                          variant={faqMode === "markdown" ? "default" : "outline"}
                          className={faqMode === "markdown" ? PRIMARY_CTA_CLASS : "border-festival-teal/35 bg-background/70 hover:bg-festival-teal/10"}
                          onClick={() => setFaqMode("markdown")}
                        >
                          Edit Markdown
                        </Button>
                      </div>

                      {faqMode === "builder" && (
                        <div className="mt-4 space-y-4">
                          <div className="rounded-xl border border-festival-teal/35 bg-background/70 p-4 text-sm text-muted-foreground">
                            Add questions, write quick answers, then generate.
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {faqPresets.map((preset) => (
                              <Button
                                key={preset}
                                type="button"
                                variant="ghost"
                                className="border border-festival-teal/25 bg-background/65 hover:bg-festival-teal/10"
                                onClick={() => addPresetQuestion(preset)}
                              >
                                + {preset}
                              </Button>
                            ))}
                          </div>

                          <div className="space-y-3">
                            {faqItems.length === 0 && (
                              <div className="rounded-xl border border-dashed border-festival-teal/30 bg-background/70 p-4 text-sm text-muted-foreground">
                                No FAQ items yet. Use a preset or add your first question below.
                              </div>
                            )}
                            {faqItems.map((item) => (
                              <div key={item.id} className="rounded-2xl border border-festival-teal/25 bg-background/80 p-4 space-y-3">
                                <Input
                                  value={item.question}
                                  onChange={(e) => updateFaqItem(item.id, { question: e.target.value })}
                                  placeholder="Question (e.g., Do you ship internationally?)"
                                  className="bg-background/75"
                                />
                                <Textarea
                                  value={item.answer}
                                  onChange={(e) => updateFaqItem(item.id, { answer: e.target.value })}
                                  placeholder="Draft answer (2-3 short sentences)"
                                  className="bg-background/75"
                                />
                                <div className="flex justify-end">
                                  <Button type="button" variant="ghost" onClick={() => removeFaqItem(item.id)}>
                                    Remove
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>

                          <div className="flex flex-col sm:flex-row gap-2">
                            <Button type="button" variant="outline" onClick={() => addFaqItem()} className="flex-1">
                              Add question
                            </Button>
                            <Button type="button" onClick={generateFaqMarkdown} className={`flex-1 ${PRIMARY_CTA_CLASS}`}>
                              Generate Professional FAQ
                            </Button>
                          </div>
                          <div className="text-xs text-muted-foreground">
                            Tip: You can edit the generated FAQ in Markdown mode afterwards.
                          </div>
                        </div>
                      )}

                      {faqMode === "markdown" && (
                        <div className="mt-4 space-y-2">
                          <p className="text-xs text-muted-foreground">Edit the final FAQ in Markdown. This is the only saved value.</p>
                          <Textarea
                            id="vendor-faq-markdown"
                            value={draft.faq}
                            onChange={(e) => setDraft((prev) => ({ ...prev, faq: e.target.value }))}
                            placeholder="## FAQ\n\n### Question\nAnswer"
                            rows={8}
                            className="bg-background/75"
                          />
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                <Card className="border-festival-teal/35 bg-background/85 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      Public contact
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button type="button" className="text-muted-foreground hover:text-foreground" aria-label="Public contact help">
                            <CircleHelp className="h-4 w-4" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent>
                          Contact details are buyer-facing trust signals and directly affect conversion readiness.
                        </TooltipContent>
                      </Tooltip>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>Website</Label>
                      <Input
                        id="vendor-website"
                        value={draft.website}
                        onChange={(e) => setDraft((prev) => ({ ...prev, website: e.target.value }))}
                        onBlur={() => setDraft((prev) => ({ ...prev, website: normalizeSocialUrl('website', prev.website) }))}
                        placeholder="https://..."
                      />
                    </div>
                    <div>
                      <Label>Instagram</Label>
                      <Input
                        value={draft.instagram}
                        onChange={(e) => setDraft((prev) => ({ ...prev, instagram: e.target.value }))}
                        onBlur={() => setDraft((prev) => ({ ...prev, instagram: normalizeSocialUrl('instagram', prev.instagram) }))}
                        placeholder="@username"
                      />
                    </div>
                    <div>
                      <Label>Facebook</Label>
                      <Input
                        value={draft.facebook}
                        onChange={(e) => setDraft((prev) => ({ ...prev, facebook: e.target.value }))}
                        onBlur={() => setDraft((prev) => ({ ...prev, facebook: normalizeSocialUrl('facebook', prev.facebook) }))}
                        placeholder="facebook.com/name"
                      />
                    </div>
                    <div>
                      <Label>WhatsApp</Label>
                      <Input
                        value={draft.whatsapp}
                        onChange={(e) => setDraft((prev) => ({ ...prev, whatsapp: e.target.value }))}
                        placeholder="+44"
                      />
                    </div>
                    <div>
                      <Label>Public contact email</Label>
                      <p className="text-xs text-muted-foreground">Shown on your storefront for customer contact. This is separate from login.</p>
                      <Input
                        id="vendor-email"
                        value={draft.email}
                        onChange={(e) => setDraft((prev) => ({ ...prev, email: e.target.value }))}
                        placeholder="you@example.com"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-center">
                  {user ? (
                    <Card className="w-full border-festival-teal/35 bg-background/85 backdrop-blur-md">
                      <CardContent className="pt-6 text-center space-y-2">
                        <p className="text-sm font-medium">Signed in as {user.email || "your account"}</p>
                        <p className="text-xs text-muted-foreground">You can publish without another login step.</p>
                      </CardContent>
                    </Card>
                  ) : (
                    <AuthFormProvider>
                      <AuthStepper
                        userType="vendor"
                        returnTo={returnTo}
                        onAuthenticated={() => setPendingSubmit(true)}
                        showIntentSelect={false}
                        initialIntent="returning"
                        title="Finish your profile"
                        subtitle="Sign in with your account email. Public contact email above is stored separately."
                        requireSignupDetails={false}
                      />
                    </AuthFormProvider>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                  <Button type="button" variant="outline" className="transition-all duration-200 active:scale-[0.98]" onClick={() => goBackToStep(STEP_PRESENCE)}>Back</Button>
                  <Button type="submit" disabled={isSubmitting || optionCMissingCount > 0} className={`flex-1 ${PRIMARY_CTA_CLASS}`}>
                    {isSubmitting ? "Publishing..." : "Publish storefront"}
                  </Button>
                </div>
                {optionCMissingCount > 0 && !isSubmitting && (
                  <p className="text-xs text-muted-foreground">Complete the checklist above to enable publishing.</p>
                )}
              </form>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default CreateVendorProfile;
