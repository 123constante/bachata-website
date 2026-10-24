import { useEffect, useRef, useState } from 'react';

/**
 * A face photo that fails to load falls back to the initials (never a broken image). Both paths are
 * React props (the site CSP blocks inline handlers): onError for a failure after hydration, and a check
 * once after mount for an SSR'd <img> that already failed before hydration attached onError.
 *
 * Copied from wall/usePhotoFallback.ts on the PR #963 branch (not on main yet) (people arc S1): S0
 * keeps the wall copy, S2 dedupes it and hub/HubFace.tsx's inline copy to this one.
 */
export function usePhotoFallback(photo: string | null) {
  const [failed, setFailed] = useState<string | null>(null);
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (el && el.complete && el.naturalWidth === 0 && photo) setFailed(photo);
  }, [photo]);
  return { showPhoto: !!photo && failed !== photo, imgProps: { ref, onError: () => setFailed(photo) } };
}
