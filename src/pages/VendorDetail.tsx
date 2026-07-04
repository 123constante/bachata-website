import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { emitProfileView } from "@/lib/profileViewEmit";
import { ArrowLeft, CalendarDays, Facebook, Globe, Instagram, Mail, MessageCircle, Package, Store, Tag, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { VendorPublicDetail } from "@/modules/vendor/types";
import { normalizeLink, normalizeProducts } from "@/modules/vendor/utils";
import { recordVendorLinkClick, type VendorLinkType } from "@/lib/vendorLinkClicks";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileEventTimeline from "@/components/profile/ProfileEventTimeline";
import GlobalLayout from "@/components/layout/GlobalLayout";

import { useSeo, buildSeoForRoute } from '@/lib/seo';
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&auto=format&fit=crop&q=80";

type EventLinkItem = {
  id: string;
  name: string;
};

type TeamLinkItem = {
  dancerId: string | null;
  name: string;
  city: string | null;
  isLeader: boolean;
  role: string | null;
  avatarUrl: string | null;
};

type ViewTab = "overview" | "products" | "faq";

const tabValues: ViewTab[] = ["overview", "products", "faq"];

const VendorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<VendorPublicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventItems, setEventItems] = useState<EventLinkItem[]>([]);
  const [activeTab, setActiveTab] = useState<ViewTab>("overview");
  const [promoCopied, setPromoCopied] = useState(false);

  useEffect(() => {
    const fetchVendor = async () => {
      if (!id) {
        setError("Vendor id is required.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);

      const { data, error: fetchError } = await supabase.rpc(
        "get_public_vendor_detail_v1",
        { p_id: id },
      );

      if (fetchError) {
        setError(fetchError.message || "Failed to load vendor.");
        setVendor(null);
      } else if (!data || (Array.isArray(data) && data.length === 0)) {
        setError("Vendor not found.");
        setVendor(null);
      } else {
        const row = (Array.isArray(data) ? data[0] : data) as VendorPublicDetail;
        setVendor(row);
      }

      setLoading(false);
    };

    void fetchVendor();
  }, [id]);


  useEffect(() => {
    const loadEventItems = async () => {
      const eventIds = (vendor?.upcoming_events || []).filter(
        (eventId): eventId is string => typeof eventId === "string" && eventId.length > 0,
      );
      if (eventIds.length === 0) {
        setEventItems([]);
        return;
      }

      const { data, error: eventsError } = await supabase
        .from("events")
        .select("id, name")
        .in("id", eventIds);

      if (eventsError || !Array.isArray(data)) {
        setEventItems(eventIds.map((eventId) => ({ id: eventId, name: eventId })));
        return;
      }

      const mapped = data
        .filter((item: any) => item?.id)
        .map((item: any) => ({
          id: String(item.id),
          name: typeof item.name === "string" && item.name.trim().length > 0 ? item.name.trim() : String(item.id),
        }));

      const mapById = new Map(mapped.map((item) => [item.id, item]));
      setEventItems(eventIds.map((eventId) => mapById.get(eventId) || { id: eventId, name: eventId }));
    };

    void loadEventItems();
  }, [vendor?.upcoming_events]);

  const products = useMemo(() => normalizeProducts(vendor?.products), [vendor]);
  const gallery = useMemo(() => {
    if (!vendor) return [];
    const productImages = products
      .map((product) => (product.image_url || "").trim())
      .filter(Boolean);
    const heroImage = vendor.photo_url ? [vendor.photo_url] : [];
    const all = [...heroImage, ...(vendor.gallery_urls || []), ...productImages];
    return Array.from(new Set(all.filter(Boolean)));
  }, [vendor, products]);
  const cityLabel = vendor?.city || "";
  const categoryItems = useMemo(() => vendor?.product_categories || [], [vendor?.product_categories]);
  const teamItems = useMemo<TeamLinkItem[]>(() => {
    if (!Array.isArray(vendor?.team)) return [];

    return (vendor.team as any[])
      .map((member) => {
        if (!member || typeof member !== "object") return null;
        const record = member as Record<string, unknown>;
        const dancerIdRaw = record.dancer_id;
        const dancerId = dancerIdRaw === null || dancerIdRaw === undefined ? null : String(dancerIdRaw);
        const name = typeof record.name === "string" && record.name.trim().length > 0 ? record.name.trim() : "Team member";
        const city = typeof record.city === "string" && record.city.trim().length > 0 ? record.city.trim() : null;
        const isLeader = Boolean(record.is_leader);
        const role = typeof record.role === "string" && record.role.trim().length > 0 ? record.role.trim() : null;
        const avatarUrl = typeof record.avatar_url === "string" && record.avatar_url.trim().length > 0 ? record.avatar_url.trim() : null;

        return { dancerId, name, city, isLeader, role, avatarUrl } satisfies TeamLinkItem;
      })
      .filter((item): item is TeamLinkItem => Boolean(item));
  }, [vendor?.team]);
  const whatsappHref = vendor?.whatsapp?.trim()
    ? `https://wa.me/${vendor.whatsapp.replace(/[^\d]/g, "")}`
    : null;
  const contactActions = useMemo(() => {
    const actions: Array<{ label: string; href: string; external?: boolean; linkType: VendorLinkType }> = [];
    if (vendor?.website) {
      actions.push({ label: "Website", href: normalizeLink(vendor.website), external: true, linkType: "website" });
    }
    if (vendor?.instagram) {
      actions.push({ label: "Instagram", href: normalizeLink(vendor.instagram), external: true, linkType: "instagram" });
    }
    if (vendor?.facebook) {
      actions.push({ label: "Facebook", href: normalizeLink(vendor.facebook), external: true, linkType: "facebook" });
    }
    if (vendor?.public_email) {
      actions.push({ label: "Email", href: `mailto:${vendor.public_email}`, linkType: "public_email" });
    }
    if (whatsappHref) {
      actions.push({ label: "WhatsApp", href: whatsappHref, external: true, linkType: "whatsapp" });
    }
    return actions;
  }, [vendor?.website, vendor?.instagram, vendor?.facebook, vendor?.public_email, whatsappHref]);
  const websiteLabel = useMemo(() => {
    if (!vendor?.website) return null;
    const normalized = normalizeLink(vendor.website);
    try {
      return new URL(normalized).hostname.replace(/^www\./, "");
    } catch {
      return normalized.replace(/^https?:\/\//, "");
    }
  }, [vendor?.website]);
  const upcomingEventCount = eventItems.length;

  const copyPromoCode = async () => {
    if (!vendor?.promo_code || !navigator?.clipboard) return;
    try {
      await navigator.clipboard.writeText(vendor.promo_code);
      setPromoCopied(true);
      recordVendorLinkClick({
        vendorId: vendor.id,
        linkType: "promo_copy",
        targetUrl: vendor.promo_code,
        source: "vendor-detail:promo-copy",
      });
      window.setTimeout(() => setPromoCopied(false), 1500);
    } catch {
      setPromoCopied(false);
    }
  };

  const trackOutbound = (linkType: VendorLinkType, targetUrl: string | null | undefined, source: string) => {
    if (!vendor?.id) return;
    recordVendorLinkClick({
      vendorId: vendor.id,
      linkType,
      targetUrl: targetUrl ?? null,
      source,
    });
  };
  useSeo(
    buildSeoForRoute('vendor.detail', {
      // Fallback so a live vendor with a blank business_name stays indexable
      // (the broadened noindex rule keys off entityName being falsy). Mirrors the
      // 'Vendor' fallback the SPEC title/description already use.
      entityName: vendor?.business_name || 'Vendor',
      entitySlug: id ?? undefined,
      ogImage: vendor?.avatar_url ?? undefined,
      isLoading: loading,
    }),
  );


  if (loading) {
    return (
      <GlobalLayout
        showSubheader={false}
        backHref="/vendors"
        hero={{
          emoji: '🛍️',
          titleWhite: '',
          titleOrange: 'Vendor',
          largeTitle: true,
        }}
      >
        <div className="max-w-5xl mx-auto px-4 pb-24 space-y-4">
          <Skeleton className="h-72 w-full" />
        </div>
      </GlobalLayout>
    );
  }

  if (error || !vendor) {
    return (
      <GlobalLayout
        showSubheader={false}
        backHref="/vendors"
        hero={{
          emoji: '🛍️',
          titleWhite: 'Vendor',
          titleOrange: 'unavailable',
          largeTitle: true,
        }}
      >
        <div className="max-w-4xl mx-auto px-4 pb-24 text-center space-y-4">
          <p className="text-muted-foreground">{error || "Could not load this vendor."}</p>
          <Button variant="outline" onClick={() => navigate("/vendors")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to vendors
          </Button>
        </div>
      </GlobalLayout>
    );
  }

  const vendorSubtitle = cityLabel || '';

  return (
    <GlobalLayout
      showSubheader={false}
      backHref="/vendors"
      hero={{
        emoji: '🛍️',
        titleWhite: vendor.business_name || '',
        titleOrange: 'Vendor',
        subtitle: vendorSubtitle,
        largeTitle: true,
      }}
    >
      <div className="max-w-6xl mx-auto px-4 pb-24 space-y-4">
        <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {categoryItems.slice(0, 5).map((category) => (
                <Link key={category} to={`/vendors?category=${encodeURIComponent(category)}`}>
                  <Badge variant="secondary">{category}</Badge>
                </Link>
              ))}
              {categoryItems.length === 0 && (
                <Badge variant="outline">
                  <Store className="h-3 w-3 mr-1" />
                  No categories
                </Badge>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Products</p>
                  <p className="text-lg font-semibold">{products.length}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Events</p>
                  <p className="text-lg font-semibold">{upcomingEventCount}</p>
                </CardContent>
              </Card>
              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">Team</p>
                  <p className="text-lg font-semibold">{teamItems.length}</p>
                </CardContent>
              </Card>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button onClick={() => setActiveTab("products")} className="gap-2">
                <Package className="h-4 w-4" />
                Browse products
              </Button>
              {contactActions.slice(0, 2).map((action) => (
                <a
                  key={action.label}
                  href={action.href}
                  target={action.external ? "_blank" : undefined}
                  rel={action.external ? "noreferrer" : undefined}
                  onClick={() => trackOutbound(action.linkType, action.href, "vendor-detail:hero")}
                >
                  <Button variant="outline" size="sm" className="gap-2">
                    {action.label === "Website" && <Globe className="h-4 w-4" />}
                    {action.label === "Instagram" && <Instagram className="h-4 w-4" />}
                    {action.label === "Facebook" && <Facebook className="h-4 w-4" />}
                    {action.label === "Email" && <Mail className="h-4 w-4" />}
                    {action.label === "WhatsApp" && <MessageCircle className="h-4 w-4" />}
                    {action.label}
                  </Button>
                </a>
              ))}
            </div>
          </div>

          <div className="rounded-lg overflow-hidden bg-muted/60 min-h-[240px]">
            <img
              src={gallery[0] || FALLBACK_IMAGE}
              alt={vendor.business_name || "Vendor"}
              className="h-full w-full object-cover" loading="lazy"/>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              Events they&apos;re attending
            </h2>
            {eventItems.length === 0 ? (
              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">No upcoming events listed yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {eventItems.map((event) => (
                  <Link key={event.id} to={`/event/${event.id}`}>
                    <Button variant="outline" className="w-full justify-start text-left gap-3 h-auto p-3">
                      <CalendarDays className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span className="text-sm font-medium">{event.name}</span>
                    </Button>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Users className="h-5 w-5" />
              Team members
            </h2>
            {teamItems.length === 0 ? (
              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="p-4">
                  <p className="text-sm text-muted-foreground">No team members listed.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {teamItems.map((member, index) => {
                  const roleLabel = member.isLeader
                    ? "Leader"
                    : member.role && member.role !== "Member"
                    ? member.role
                    : null;
                  const memberContent = (
                    <Card className="bg-white/[0.04] border-white/10 h-full hover:border-white/20 hover:bg-white/[0.06] transition-colors">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center gap-2">
                          {member.avatarUrl ? (
                            <img
                              src={member.avatarUrl}
                              alt=""
                              aria-hidden
                              className="h-5 w-5 rounded-full object-cover flex-shrink-0" loading="lazy"/>
                          ) : (
                            <Users className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          )}
                          <span className="text-sm font-medium truncate">{member.name}</span>
                        </div>
                        {roleLabel && (
                          <p className="text-xs text-muted-foreground">{roleLabel}</p>
                        )}
                        {member.city && (
                          <p className="text-xs text-muted-foreground">{member.city}</p>
                        )}
                      </CardContent>
                    </Card>
                  );
                  return member.dancerId ? (
                    <Link
                      key={`${member.name}-${index}`}
                      to={`/dancers/${member.dancerId}`}
                      onClick={() => {
                        emitProfileView({
                          personId: member.dancerId!,
                          profileType: "dancer",
                          context: "vendor-detail:team",
                        });
                      }}
                    >
                      {memberContent}
                    </Link>
                  ) : (
                    <div key={`${member.name}-${index}`}>
                      {memberContent}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ViewTab)} className="space-y-4">
          <TabsList className="grid w-full grid-cols-3 h-10 bg-white/[0.04] border border-white/10">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="products">Products</TabsTrigger>
            <TabsTrigger value="faq">FAQ & Contact</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="m-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="pt-6 space-y-3">
                  <h3 className="text-base font-semibold">Categories</h3>
                  {categoryItems.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Categories being updated.</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {categoryItems.map((category) => (
                        <Link key={`overview-${category}`} to={`/vendors?category=${encodeURIComponent(category)}`}>
                          <Badge variant="outline" className="gap-1">
                            <Tag className="h-3 w-3" />
                            {category}
                          </Badge>
                        </Link>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="pt-6 space-y-3">
                  <h3 className="text-base font-semibold">Shipping</h3>
                  <p className="text-sm text-muted-foreground">
                    {vendor.ships_international ? "International shipping available" : "Local only"}
                  </p>
                </CardContent>
              </Card>
            </div>

            {vendor.promo_code && (
              <Card className="bg-white/[0.04] border-primary/30">
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Promo code</p>
                    <p className="font-semibold text-lg inline-flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      {vendor.promo_code}
                    </p>
                  </div>
                  <Button variant="outline" size="sm" onClick={copyPromoCode}>
                    {promoCopied ? "Copied" : "Copy"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="products" className="m-0 space-y-4">
            {products.length === 0 ? (
              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="pt-6 text-sm text-muted-foreground">No products listed yet.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product, index) => (
                  <Card key={`${product.name}-${index}`} className="bg-white/[0.04] border-white/10 h-full hover:border-white/20 hover:bg-white/[0.06] transition-colors">
                    <CardContent className="pt-4 space-y-3 h-full flex flex-col">
                      <div className="flex-1">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <h3 className="font-medium text-sm leading-snug">{product.name}</h3>
                          {typeof product.price === "number" && (
                            <Badge variant="outline" className="text-xs">£{product.price}</Badge>
                          )}
                        </div>

                        {product.image_url && (
                          <div className="rounded-md overflow-hidden bg-muted h-32 mb-3">
                            <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" loading="lazy"/>
                          </div>
                        )}

                        {product.description && (
                          <p className="text-xs text-muted-foreground whitespace-pre-wrap line-clamp-3">{product.description}</p>
                        )}
                      </div>

                      {product.image_url && (
                        <a href={normalizeLink(product.image_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                          View media
                          <Globe className="h-3 w-3" />
                        </a>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="faq" className="m-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="text-base font-semibold">FAQ</h3>
                  {vendor.faq ? (
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{vendor.faq}</p>
                  ) : (
                    <p className="text-sm text-muted-foreground">No FAQ provided yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card className="bg-white/[0.04] border-white/10">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="text-base font-semibold">Contact</h3>
                  {contactActions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Contact methods not added yet.</p>
                  ) : (
                    <div className="flex flex-col gap-2">
                      {contactActions.map((action) => (
                        <a
                          key={action.label}
                          href={action.href}
                          target={action.external ? "_blank" : undefined}
                          rel={action.external ? "noreferrer" : undefined}
                          onClick={() => trackOutbound(action.linkType, action.href, "vendor-detail:faq-contact")}
                        >
                          <Button variant="outline" className="w-full gap-2 text-xs h-9">
                            {action.label === "Website" && <Globe className="h-3.5 w-3.5" />}
                            {action.label === "Instagram" && <Instagram className="h-3.5 w-3.5" />}
                            {action.label === "Facebook" && <Facebook className="h-3.5 w-3.5" />}
                            {action.label === "Email" && <Mail className="h-3.5 w-3.5" />}
                            {action.label === "WhatsApp" && <MessageCircle className="h-3.5 w-3.5" />}
                            {action.label}
                          </Button>
                        </a>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </GlobalLayout>
  );
};

export default VendorDetail;
