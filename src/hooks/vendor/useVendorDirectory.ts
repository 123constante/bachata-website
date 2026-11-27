import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { VendorPublicCard } from "@/modules/vendor/types";

type UseVendorDirectoryParams = {
  page: number;
  pageSize: number;
  search: string;
  city: string;
  category: string;
};

type UseVendorDirectoryResult = {
  vendors: VendorPublicCard[];
  total: number;
  loading: boolean;
  error: string | null;
};

// The one public vendor-directory read; shared with the server list loader.
export const fetchVendorDirectoryRpc = (args: {
  query: string | null;
  cityId: string | null;
  category: string | null;
  limit: number;
  offset: number;
}) =>
  supabase.rpc("get_public_vendor_directory_v1", {
    p_query: args.query,
    p_city_id: args.cityId,
    p_category: args.category,
    p_limit: args.limit,
    p_offset: args.offset,
  });

export const useVendorDirectory = ({
  page,
  pageSize,
  search,
  city,
  category,
}: UseVendorDirectoryParams): UseVendorDirectoryResult => {
  const [vendors, setVendors] = useState<VendorPublicCard[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const fetchVendors = async () => {
      setLoading(true);
      setError(null);

      const offset = Math.max(0, (page - 1) * pageSize);
      const trimmedCity = city.trim();
      const trimmedSearch = search.trim();
      const trimmedCategory = category.trim();

      let cityId: string | null = null;
      if (trimmedCity) {
        const { data: cityMatches, error: cityError } = await supabase
          .from("cities")
          .select("id")
          .ilike("name", trimmedCity)
          .limit(1);

        if (cityError) {
          if (cancelled) return;
          setError(cityError.message || "Failed to filter by city.");
          setVendors([]);
          setTotal(0);
          setLoading(false);
          return;
        }

        cityId = (cityMatches || [])[0]?.id || null;
        if (!cityId) {
          if (cancelled) return;
          setVendors([]);
          setTotal(0);
          setLoading(false);
          return;
        }
      }

      const { data, error: fetchError } = await fetchVendorDirectoryRpc({
        query: trimmedSearch || null,
        cityId,
        category: trimmedCategory || null,
        limit: pageSize,
        offset,
      });

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message || "Failed to load vendors.");
        setVendors([]);
        setTotal(0);
      } else {
        const rows = (data || []) as VendorPublicCard[];
        setVendors(rows);
        setTotal(rows.length > 0 ? Number(rows[0].total_count) || 0 : 0);
      }

      setLoading(false);
    };

    void fetchVendors();

    return () => {
      cancelled = true;
    };
  }, [page, pageSize, search, city, category]);

  return { vendors, total, loading, error };
};
