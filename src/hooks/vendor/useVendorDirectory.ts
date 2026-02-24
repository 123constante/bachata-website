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

      const from = Math.max(0, (page - 1) * pageSize);
      const to = from + pageSize - 1;

      let query = supabase
        .from("vendors")
        .select("id, business_name, city_id, cities(name), photo_url, product_categories, upcoming_events, ships_international", { count: "exact" })
        .order("business_name", { ascending: true })
        .range(from, to);

      if (search.trim()) {
        query = query.ilike("business_name", `%${search.trim()}%`);
      }

      if (city.trim()) {
        const { data: cityMatches, error: cityError } = await supabase
          .from("cities")
          .select("id")
          .ilike("name", `%${city.trim()}%`)
          .limit(50);

        if (cityError) {
          if (cancelled) return;
          setError(cityError.message || "Failed to filter by city.");
          setVendors([]);
          setTotal(0);
          setLoading(false);
          return;
        }

        const cityIds = (cityMatches || []).map((row: any) => row.id).filter(Boolean);
        if (cityIds.length === 0) {
          if (cancelled) return;
          setVendors([]);
          setTotal(0);
          setLoading(false);
          return;
        }

        query = query.in("city_id", cityIds);
      }

      if (category.trim()) {
        query = query.contains("product_categories", [category.trim()]);
      }

      const { data, count, error: fetchError } = await query;

      if (cancelled) return;

      if (fetchError) {
        setError(fetchError.message || "Failed to load vendors.");
        setVendors([]);
        setTotal(0);
      } else {
        setVendors((data || []) as VendorPublicCard[]);
        setTotal(count || 0);
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
