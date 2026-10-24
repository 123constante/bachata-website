import { useEffect, useRef, useState } from 'react';

/**
 * A face photo that fails to load falls back to the initials tile (never a broken image). Both paths are
 * React props (the site CSP blocks inline handlers): onError for a failure after hydration, and a check
 * once after mount for an SSR'd <img> that already failed before hydration attached onError (a dead
 * photo URL on /dancers, W2-D).
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
