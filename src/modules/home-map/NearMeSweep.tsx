// Near me wait effect (owner pick 2026-11-19, "Radar sweep"): from the tap until the fix resolves, an
// amber radar arm turns around the map card's centre across the WHOLE screen. No words. It is a
// pointer-events:none overlay, rendered ONLY while waiting, so nothing stays behind when distances land.
import { useLayoutEffect, useState, type RefObject } from 'react';

export function NearMeSweep({ waiting, anchorRef }: { waiting: boolean; anchorRef: RefObject<HTMLElement> }) {
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  useLayoutEffect(() => {
    if (!waiting) return;
    const r = anchorRef.current?.getBoundingClientRect();
    setOrigin(r ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight / 3 });
  }, [waiting, anchorRef]);
  if (!waiting || !origin) return null;
  return (
    <div className="hm-sweep" aria-hidden="true" data-testid="near-sweep">
      <div className="hm-sweep-arm" style={{ left: origin.x, top: origin.y }} />
    </div>
  );
}
