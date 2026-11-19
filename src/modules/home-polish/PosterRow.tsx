// homeFeedLook category row: big poster words, ONE selected at a time (All, Near me, Party, Class, Fest).
// Replaces the homePolish chip row when the flag is ON. Near me asks for location ONLY when tapped.
// Tap areas are 44px (min-height in px; the phone root font is ~13.5px). Styles: .hm-poster-* in homeMap.css.

import { useEffect, useState } from 'react';
import { CHIP_CATS, type ChipCat } from './chips';
import type { ChipGeo } from './HomeChipRow';
import { denialCopy, isIOSUserAgent, isStandaloneDisplay } from '@/lib/geo/denialCopy';
import { isRoughFix } from '@/lib/geo/nearMeFix';

export type PosterSel = 'all' | 'near' | ChipCat;

/** The pure rule: tapping the selected word returns to All; any other word selects it alone. */
export function nextPosterSel(current: PosterSel, tapped: PosterSel): PosterSel {
  return tapped === 'all' || tapped === current ? 'all' : tapped;
}

export function PosterRow({
  geo,
  sel,
  onSelect,
}: {
  geo: ChipGeo;
  sel: PosterSel;
  onSelect: (next: PosterSel) => void;
}) {
  // "Still looking" once a fix has taken over ~8s (same threshold as the chip row).
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    if (geo.status !== 'loading') {
      setSlow(false);
      return;
    }
    const t = window.setTimeout(() => setSlow(true), 8000);
    return () => window.clearTimeout(t);
  }, [geo.status]);

  const loading = sel === 'near' && geo.status === 'loading';
  const nearLabel = loading ? (slow ? 'Still looking…' : 'Finding you…') : 'Near me';
  const note =
    sel !== 'near'
      ? null
      : geo.status === 'denied'
        ? denialCopy(geo.reason ?? null, isIOSUserAgent(), isStandaloneDisplay())
        : geo.status === 'granted' && isRoughFix(geo.accuracy)
          ? 'Rough location, so distances are approximate.'
          : loading && slow
            ? 'Still looking for you. Tap Near me again to cancel.'
            : null;

  const words: { id: PosterSel; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'near', label: nearLabel },
    ...CHIP_CATS.map((c) => ({ id: c.id as PosterSel, label: c.label })),
  ];
  return (
    <>
      <div role="group" aria-label="Filter and sort events" className="hm-poster-row">
        {words.map((w) => (
          <button
            key={w.id}
            type="button"
            aria-pressed={sel === w.id}
            onClick={() => onSelect(nextPosterSel(sel, w.id))}
            className="hm-poster-word"
          >
            {w.label}
          </button>
        ))}
      </div>
      {note && (
        <p role="status" className="hm-poster-status px-1">
          {note}
        </p>
      )}
    </>
  );
}
