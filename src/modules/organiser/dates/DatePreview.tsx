import type { DraftSession } from '@/modules/organiser/shared/programmeModel';
import { byTime, peopleLabel, sessionName, spanLabel } from './dateModel';

export interface DatePreviewProps {
  label: string;
  span: { start: string; end: string } | null;
  venue: string | null;
  rows: DraftSession[];
  cancelled: boolean;
  reason: string | null;
}

/** How the date reads on the public event page, from the draft (what Save would publish). */
export function DatePreview({ label, span, venue, rows, cancelled, reason }: DatePreviewProps) {
  const kept = byTime(rows.filter((r) => !r.removed));
  return (
    <div className="space-y-1 px-3 py-2" data-testid="date-preview">
      <p className="truncate text-[14px] font-semibold text-[var(--fg)]">
        {[label, spanLabel(span)].filter(Boolean).join(' \u00b7 ')}
      </p>
      <p className="truncate text-[13px] text-[var(--mut)]">
        {cancelled ? `Cancelled${reason ? ` \u00b7 ${reason}` : ''}` : venue ?? 'Venue to be confirmed'}
      </p>
      {!cancelled && kept.slice(0, 3).map((r) => (
        <p key={r.key} className="truncate text-[13px] text-[var(--fg)]" data-testid="date-preview-session">
          {[r.start || null, sessionName(r), peopleLabel(r)].filter(Boolean).join(' \u00b7 ')}
        </p>
      ))}
      {!cancelled && kept.length > 3 && <p className="text-[13px] text-[var(--mut)]">+{kept.length - 3} more</p>}
    </div>
  );
}
