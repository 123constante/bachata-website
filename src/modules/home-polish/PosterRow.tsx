// homeFeedLook category row: big poster words, ONE selected at a time (All, Near me, Party, Class, Fest).
// Replaces the homePolish chip row when the flag is ON. Near me asks for location ONLY when tapped.
// Tap areas are 44px (min-height in px; the phone root font is ~13.5px). Styles: .hm-poster-* in homeMap.css.
// homeOneRow (site structure S2d-1): the ONE filter row on home -- Today, Weekend, Near me, Party, Class,
// Festival. No "All" word: nothing selected = everything, and tapping the selected word clears it.

import { useEffect, useState, type CSSProperties } from 'react';
import { CHIP_CATS, type ChipCat } from './chips';
import type { ChipGeo } from './HomeChipRow';
import { denialCopy, isIOSUserAgent, isStandaloneDisplay } from '@/lib/geo/denialCopy';
import { isRoughFix } from '@/lib/geo/nearMeFix';
import { addDaysToKey, weekdayOfKey } from '@/lib/londonDate';
import { flags } from '@/lib/featureFlags';

export type PosterWhen = 'today' | 'weekend';
export type PosterSel = 'all' | 'near' | PosterWhen | ChipCat;

/** The pure rule: tapping the selected word returns to All; any other word selects it alone. */
export function nextPosterSel(current: PosterSel, tapped: PosterSel): PosterSel {
  return tapped === 'all' || tapped === current ? 'all' : tapped;
}

/** The London date keys a time word keeps. Weekend = Fri, Sat, Sun of THIS week; from Saturday on it is
 *  the rest of this weekend (Sat + Sun, then Sun only), never next week's -- people tap it to go out now. */
export function whenKeys(when: PosterWhen, today: string): ReadonlySet<string> {
  if (when === 'today') return new Set([today]);
  const dow = weekdayOfKey(today); // 0 = Sun .. 6 = Sat
  const start = dow === 0 || dow >= 5 ? 0 : 5 - dow;
  const end = dow === 0 ? 0 : 7 - dow;
  const keys = new Set<string>();
  for (let i = start; i <= end; i++) keys.add(addDaysToKey(today, i));
  return keys;
}

/** The words in the row, in order. homeOneRow: Today, Weekend, Near me, Party, Class, Festival. */
export function posterWords(oneRow: boolean, nearLabel: string): { id: PosterSel; label: string }[] {
  // Ticket tear shows the category in full: FESTIVAL, never Fest (chips.ts keeps 'Fest' for the old chip row).
  const cats = CHIP_CATS.map((c) => ({ id: c.id as PosterSel, label: c.id === 'fest' ? 'Festival' : c.label }));
  const near = { id: 'near' as PosterSel, label: nearLabel };
  if (oneRow) return [{ id: 'today', label: 'Today' }, { id: 'weekend', label: 'Weekend' }, near, ...cats];
  return [{ id: 'all', label: 'All' }, near, ...cats];
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
  const [fx, setFx] = useState(40);
  const [pop, setPop] = useState(0);
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

  const oneRow = flags.homeOneRow;
  const words = posterWords(oneRow, nearLabel);
  return (
    <>
      <div role="group" aria-label="Filter and sort events" className={oneRow ? 'hm-poster-row is-six' : 'hm-poster-row'}>
        {words.map((w) => (
          <button
            key={w.id}
            type="button"
            aria-pressed={sel === w.id}
            onClick={() => {
              const next = nextPosterSel(sel, w.id);
              const idx = (id: PosterSel) => words.findIndex((x) => x.id === id);
              setFx(idx(next) > idx(sel) ? -40 : 40);
              setPop((n) => n + 1);
              onSelect(next);
            }}
            style={{ '--fx': `${fx}px` } as CSSProperties}
            data-pop={sel === w.id ? pop % 2 : undefined}
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
