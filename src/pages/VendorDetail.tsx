import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, CalendarDays, Facebook, Globe, Instagram, Mail, MapPin, MessageCircle, Package, Store, Tag, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { VendorPublicDetail } from "@/modules/vendor/types";
import { normalizeLink, normalizeProducts, normalizeStringArray } from "@/modules/vendor/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import ProfileEventTimeline from "@/components/profile/ProfileEventTimeline";

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
};

type VendorTab = "overview" | "products" | "events" | "about";

const tabValues: VendorTab[] = ["overview", "products", "events", "about"];

const getInitialTab = (queryString: string): VendorTab => {
  const candidate = new URLSearchParams(queryString).get("tab");
  if (candidate && tabValues.includes(candidate as VendorTab)) {
    return candidate as VendorTab;
  }

  return "overview";
};

const VendorDetail = () => {
  const { id } = useParams<{ id: string }>();
  const location = useLocation();
  const navigate = useNavigate();
  const [vendor, setVendor] = useState<VendorPublicDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [eventItems, setEventItems] = useState<EventLinkItem[]>([]);
  const [activeTab, setActiveTab] = useState<VendorTab>(() => getInitialTab(location.search));
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

      const { data, error: fetchError } = await supabase
        .from("vendors")
        .select(
          "id, business_name, city_id, cities(name), photo_url, product_categories, products, faq, public_email, whatsapp, promo_code, upcoming_events, ships_international, team, website, instagram, facebook",
        )
        .eq("id", id)
        .maybeSingle();

      if (fetchError) {
        setError(fetchError.message || "Failed to load vendor.");
        setVendor(null);
      } else if (!data) {
        setError("Vendor not found.");
        setVendor(null);
      } else {
        setVendor(data as VendorPublicDetail);
      }

      setLoading(false);
    };

    void fetchVendor();
  }, [id]);

  useEffect(() => {
    setActiveTab(getInitialTab(location.search));
  }, [location.search]);

  useEffect(() => {
    const loadEventItems = async () => {
      const eventIds = normalizeStringArray(vendor?.upcoming_events);
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
    const all = [...normalizeStringArray(vendor.photo_url), ...productImages];
    return Array.from(new Set(all));
  }, [vendor, products]);
  const cityLabel = [vendor?.cities?.name].filter(Boolean).join(", ");
  const categoryItems = useMemo(() => normalizeStringArray(vendor?.product_categories), [vendor?.product_categories]);
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

        return { dancerId, name, city, isLeader } satisfies TeamLinkItem;
      })
      .filter((item): item is TeamLinkItem => Boolean(item));
  }, [vendor?.team]);
  const whatsappHref = vendor?.whatsapp?.trim()
    ? `https://wa.me/${vendor.whatsapp.replace(/[^\d]/g, "")}`
    : null;
  const contactActions = useMemo(() => {
    const actions: Array<{ label: string; href: string; external?: boolean }> = [];
    if (vendor?.website) {
      actions.push({ label: "Website", href: normalizeLink(vendor.website), external: true });
    }
    if (vendor?.instagram) {
      actions.push({ label: "Instagram", href: normalizeLink(vendor.instagram), external: true });
    }
    if (vendor?.facebook) {
      actions.push({ label: "Facebook", href: normalizeLink(vendor.facebook), external: true });
    }
    if (vendor?.public_email) {
      actions.push({ label: "Email", href: `mailto:${vendor.public_email}` });
    }
    if (whatsappHref) {
      actions.push({ label: "WhatsApp", href: whatsappHref, external: true });
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
      window.setTimeout(() => setPromoCopied(false), 1500);
    } catch {
      setPromoCopied(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-[100px] px-4 pb-24">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-72 w-full" />
        </div>
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div className="min-h-screen pt-[100px] px-4 pb-24">
        <div className="max-w-4xl mx-auto text-center space-y-4">
          <h1 className="text-2xl font-semibold">Vendor unavailable</h1>
          <p className="text-muted-foreground">{error || "Could not load this vendor."}</p>
          <Button variant="outline" onClick={() => navigate("/vendors")}>
            Back to vendors
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-[95px] px-4 pb-24">
      <div className="max-w-6xl mx-auto space-y-6">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>

        <Card className="border-primary/20 bg-gradient-to-br from-background via-background to-muted/40">
          <CardContent className="pt-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
            <div className="space-y-5">
              <div className="space-y-3">
                <h1 className="text-3xl font-bold tracking-tight">{vendor.business_name || "Vendor"}</h1>
                <p className="text-muted-foreground flex items-center gap-1">
                  <MapPin className="h-4 w-4" />
                  {cityLabel || "Location not specified"}
                </p>
                <div className="flex flex-wrap gap-2">
                  {categoryItems.slice(0, 5).map((category) => (
                    <Link key={category} to={`/vendors?category=${encodeURIComponent(category)}`}>
                      <Badge variant="secondary">{category}</Badge>
                    </Link>
                  ))}
                  {categoryItems.length === 0 && (
                    <Badge variant="outline">
                      <Store className="h-3 w-3 mr-1" />
                      No categories listed
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Products</p>
                    <p className="text-xl font-semibold">{products.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Upcoming events</p>
                    <p className="text-xl font-semibold">{upcomingEventCount}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Team members</p>
                    <p className="text-xl font-semibold">{teamItems.length}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-3">
                    <p className="text-xs text-muted-foreground">Shipping</p>
                    <p className="text-sm font-semibold">{vendor.ships_international ? "International" : "Local only"}</p>
                  </CardContent>
                </Card>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button onClick={() => setActiveTab("products")} className="gap-2">
                  <Package className="h-4 w-4" />
                  Browse products/menu
                </Button>
                {contactActions.map((action) => (
                  <a
                    key={action.label}
                    href={action.href}
                    target={action.external ? "_blank" : undefined}
                    rel={action.external ? "noreferrer" : undefined}
                  >
                    <Button variant="outline" className="gap-2">
                      {action.label}
                    </Button>
                  </a>
                ))}
              </div>

              {vendor.promo_code && (
                <p className="text-xs text-muted-foreground">
                  Promo available in the Products tab.
                </p>
              )}
            </div>

            <div className="rounded-lg overflow-hidden bg-muted/60 min-h-[240px]">
              <img
                src={gallery[0] || FALLBACK_IMAGE}
                alt={vendor.business_name || "Vendor"}
                className="h-full w-full object-cover"
              />
            </div>
          </CardContent>
        </Card>

        <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as VendorTab)} className="space-y-4">
          <div className="sticky top-[84px] z-20">
            <TabsList className="grid w-full grid-cols-4 h-10 bg-background/90 backdrop-blur border border-border/70">
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="products">Products</TabsTrigger>
              <TabsTrigger value="events">Events</TabsTrigger>
              <TabsTrigger value="about">About & FAQ</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="overview" className="m-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="lg:col-span-2">
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-xl font-semibold">Highlights</h2>
                  <div className="flex flex-wrap gap-2">
                    {categoryItems.map((category) => (
                      <Link key={`overview-${category}`} to={`/vendors?category=${encodeURIComponent(category)}`}>
                        <Badge variant="outline" className="gap-1">
                          <Tag className="h-3 w-3" />
                          {category}
                        </Badge>
                      </Link>
                    ))}
                    {categoryItems.length === 0 && <p className="text-sm text-muted-foreground">Categories are being updated.</p>}
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Button variant="outline" className="justify-start" onClick={() => setActiveTab("products")}>
                      <Package className="h-4 w-4 mr-2" />
                      Browse full catalog
                    </Button>
                    <Button variant="outline" className="justify-start" onClick={() => setActiveTab("events")}>
                      <CalendarDays className="h-4 w-4 mr-2" />
                      View upcoming events
                    </Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-3">
                  <h2 className="text-lg font-semibold">Quick links</h2>
                  <div className="space-y-2">
                    {vendor.website && (
                      <a href={normalizeLink(vendor.website)} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                        <Globe className="h-4 w-4" />
                        {websiteLabel || "Website"}
                      </a>
                    )}
                    {vendor.instagram && (
                      <a href={normalizeLink(vendor.instagram)} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                        <Instagram className="h-4 w-4" />
                        Instagram
                      </a>
                    )}
                    {vendor.facebook && (
                      <a href={normalizeLink(vendor.facebook)} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
                        <Facebook className="h-4 w-4" />
                        Facebook
                      </a>
                    )}
                    {!vendor.website && !vendor.instagram && !vendor.facebook && (
                      <p className="text-sm text-muted-foreground">Public links not added yet.</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="products" className="m-0 space-y-4">
            {vendor.promo_code && (
              <Card className="border-primary/30">
                <CardContent className="pt-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Promo code</p>
                    <p className="font-semibold text-lg inline-flex items-center gap-2">
                      <Tag className="h-4 w-4" />
                      {vendor.promo_code}
                    </p>
                  </div>
                  <Button variant="outline" onClick={copyPromoCode}>
                    {promoCopied ? "Copied" : "Copy code"}
                  </Button>
                </CardContent>
              </Card>
            )}

            {products.length === 0 ? (
              <Card>
                <CardContent className="pt-6 text-muted-foreground">No products listed yet.</CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {products.map((product, index) => (
                  <Card key={`${product.name}-${index}`} className="h-full">
                    <CardContent className="pt-6 space-y-3 h-full">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="font-medium leading-snug">{product.name}</h3>
                        {typeof product.price === "number" && (
                          <Badge variant="outline">£{product.price}</Badge>
                        )}
                      </div>

                      {product.image_url && (
                        <div className="rounded-md overflow-hidden bg-muted h-36">
                          <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                        </div>
                      )}

                      {product.description && (
                        <p className="text-sm text-muted-foreground whitespace-pre-wrap">{product.description}</p>
                      )}

                      {product.image_url && (
                        <a href={normalizeLink(product.image_url)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
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

          <TabsContent value="events" className="m-0 space-y-4">
            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-xl font-semibold">Upcoming Events</h2>
                {eventItems.length === 0 ? (
                  <p className="text-muted-foreground">No upcoming events listed yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {eventItems.map((event) => (
                      <Link key={event.id} to={`/event/${event.id}`}>
                        <Button variant="outline" size="sm" className="gap-2">
                          <CalendarDays className="h-4 w-4" />
                          {event.name}
                        </Button>
                      </Link>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <ProfileEventTimeline
              personType="vendor"
              personId={vendor.id}
              title="Event timeline"
              emptyText="No connected events yet."
            />
          </TabsContent>

          <TabsContent value="about" className="m-0 space-y-4">
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h2 className="text-xl font-semibold">FAQ</h2>
                  {vendor.faq ? (
                    <p className="text-sm whitespace-pre-wrap text-muted-foreground">{vendor.faq}</p>
                  ) : (
                    <p className="text-muted-foreground">No FAQ provided yet.</p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardContent className="pt-6 space-y-4">
                  <h2 className="text-xl font-semibold">Team</h2>
                  {teamItems.length === 0 ? (
                    <p className="text-muted-foreground">No team members listed.</p>
                  ) : (
                    <div className="space-y-2">
                      {teamItems.map((member, index) => {
                        const href = member.dancerId ? `/dancers/${member.dancerId}` : "/dancers";
                        return (
                          <Link key={`${member.name}-${index}`} to={href} className="inline-flex">
                            <Button variant="outline" size="sm" className="gap-2">
                              <Users className="h-4 w-4" />
                              {member.name}{member.isLeader ? " (Leader)" : ""}
                            </Button>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            <Card>
              <CardContent className="pt-6 space-y-3">
                <h2 className="text-xl font-semibold">Contact</h2>
                <div className="flex flex-wrap gap-2">
                  {vendor.website && (
                    <a href={normalizeLink(vendor.website)} target="_blank" rel="noreferrer">
                      <Button variant="outline" className="gap-2">
                        <Globe className="h-4 w-4" />
                        Website
                      </Button>
                    </a>
                  )}
                  {vendor.instagram && (
                    <a href={normalizeLink(vendor.instagram)} target="_blank" rel="noreferrer">
                      <Button variant="outline" className="gap-2">
                        <Instagram className="h-4 w-4" />
                        Instagram
                      </Button>
                    </a>
                  )}
                  {vendor.facebook && (
                    <a href={normalizeLink(vendor.facebook)} target="_blank" rel="noreferrer">
                      <Button variant="outline" className="gap-2">
                        <Facebook className="h-4 w-4" />
                        Facebook
                      </Button>
                    </a>
                  )}
                  {vendor.public_email && (
                    <a href={`mailto:${vendor.public_email}`}>
                      <Button variant="outline" className="gap-2">
                        <Mail className="h-4 w-4" />
                        Email
                      </Button>
                    </a>
                  )}
                  {whatsappHref && (
                    <a href={whatsappHref} target="_blank" rel="noreferrer">
                      <Button variant="outline" className="gap-2">
                        <MessageCircle className="h-4 w-4" />
                        WhatsApp
                      </Button>
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default VendorDetail;
