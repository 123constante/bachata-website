import { useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarDays, Globe, MapPin, Store } from "lucide-react";
import { useVendorDirectory } from "@/hooks/vendor/useVendorDirectory";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { normalizeStringArray } from "@/modules/vendor/utils";
import GlobalLayout from "@/components/layout/GlobalLayout";

const PAGE_SIZE = 12;
const FALLBACK_IMAGE = "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=1200&auto=format&fit=crop&q=80";

const Vendors = () => {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [city, setCity] = useState("");
  const [category, setCategory] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const cityInputRef = useRef<HTMLInputElement | null>(null);
  const categoryInputRef = useRef<HTMLInputElement | null>(null);

  const { vendors, total, loading, error } = useVendorDirectory({
    page,
    pageSize: PAGE_SIZE,
    search,
    city,
    category,
  });

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const categorySuggestions = useMemo(() => {
    const all = vendors.flatMap((item) => item.product_categories || []);
    return Array.from(new Set(all)).slice(0, 8);
  }, [vendors]);

  const applyFilters = () => {
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setCity("");
    setCategory("");
    setPage(1);
  };

  return (
    <GlobalLayout
      breadcrumbs={[{ label: 'Vendors' }]}
      hero={{
        emoji: '🛍️',
        titleWhite: 'Bachata',
        titleOrange: 'Vendors',
        subtitle: 'Trusted shops, services, and products for dancers',
        largeTitle: true,
      }}
    >
      <div className="max-w-6xl mx-auto px-4 pb-24 space-y-6">
        <Card>
          <CardContent className="pt-6 grid gap-3 md:grid-cols-[1.4fr_1fr_1fr_auto]">
            <Input
              ref={searchInputRef}
              placeholder="Search by business name"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Input
              ref={cityInputRef}
              placeholder="Filter by city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
            />
            <Input
              ref={categoryInputRef}
              placeholder="Filter by category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
            <div className="flex gap-2">
              <Button onClick={applyFilters}>Apply</Button>
              <Button variant="outline" onClick={clearFilters}>Reset</Button>
            </div>

            {(search.trim() || city.trim() || category.trim()) && (
              <div className="md:col-span-4 flex flex-wrap gap-2 pt-1">
                {search.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      searchInputRef.current?.focus();
                      searchInputRef.current?.select();
                    }}
                  >
                    {search.trim()}
                  </Button>
                )}
                {city.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      cityInputRef.current?.focus();
                      cityInputRef.current?.select();
                    }}
                  >
                    {city.trim()}
                  </Button>
                )}
                {category.trim() && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      categoryInputRef.current?.focus();
                      categoryInputRef.current?.select();
                    }}
                  >
                    {category.trim()}
                  </Button>
                )}
              </div>
            )}

            {categorySuggestions.length > 0 && (
              <div className="md:col-span-4 flex flex-wrap gap-2 pt-1">
                {categorySuggestions.map((suggestion) => (
                  <Button
                    type="button"
                    key={suggestion}
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setCategory(suggestion);
                      setPage(1);
                    }}
                  >
                    {suggestion}
                  </Button>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {loading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <Card key={index}>
                <CardContent className="p-0">
                  <Skeleton className="h-44 w-full rounded-b-none" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-5 w-3/5" />
                    <Skeleton className="h-4 w-2/5" />
                    <Skeleton className="h-4 w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : error ? (
          <Card>
            <CardContent className="pt-6 text-center text-destructive">{error}</CardContent>
          </Card>
        ) : vendors.length === 0 ? (
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              No vendors found for the current filters.
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {vendors.map((vendor) => {
              const primaryImage = vendor.photo_url?.[0] || FALLBACK_IMAGE;
              const location = [vendor.cities?.name].filter(Boolean).join(", ");
              const vendorName = vendor.business_name || "Untitled vendor";
              const upcomingEventCount = normalizeStringArray(vendor.upcoming_events).length;

              return (
                <Card
                  key={vendor.id}
                  className="h-full overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  role="link"
                  tabIndex={0}
                  onClick={() => navigate(`/vendors/${vendor.id}`)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      navigate(`/vendors/${vendor.id}`);
                    }
                  }}
                >
                  <CardContent className="p-0 h-full">
                    <div className="h-44 w-full bg-muted/60 overflow-hidden">
                      <img
                        src={primaryImage}
                        alt={vendorName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-4 space-y-3">
                      <h2 className="font-semibold text-lg line-clamp-1">
                        <Link
                          to={`/vendors/${vendor.id}`}
                          className="hover:underline"
                          onClick={(event) => event.stopPropagation()}
                        >
                          {vendorName}
                        </Link>
                      </h2>

                      <div className="text-sm text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-4 w-4" />
                        {vendor.cities?.name ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCity(vendor.cities?.name || "");
                              setPage(1);
                            }}
                          >
                            {vendor.cities?.name}
                          </Button>
                        ) : (
                          <span>{location || "Location not specified"}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {(vendor.product_categories || []).slice(0, 4).map((cat) => (
                          <Button
                            key={cat}
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={(event) => {
                              event.stopPropagation();
                              setCategory(cat);
                              setPage(1);
                            }}
                          >
                            {cat}
                          </Button>
                        ))}
                        {(vendor.product_categories || []).length === 0 && (
                          <Badge variant="outline" className="text-xs">
                            <Store className="h-3 w-3 mr-1" />
                            No categories
                          </Badge>
                        )}
                      </div>

                      <div className="flex items-center justify-between gap-2">
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="outline" className="text-xs">
                            <CalendarDays className="h-3 w-3 mr-1" />
                            {upcomingEventCount} upcoming {upcomingEventCount === 1 ? "event" : "events"}
                          </Badge>
                          <Badge variant="outline" className="text-xs">
                            <Globe className="h-3 w-3 mr-1" />
                            {vendor.ships_international ? "Ships international" : "Local shipping"}
                          </Badge>
                        </div>
                        <Button
                          size="sm"
                          onClick={(event) => {
                            event.stopPropagation();
                            navigate(`/vendors/${vendor.id}?tab=products`);
                          }}
                        >
                          Browse products
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {pageCount}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" disabled={page <= 1 || loading} onClick={() => setPage((prev) => prev - 1)}>
              Previous
            </Button>
            <Button variant="outline" disabled={page >= pageCount || loading} onClick={() => setPage((prev) => prev + 1)}>
              Next
            </Button>
          </div>
        </div>
      </div>
    </GlobalLayout>
  );
};

export default Vendors;
