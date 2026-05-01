import { Clock } from 'lucide-react';
import { VenueSectionTile } from '../VenueSectionTile';

const ABBR: Record<string, string> = {
  monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed', thursday: 'Thu',
  friday: 'Fri', saturday: 'Sat', sunday: 'Sun',
};
const ORDER = ['monday','tuesday','wednesday','thursday','friday','saturday','sunday'];

export const OpeningHoursSection = ({
  hours,
}: {
  hours: Record<string, unknown> | null | undefined;
}) => {
  if (!hours || Object.keys(hours).length === 0) return null;
  const rows: { day: string; display: string }[] = [];
  for (const day of ORDER) {
    let raw: unknown = undefined;
    for (const key of Object.keys(hours)) {
      if (key.toLowerCase() === day) {
        raw = (hours as Record<string, unknown>)[key];
        break;
      }
    }
    if (raw == null) continue;
    let display = '';
    if (typeof raw === 'string') {
      display = raw;
    } else if (typeof raw === 'object') {
      const h = raw as { open?: string; close?: string; isOpen?: boolean };
      if (h.isOpen === false) display = 'Closed';
      else if (h.open && h.close) display = `${h.open}–${h.close}`;
    }
    if (display) rows.push({ day: ABBR[day], display });
  }
  if (rows.length === 0) return null;

  return (
    <VenueSectionTile eyebrow="OPENING HOURS" icon={Clock}>
      <div className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-xs">
        {rows.map((r) => (
          <span key={r.day} className="contents">
            <span className="text-venue-card-mut font-medium">{r.day}</span>
            <span className={`text-venue-card-fg ${r.display === 'Closed' ? 'opacity-60' : ''}`}>
              {r.display}
            </span>
          </span>
        ))}
      </div>
    </VenueSectionTile>
  );
};
export default OpeningHoursSection;
