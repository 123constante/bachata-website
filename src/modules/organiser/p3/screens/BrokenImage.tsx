import { useState } from 'react';
import { L } from '../model';

/**
 * An organiser's own picture, or a plain note when it did not load. Keyed by the URL, so a new
 * address gets its own try (same rule as parts.tsx Thumb). The note is a box, never a control:
 * the Change / Remove buttons next to it stay as they were.
 */
export function BrokenImage({ src, className, loading = 'lazy' }: { src: string; className?: string; loading?: 'lazy' | 'eager' }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === src) {
    return (
      <div className={`p3-image-broken${className ? ` ${className}` : ''}`} role="img" aria-label={L.detailsImageBroken} data-testid="p3-image-broken">
        <span aria-hidden="true">{L.detailsImageBroken}</span>
      </div>
    );
  }
  return <img className={className} src={src} alt="" loading={loading} decoding="async" onError={() => setBroken(src)} />;
}
