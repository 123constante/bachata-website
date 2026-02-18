import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useUserIds, type UserRole } from "@/hooks/useUserIds";
import { supabase } from "@/integrations/supabase/client";
import type {
  VendorDashboardProgressMap,
  VendorDashboardSavePayload,
  VendorDashboardSection,
  VendorRow,
} from "@/modules/vendor/types";
import { normalizeProducts, normalizePromoDiscountType, normalizePromoDiscountValue } from "@/modules/vendor/utils";
import { ensureDancerProfile } from "@/lib/ensureDancerProfile";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import VendorDashboardPage from "@/pages/VendorDashboardPage";
import { useToast } from "@/hooks/use-toast";

type DashboardTab = "growth" | "catalog" | "presence" | "operations";
type ProfileEditorFocus = "name" | "location";

type TileStatus = "live" | "attention";

type ModuleSlot = {
  tab: DashboardTab;
  title: string;
  description: string;
  colSpan: "12" | "8" | "6" | "4" | "3";
  rowSpan?: "1" | "2";
  status: TileStatus;
  actionLabel: string;
  actionSection?: Exclude<VendorDashboardSection, "advanced">;
  profileFocus?: ProfileEditorFocus;
};

type SecondaryRole = Exclude<UserRole, "vendor">;

const PROFILE_ROLE_META: Record<SecondaryRole, { label: string; createRoute: string; canClaim: boolean }> = {
  dancer: { label: "Dancer", createRoute: "/create-dancers-profile", canClaim: false },
  organiser: { label: "Organiser", createRoute: "/create-organiser-profile", canClaim: true },
  teacher: { label: "Teacher", createRoute: "/create-teacher-profile", canClaim: true },
  dj: { label: "DJ", createRoute: "/create-dj-profile", canClaim: true },
  videographer: { label: "Videographer", createRoute: "/create-videographer-profile", canClaim: false },
};

const SECONDARY_ROLES: SecondaryRole[] = ["dancer", "organiser", "teacher", "dj", "videographer"];

const spanClass = (slot: Pick<ModuleSlot, "colSpan" | "rowSpan">) => {
  const colMap: Record<ModuleSlot["colSpan"], string> = {
    "12": "col-span-4 sm:col-span-8 lg:col-span-12",
    "8": "col-span-4 sm:col-span-8 lg:col-span-8",
    "6": "col-span-2 sm:col-span-4 lg:col-span-6",
    "4": "col-span-2 sm:col-span-4 lg:col-span-4",
    "3": "col-span-1 sm:col-span-2 lg:col-span-3",
  };

  const rowClass = slot.rowSpan === "2" ? "lg:row-span-2" : "";
  return `${colMap[slot.colSpan]} ${rowClass}`.trim();
};

const tileStatusTone: Record<TileStatus, string> = {
  live: "border-emerald-500/30 bg-emerald-500/5",
  attention: "border-amber-500/30 bg-amber-500/5",
};

