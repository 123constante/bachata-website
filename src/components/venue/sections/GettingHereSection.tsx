import { Train, Footprints } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';
import { TubeLineChip } from '../TubeLineChip';
import { splitLineNames } from '@/lib/tubeLineColour';
import { resolveTransportMode } from '@/lib/transportMode';

type Station = {
  station?: string | null;
  line_names?: string[] | null;
  walking_distance_minutes?: number | null;
  mode?: string | null;
};

type Props = {
  stations: Station[] | null | undefined;
  notes: string | null | undefined;
};

const sortByWalk = (a: Station, b: Station) => {
  const am = typeof a?.walking_distance_minutes === 'number' ? a.walking_distance_minutes : 999;
  const bm = typeof b?.walking_distance_minutes === 'number' ? b.walking_distance_minutes : 999;
  return am - bm;
};

const cleanLines = (s: Station): string[] =>
  Array.isArray(s.line_names)
    ? s.line_names
        .filter((n): n is string => typeof n === 'string' && n.trim().length > 0)
        .flatMap(splitLineNames)
    : [];

/**
 * GettingHereSection — the journey hub.
 *
 * Decided 2026-04-30 (Ricky): drop the "Find on map" + "Get directions"
 * links — the clickable address at the top of the page already opens
 * Google Maps. Keep the focus on the journey itself: which station,
 * which lines, how long to walk.
 */
export const GettingHereSection = ({ stations, notes }: Props) => {
  const list = (Array.isArray(stations) ? stations : [])
    .filter((s) => s && (s.station || cleanLines(s).length > 0))
    .sort(sortByWalk);

  if (list.length === 0 && !notes) return null;

  const [closest, ...others] = list;
  const ClosestIcon = resolveTransportMode(closest?.mode, closest?.line_names).Icon;

  return (
    <VenueSectionTile eyebrow="GETTING HERE" icon={Train} wide>
      {closest && (
        <div className="rounded-lg border border-venue-card-border bg-venue-card-pill p-3 mb-2">
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex items-center gap-1.5 min-w-0">
              <ClosestIcon className="w-4 h-4 text-venue-ember flex-shrink-0" aria-hidden="true" />
              <span className="text-base font-semibold text-venue-card-fg truncate">
                {closest.station ?? 'Nearest station'}
              </span>
            </div>
            {typeof closest.walking_distance_minutes === 'number' && (
              <span className="inline-flex items-center gap-1 rounded-md bg-venue-open/15 border border-venue-open/40 px-2 py-0.5 text-xs font-bold text-venue-open whitespace-nowrap">
                <Footprints className="w-3.5 h-3.5" aria-hidden="true" />
                {closest.walking_distance_minutes} min
              </span>
            )}
          </div>

          {cleanLines(closest).length > 0 && (
            <div className="flex flex-wrap gap-1">
              {cleanLines(closest).map((ln) => (
                <TubeLineChip key={ln} name={ln} variant="full" />
              ))}
            </div>
          )}
        </div>
      )}

      {others.length > 0 && (
        <>
          <p className="text-[10px] uppercase tracking-wide text-venue-card-mut font-semibold mb-1">
            Other nearby stations
          </p>
          <div className="flex flex-col gap-1 mb-2">
            {others.map((s, i) => {
              const OtherIcon = resolveTransportMode(s.mode, s.line_names).Icon;
              return (
              <div
                key={i}
                className="flex items-center justify-between gap-1.5 rounded-md bg-venue-card-pill px-2 py-1"
              >
                <span className="flex items-center gap-1 min-w-0">
                  <OtherIcon className="w-3 h-3 text-venue-card-mut flex-shrink-0" aria-hidden="true" />
                  <span className="text-xs font-semibold text-venue-card-fg truncate">
                    {s.station ?? 'Station'}
                  </span>
                </span>
                <span className="flex items-center gap-1 flex-shrink-0">
                  {cleanLines(s).slice(0, 3).map((ln) => (
                    <TubeLineChip key={ln} name={ln} variant="abbr" />
                  ))}
                  {typeof s.walking_distance_minutes === 'number' && (
                    <span className="text-[10px] text-venue-card-mut font-medium whitespace-nowrap ml-1">
                      <Footprints className="w-3 h-3 inline -mt-0.5" aria-hidden="true" />{' '}
                      {s.walking_distance_minutes}m
                    </span>
                  )}
                </span>
              </div>
              );
            })}
          </div>
        </>
      )}

      {notes && (
        <p className="text-[11px] leading-relaxed text-venue-card-mut italic">{notes}</p>
      )}
    </VenueSectionTile>
  );
};
export default GettingHereSection;
