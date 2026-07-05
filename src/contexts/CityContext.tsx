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
import { captureException } from "@/lib/sentry";

type CityContextValue = {
  citySlug: string | null;
  setCitySlug: (slug: string | null) => void;
};

const CityContext = createContext<CityContextValue | undefined>(undefined);

const STORAGE_KEY = "activeCitySlug";
const cityValidityCache = new Map<string, boolean>();

const getCityFromPath = (pathname: string): string | null => {
  const segments = pathname.split("/").filter(Boolean);
  if (segments[0] === "city" && segments[1]) {
    return segments[1];
  }
  return null;
};

export const CityProvider = ({ children }: { children: React.ReactNode }) => {
  const location = useLocation();
  const [citySlug, setCitySlugState] = useState<string | null>(() => {
    // On a /city/:slug URL the path IS the source of truth — derive it
    // synchronously so the FIRST render (server AND client) already has the slug.
    // This is what lets the home route prefetch + dehydrate its city-scoped
    // queries on the server: the effect below only re-anchors it post-mount, so
    // without this the server render sees citySlug=null, the city queries stay
    // disabled, and the prerendered HTML is empty. Non-/city routes are
    // unchanged: localStorage on the client, null on the server (as before).
    const fromPath = getCityFromPath(location.pathname);
    if (fromPath) return fromPath.toLowerCase();
    return typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) || null : null;
  });
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
        captureException(error, { context: "CityContext.isValidCitySlug.rpc", slug: normalized });
        cityValidityCache.set(normalized, true);
        return true;
      }

      const isValid = Boolean(data);
      cityValidityCache.set(normalized, isValid);
      return isValid;
    } catch (error) {
      captureException(error, { context: "CityContext.isValidCitySlug.catch", slug: normalized });
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
