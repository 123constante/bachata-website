import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

type CityContextValue = {
  citySlug: string | null;
  setCitySlug: (slug: string | null) => void;
};

const CityContext = createContext<CityContextValue | undefined>(undefined);

const STORAGE_KEY = "activeCitySlug";
const cityValidityCache = new Map<string, boolean>();

const RESERVED_SEGMENTS = new Set([
  "parties",
  "classes",
  "discounts",
  "venues",
  "tonight",
  "event",
  "practice-partners",
  "festivals",
  "festival",
  "experience",
  "videographers",
  "choreography",
  "dancers",
  "teachers",
  "djs",
  "organisers",
  "vendors",
  "venue-directory",
  "venue-entity",
  "create-dancers-profile",
  "create-organiser-profile",
  "create-teacher-profile",
  "create-dj-profile",
  "create-videographer-profile",
  "create-vendor-profile",
  "profile",
  "edit-profile",
  "portal",
  "create-event",
  "auth",
  "calendar",
  "directory",
  "debug",
  "onboarding",
  "dashboard",
  "vendor-dashboard",
]);

const getCityFromPath = (pathname: string): string | null => {
  const segment = pathname.split("/").filter(Boolean)[0];
  if (!segment) {
    return null;
  }
  if (RESERVED_SEGMENTS.has(segment)) {
    return null;
  }
  return segment;
};

export const CityProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [citySlug, setCitySlugState] = useState<string | null>(
    () => localStorage.getItem(STORAGE_KEY) || null
  );
  const isAuthRoute =
    location.pathname === "/auth" || location.pathname.startsWith("/auth/");

  const isValidCitySlug = useCallback(async (slug: string) => {
    const normalized = slug.trim().toLowerCase();
    if (!normalized) return false;
    if (cityValidityCache.has(normalized)) {
      return cityValidityCache.get(normalized) === true;
    }

    try {
      const { data, error } = await (supabase.rpc as any)("is_valid_city_slug", {
        p_slug: normalized,
      });

      if (error) {
        console.error("City validation RPC failed:", error);
        cityValidityCache.set(normalized, true);
        return true;
      }

      const isValid = Boolean(data);
      cityValidityCache.set(normalized, isValid);
      return isValid;
    } catch (error) {
      console.error("City validation failed:", error);
      cityValidityCache.set(normalized, true);
      return true;
    }
  }, []);

  const setCitySlug = useCallback((slug: string | null) => {
    setCitySlugState((current) => (current === slug ? current : slug));

    if (slug) {
      localStorage.setItem(STORAGE_KEY, slug);
      return;
    }

    localStorage.removeItem(STORAGE_KEY);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const syncCity = async () => {
      if (isAuthRoute) {
        return;
      }

      const fromPath = getCityFromPath(location.pathname);
      if (fromPath) {
        const valid = await isValidCitySlug(fromPath);
        if (cancelled) return;

        if (valid) {
          setCitySlug(fromPath.toLowerCase());
        }
        // Invalid slug: do nothing — no navigation, no default city forced
      }
    };

    void syncCity();

    return () => {
      cancelled = true;
    };
  }, [isAuthRoute, isValidCitySlug, location.pathname, setCitySlug]);

  const value = useMemo(
    () => ({
      citySlug,
      setCitySlug,
    }),
    [citySlug, setCitySlug]
  );

  return <CityContext.Provider value={value}>{children}</CityContext.Provider>;
};

export const useCity = () => {
  const context = useContext(CityContext);
  if (!context) {
    throw new Error("useCity must be used within a CityProvider");
  }
  return context;
};