export const VendorDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    dancerId,
    organiserId,
    teacherId,
    djId,
    videographerId,
    vendorId,
    loading: roleIdsLoading,
  } = useUserIds();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [vendor, setVendor] = useState<VendorRow | null>(null);
  const [editingSection, setEditingSection] = useState<ModuleSlot["actionSection"] | null>(null);
    const [editingProfileFocus, setEditingProfileFocus] = useState<ProfileEditorFocus | null>(null);
  const [activeTab, setActiveTab] = useState<DashboardTab>("growth");
  const [sectionProgressOverride, setSectionProgressOverride] = useState<VendorDashboardProgressMap>({});
  const [highlightedSection, setHighlightedSection] = useState<VendorDashboardSection | null>(null);
  const highlightTimerRef = useRef<number | null>(null);

  const roleIds = useMemo(
    () => ({
      dancer: dancerId,
      organiser: organiserId,
      teacher: teacherId,
      dj: djId,
      videographer: videographerId,
      vendor: vendorId,
    }),
    [dancerId, organiserId, teacherId, djId, videographerId, vendorId]
  );

  const existingSecondaryRoles = useMemo(
    () => SECONDARY_ROLES.filter((role) => Boolean(roleIds[role])),
    [roleIds]
  );

  const missingSecondaryRoles = useMemo(
    () => SECONDARY_ROLES.filter((role) => role !== "dancer" && !roleIds[role]),
    [roleIds]
  );

  const ownedProfilesCount = useMemo(
    () => Object.values(roleIds).filter(Boolean).length,
    [roleIds]
  );

  const loadVendor = useCallback(async () => {
    if (!user) {
      setVendor(null);
      setIsLoading(false);
      return;
    }
    setIsLoading(true);

    const { data, error } = await supabase
      .from("vendors")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (error) {
      console.error("Failed to load vendor:", error);
      setIsLoading(false);
      return;
    }

    setVendor((data as VendorRow) || null);
    setIsLoading(false);
  }, [user]);

  useEffect(() => {
    void loadVendor();
  }, [loadVendor]);

  const allProducts = useMemo(() => {
    return normalizeProducts(vendor?.products)
      .map((product, index) => ({
        id: product.id || `product-${index}`,
        name: product.name,
        price: product.price,
        imageUrl: product.image_url || "",
      }));
  }, [vendor]);

  const promoDetails = useMemo(() => {
    const code = typeof vendor?.promo_code === "string" ? vendor.promo_code : "";
    const discountType = normalizePromoDiscountType(vendor?.promo_discount_type);
    const discountValue = normalizePromoDiscountValue(vendor?.promo_discount_value);
    if (!code) return null;

    if (typeof discountValue === "number") {
      if (discountType === "percent") {
        return `${discountValue}% off`;
      }
      if (discountType === "fixed") {
        return `£${discountValue} off`;
      }
    }

    return "Promo active";
  }, [vendor]);

  const productsCount = allProducts.length;
  const productCategoriesCount = Array.isArray(vendor?.product_categories) ? vendor.product_categories.length : 0;
  const linkedEventsCount = Array.isArray(vendor?.upcoming_events) ? vendor.upcoming_events.length : 0;
  const hasBusinessProfile = Boolean(vendor?.business_name?.trim());
  const hasLogo = Boolean(vendor?.photo_url?.[0]);
  const hasContact = Boolean(vendor?.email || vendor?.whatsapp || vendor?.website || vendor?.instagram || vendor?.facebook);
  const hasFaq = Boolean(vendor?.faq?.trim());
  const hasLocation = Boolean(vendor?.city?.trim());
  const hasShipping = Boolean(vendor?.ships_international);
  const shippingStatus = vendor?.ships_international ? "International" : "Local only";
  const teamCount = useMemo(() => {
    const teamData = vendor?.team;
    if (Array.isArray(teamData)) return teamData.length;
    if (teamData && typeof teamData === "object") return Object.keys(teamData as Record<string, unknown>).length;
    return 0;
  }, [vendor?.team]);

  const vendorSectionProgress = useMemo<VendorDashboardProgressMap>(() => {
    const hasPromoCode = Boolean(vendor?.promo_code?.trim());
    const hasPromoValue = typeof normalizePromoDiscountValue(vendor?.promo_discount_value) === "number";
    const hasAnyContact = [vendor?.email, vendor?.whatsapp].some(
      (item) => Boolean(item && String(item).trim().length > 0)
    );
    const hasAnySocial = [vendor?.website, vendor?.instagram, vendor?.facebook].some(
      (item) => Boolean(item && String(item).trim().length > 0)
    );

    return {
      profile: { complete: hasBusinessProfile && hasLocation },
      media: { complete: hasLogo },
      categories: { complete: productCategoriesCount > 0 },
      products: { complete: productsCount > 0 && allProducts.every((product) => product.name.trim().length > 0) },
      promo: { complete: !hasPromoCode || hasPromoValue },
      events: { complete: linkedEventsCount > 0 },
      contact: { complete: hasAnyContact },
      social: { complete: hasAnySocial },
      faq: { complete: hasFaq },
      team: { complete: teamCount > 0 },
      save: { complete: hasBusinessProfile && hasLocation && productsCount > 0 },
      advanced: { complete: Boolean(vendor?.id) },
    };
  }, [
    allProducts,
    hasBusinessProfile,
    hasFaq,
    hasLocation,
    hasLogo,
    linkedEventsCount,
    productCategoriesCount,
    productsCount,
    teamCount,
    vendor?.facebook,
    vendor?.id,
    vendor?.instagram,
    vendor?.promo_code,
    vendor?.promo_discount_value,
    vendor?.website,
    vendor?.whatsapp,
    vendor?.email,
  ]);

  const sectionProgress = useMemo<VendorDashboardProgressMap>(
    () => ({ ...vendorSectionProgress, ...sectionProgressOverride }),
    [vendorSectionProgress, sectionProgressOverride]
  );

  const contactChannelsCount = [vendor?.email, vendor?.whatsapp, vendor?.website, vendor?.instagram, vendor?.facebook]
    .filter((item) => Boolean(item && String(item).trim().length > 0)).length;

  const contactSummary = useMemo(() => {
    const channels: string[] = [];
    if (vendor?.email) channels.push("Email");
    if (vendor?.whatsapp) channels.push("WhatsApp");
    return channels.length > 0 ? channels.join(", ") : "None";
  }, [vendor?.email, vendor?.whatsapp]);

  const socialSummary = useMemo(() => {
    const links: string[] = [];
    if (vendor?.website) links.push("Website");
    if (vendor?.instagram) links.push("Instagram");
    if (vendor?.facebook) links.push("Facebook");
    return links.length > 0 ? links.join(", ") : "None";
  }, [vendor?.website, vendor?.instagram, vendor?.facebook]);

  const coreStepChecks = useMemo(
    () => [
      { key: "profile", done: hasBusinessProfile && hasLocation },
      { key: "media", done: hasLogo },
      { key: "products", done: productsCount > 0 },
      { key: "promo", done: Boolean(promoDetails) },
      { key: "events", done: linkedEventsCount > 0 },
    ],
    [hasBusinessProfile, hasLocation, hasLogo, productsCount, promoDetails, linkedEventsCount]
  );

  const coreStepsCompletedCount = useMemo(
    () => coreStepChecks.filter((item) => item.done).length,
    [coreStepChecks]
  );

  const nextStepAction = useMemo(() => {
    if (!hasBusinessProfile || !hasLocation) {
      return {
        section: "profile" as Exclude<VendorDashboardSection, "advanced">,
        cta: "Complete business basics",
        helper: "Add business name and city to unlock vendor discovery.",
      };
    }

    if (!hasLogo) {
      return {
        section: "media" as Exclude<VendorDashboardSection, "advanced">,
        cta: "Finish publish setup",
        helper: "Add a logo image to build buyer trust quickly.",
      };
    }

    if (productsCount === 0) {
      return {
        section: "products" as Exclude<VendorDashboardSection, "advanced">,
        cta: "Finish publish setup",
        helper: "Add your first product so customers can browse your offer.",
      };
    }

    if (!promoDetails) {
      return {
        section: "promo" as Exclude<VendorDashboardSection, "advanced">,
        cta: "Boost visibility",
        helper: "Add a promo to increase profile clicks this week.",
      };
    }

    if (linkedEventsCount === 0) {
      return {
        section: "events" as Exclude<VendorDashboardSection, "advanced">,
        cta: "Boost visibility",
        helper: "Link an event to improve discovery in the calendar.",
      };
    }

    return {
      section: "profile" as Exclude<VendorDashboardSection, "advanced">,
      cta: "Refresh profile",
      helper: "Keep your profile updated to stay easy to discover.",
    };
  }, [hasBusinessProfile, hasLocation, hasLogo, linkedEventsCount, productsCount, promoDetails]);

  const groupedRequirementTiles = useMemo<ModuleSlot[]>(() => {
    const isBusinessReady = hasBusinessProfile;
    const isCatalogReady = productsCount > 0;
    const isEventReady = linkedEventsCount > 0;
    const isLocationReady = hasLocation;
    const isTeamReady = teamCount > 0;

    return [
      {
        tab: "catalog",
        title: "Products",
        description: isCatalogReady
          ? `${productsCount} product(s) listed.`
          : "No products yet.",
        colSpan: "8",
        rowSpan: "1",
        status: isCatalogReady ? "live" : "attention",
        actionLabel: "Manage products",
        actionSection: "products",
      },
      {
        tab: "catalog",
        title: "Categories & Shipping",
        description: `${productCategoriesCount} categories • ${shippingStatus}`,
        colSpan: "4",
        rowSpan: "1",
        status: productCategoriesCount > 0 || hasShipping ? "live" : "attention",
        actionLabel: "Manage shipping",
        actionSection: "categories",
      },
      {
        tab: "growth",
        title: "Promo Offer",
        description: promoDetails || "No active promo.",
        colSpan: "6",
        rowSpan: "1",
        status: promoDetails ? "live" : "attention",
        actionLabel: "Edit offer",
        actionSection: "promo",
      },
      {
        tab: "growth",
        title: "Linked Events",
        description: isEventReady
          ? `${linkedEventsCount} linked event(s).`
          : "No linked events.",
        colSpan: "6",
        rowSpan: "1",
        status: isEventReady ? "live" : "attention",
        actionLabel: "Manage events",
        actionSection: "events",
      },
      {
        tab: "presence",
        title: "Business Location",
        description: isLocationReady ? `City: ${vendor?.city}` : "City not set.",
        colSpan: "8",
        rowSpan: "1",
        status: isLocationReady ? "live" : "attention",
        actionLabel: "Edit city",
        actionSection: "profile",
        profileFocus: "location",
      },
      {
        tab: "operations",
        title: "FAQ",
        description: hasFaq ? "FAQ added." : "No FAQ added.",
        colSpan: "6",
        rowSpan: "1",
        status: hasFaq ? "live" : "attention",
        actionLabel: "Edit FAQ",
        actionSection: "faq",
      },
      {
        tab: "operations",
        title: "Team",
        description: isTeamReady
          ? `${teamCount} team member(s).`
          : "No team members.",
        colSpan: "6",
        rowSpan: "1",
        status: isTeamReady ? "live" : "attention",
        actionLabel: "Manage team",
        actionSection: "team",
      },
      {
        tab: "presence",
        title: "Business Name",
        description: isBusinessReady
          ? `Name: ${vendor?.business_name || "Business name set"}`
          : "Business name not set.",
        colSpan: "6",
        rowSpan: "1",
        status: isBusinessReady ? "live" : "attention",
        actionLabel: "Edit name",
        actionSection: "profile",
        profileFocus: "name",
      },
      {
        tab: "presence",
        title: "Business logo",
        description: hasLogo
          ? "Logo uploaded."
          : "Logo not uploaded.",
        colSpan: "4",
        rowSpan: "1",
        status: hasLogo ? "live" : "attention",
        actionLabel: "Edit logo",
        actionSection: "media",
      },
      {
        tab: "presence",
        title: "Contact Channels",
        description: hasContact
          ? `${contactChannelsCount} active: ${contactSummary}`
          : "No contact channels.",
        colSpan: "6",
        rowSpan: "1",
        status: hasContact ? "live" : "attention",
        actionLabel: "Edit contacts",
        actionSection: "contact",
      },
      {
        tab: "presence",
        title: "Social Links",
        description: [vendor?.website, vendor?.instagram, vendor?.facebook].some(
          (item) => Boolean(item && String(item).trim().length > 0)
        )
          ? `Active: ${socialSummary}`
          : "No social links.",
        colSpan: "6",
        rowSpan: "1",
        status: [vendor?.website, vendor?.instagram, vendor?.facebook].some(
          (item) => Boolean(item && String(item).trim().length > 0)
        )
          ? "live"
          : "attention",
        actionLabel: "Edit links",
        actionSection: "social",
      },
    ];
  }, [vendor, hasBusinessProfile, hasLocation, hasContact, contactChannelsCount, contactSummary, socialSummary, productsCount, productCategoriesCount, hasShipping, shippingStatus, promoDetails, linkedEventsCount, hasFaq, teamCount, hasLogo]);

  const openEditor = (
    section?: Exclude<VendorDashboardSection, "advanced">,
    profileFocus?: ProfileEditorFocus | null
  ) => {
    setEditingSection(section || "profile");
    setEditingProfileFocus(profileFocus || null);
  };

  const openRoleWorkspace = (role: UserRole) => {
    localStorage.setItem("profile_last_active_role", role);

    if (role === "vendor") {
      navigate("/dashboard/vendor");
      return;
    }

    if (role === "dancer") {
      navigate("/edit-profile");
      return;
    }

    navigate(`/profile?role=${role}`);
  };

  const navigateToCreateRole = async (role: SecondaryRole) => {
    if (role !== "dancer" && user?.id) {
      const metadata = (user.user_metadata || {}) as Record<string, unknown>;
      const metadataFirstName = typeof metadata.first_name === "string" ? metadata.first_name : null;
      const metadataCity = typeof metadata.city === "string" ? metadata.city : null;

      try {
        await ensureDancerProfile({
          userId: user.id,
          email: user.email || null,
          firstName: metadataFirstName,
          city: metadataCity,
        });
      } catch {
        // Non-blocking: creation page can still proceed and retry.
      }
    }

    navigate(PROFILE_ROLE_META[role].createRoute);
  };

  const renderRequirementTiles = (tab: DashboardTab) => {
    const modules = groupedRequirementTiles.filter((module) => module.tab === tab);
    if (modules.length === 0) return null;

    return modules.map((module) => {
      const completion = module.actionSection ? sectionProgress[module.actionSection] : null;
      const isRecentlyUpdated = Boolean(module.actionSection && highlightedSection === module.actionSection);

      return (
      <Card key={`${tab}-${module.title}`} className={`dashboard-card ${spanClass(module)} ${tileStatusTone[module.status]} ${isRecentlyUpdated ? "ring-1 ring-festival-teal/60 transition" : ""}`}>
        <CardContent className="p-2.5 h-full flex flex-col justify-between gap-2">
          <div className="space-y-1.5">
            <div className="flex items-center gap-1.5">
              <span className={`h-1.5 w-1.5 rounded-full ${module.status === "live" ? "bg-emerald-400" : "bg-amber-400"}`} />
              <p className="text-[12px] font-semibold leading-tight line-clamp-1 sm:line-clamp-none">{module.title}</p>
            </div>
            <p className="text-[11px] text-muted-foreground leading-tight line-clamp-1 sm:line-clamp-2 lg:line-clamp-none">{module.description}</p>
            {completion && isRecentlyUpdated && (
              <Badge variant="outline" className="text-[9px] h-4 px-1.5 sm:text-[10px] sm:h-5 sm:px-2 border-emerald-500/40 text-emerald-300 animate-pulse">
                Updated
              </Badge>
            )}
          </div>
          <Button
            size="sm"
            className="h-6 text-[10px] border-festival-teal/35 bg-background/55 hover:bg-festival-teal/15 focus-visible:ring-2 focus-visible:ring-festival-teal/60 transition-colors"
            variant="outline"
            onClick={() => (module.actionSection ? openEditor(module.actionSection, module.profileFocus) : openEditor())}
          >
            <span className="sm:hidden">Open</span>
            <span className="hidden sm:inline">{module.actionLabel}</span>
          </Button>
        </CardContent>
      </Card>
      );
    });
  };

  if (isLoading) {
    return (
      <div className="dashboard-neon pb-6 pt-16 px-2.5">
        <div className="max-w-6xl mx-auto grid grid-cols-12 gap-2">
          <Card className="dashboard-card col-span-12 lg:col-span-8"><CardContent className="p-6">Loading vendor growth dashboard…</CardContent></Card>
          <Card className="dashboard-card col-span-12 lg:col-span-4"><CardContent className="p-6">Syncing tiles…</CardContent></Card>
        </div>
      </div>
    );
  }

  const activeEditSection = editingSection || "profile";
  const tabPurpose: Record<DashboardTab, { title: string; description: string }> = {
    growth: {
      title: "Growth",
      description: "Use promos and events to get more profile views.",
    },
    catalog: {
      title: "Catalog",
      description: "Set up products, categories, and shipping details.",
    },
    presence: {
      title: "Presence",
      description: "Add brand details, logo image, and contact methods.",
    },
    operations: {
      title: "Operations",
      description: "Manage FAQ, team setup, and account actions.",
    },
  };

  const handlePopupSaved = (payload?: VendorDashboardSavePayload) => {
    setEditingSection(null);
    setEditingProfileFocus(null);

    if (payload?.progress) {
      setSectionProgressOverride(payload.progress);
    }

    if (payload?.section && payload?.savedAt) {
      setHighlightedSection(payload.section);
      if (highlightTimerRef.current) {
        window.clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = window.setTimeout(() => {
        setHighlightedSection(null);
        highlightTimerRef.current = null;
      }, 1800);
    }

    if (payload?.vendor) {
      setVendor(payload.vendor);
    } else {
      void loadVendor();
    }

    toast({
      title: "Saved",
      description: "Back to dashboard.",
    });
  };

  return (
    <div className="dashboard-neon pb-6 relative">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_hsl(var(--festival-teal)_/_0.14),_transparent_60%)]" />
      <div className="absolute -top-24 right-8 h-72 w-72 rounded-full bg-cyan-400/25 blur-3xl" />
      <div className="absolute bottom-16 left-8 h-80 w-80 rounded-full bg-festival-teal/25 blur-3xl" />

      <div className="relative z-10 pt-16 px-2.5">
        <div className="max-w-6xl mx-auto space-y-3">
          <div className="flex items-end justify-between gap-2">
            <div className="space-y-0.5 min-w-0">
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Sparkles className="w-4 h-4" />
                Vendor dashboard
              </div>
              <h1 className="text-xl sm:text-2xl dash-display line-clamp-1">Grow your storefront</h1>
            </div>
          </div>

          <Card className="dashboard-card border-festival-teal/35 shadow-md">
            <CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-muted-foreground">Core steps: {coreStepsCompletedCount}/{coreStepChecks.length}</span>
                </div>
                <Button size="sm" className="h-7 text-[11px] px-2.5 shadow-md hover:shadow-lg focus-visible:ring-2 focus-visible:ring-primary/60 transition-all" onClick={() => openEditor(nextStepAction.section)}>
                  {nextStepAction.cta}
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                Name: {vendor?.business_name || "Not set"} • City: {vendor?.city || "Not set"}
              </p>
            </CardContent>
          </Card>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as DashboardTab)} className="space-y-3">
            <TabsList className="grid w-full grid-cols-4 h-9 border border-festival-teal/30 bg-background/60">
              <TabsTrigger value="growth" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Growth</TabsTrigger>
              <TabsTrigger value="catalog" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Catalog</TabsTrigger>
              <TabsTrigger value="presence" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Presence</TabsTrigger>
              <TabsTrigger value="operations" className="text-[11px] data-[state=active]:bg-festival-teal/20 data-[state=active]:text-foreground">Operations</TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">
              <span className="font-medium text-foreground">{tabPurpose[activeTab].title}:</span> {tabPurpose[activeTab].description}
            </p>

            <TabsContent value="growth" className="m-0">
              <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                {renderRequirementTiles("growth")}
              </div>
            </TabsContent>

            <TabsContent value="catalog" className="m-0">
              <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                {renderRequirementTiles("catalog")}
              </div>
            </TabsContent>

            <TabsContent value="presence" className="m-0">
              <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                {renderRequirementTiles("presence")}
              </div>
            </TabsContent>

            <TabsContent value="operations" className="m-0">
              <div className="grid grid-cols-4 sm:grid-cols-8 lg:grid-cols-12 auto-rows-[minmax(84px,auto)] gap-1.5 sm:gap-2">
                {renderRequirementTiles("operations")}
              </div>
            </TabsContent>
          </Tabs>
        </div>
      </div>

      <Dialog
        open={Boolean(editingSection)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingSection(null);
            setEditingProfileFocus(null);
          }
        }}
      >
        <DialogContent
          overlayClassName="bg-black/50"
          className="max-w-5xl w-[95vw] max-h-[90vh] overflow-y-auto p-4 sm:p-6"
        >
          <DialogHeader className="pb-1">
            <DialogTitle className="dash-display">Edit section</DialogTitle>
            <DialogDescription>
              Update {activeEditSection} and save.
            </DialogDescription>
          </DialogHeader>
          <VendorDashboardPage
            embedded
            forcedSection={activeEditSection}
            profileFocus={editingProfileFocus}
            onSaved={handlePopupSaved}
            onProgressChange={setSectionProgressOverride}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};
