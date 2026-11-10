import { useEffect, useLayoutEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { TicketsBlock } from './TicketsBlock';
import { buildChips, type Chip, type GoodToKnowInput } from './goodToKnow';
import type { useOccurrenceProgram as UseOccurrenceProgram, useProgramItems as UseProgramItems } from '@/modules/event-page/sections/EventScheduleGrid';
import { buildProgramme, type ProgrammeView } from './programmeModel';
import { fetchPublicTicketTypes, publicTicketKeys } from './ticketCheckoutApi';
import { closesAt } from './ticketCheckoutModel';

/**
 * The one Tickets page behind the sticky bar's "Buy tickets" (mockups-7). A full-screen
 * page, not a sheet or wizard: back, the night, Good to know chips, then the shared
 * TicketsBlock (all checkout state and money logic stay there, unchanged).
 */
export interface EventTicketsPageProps {
  seriesId: string;
  occurrenceId: string | null;
  organiserId: string | null;
  title: string;
  /** Pre-formatted date line, e.g. "Saturday 14 November, 9pm". */
  dateLine: string | null;
  /** Venue name and address, e.g. "The Studio, 14 Dean St, London". */
  venueLine?: string | null;
  chipInput: Omit<GoodToKnowInput, 'latestCloseIso'>;
  onClose: () => void;
}

/** Latest ticket close among the types on sale, else null (chips then use the event start). */
export function latestCloseIso(closes: ReadonlyArray<string | null>): string | null {
  let best: string | null = null;
  for (const c of closes) {
    if (!c || Number.isNaN(Date.parse(c))) continue;
    if (best === null || Date.parse(c) > Date.parse(best)) best = c;
  }
  return best;
}

export function ChipRow({ chips }: { chips: readonly Chip[] }) {
  if (chips.length === 0) return null;
  return (
    <section aria-label="Good to know" data-testid="good-to-know" className="mb-3">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
        Good to know
      </h2>
      <ul className="flex flex-wrap gap-2">
        {chips.map((c) => (
          <li
            key={c.kind}
            data-chip={c.kind}
            className="min-w-0 max-w-full break-words rounded-md px-2 py-1 text-[13px]"
            style={{
              background: 'hsl(var(--bento-surface-raised))',
              border: c.must ? '1px solid #FF9900' : '1px solid var(--bento-hairline)',
              color: 'hsl(var(--bento-fg))',
            }}
          >
            {c.text}
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProgrammeBlock({ view, onSeeFull }: { view: ProgrammeView | null; onSeeFull?: () => void }) {
  if (!view || view.items.length === 0) return null;
  return (
    <section aria-label="Programme" data-testid="programme" className="mb-3">
      <h2 className="mb-2 text-[13px] font-semibold uppercase tracking-wide" style={{ color: 'hsl(var(--bento-fg-muted))' }}>
        Programme
      </h2>
      <ul className="space-y-1">
        {view.items.map((it) => (
          <li key={it.id} data-programme-item className="flex min-w-0 gap-2 text-[14px]">
            <span className="shrink-0 font-semibold">{it.timeText}</span>
            <span className="min-w-0 break-words">{it.label}</span>
          </li>
        ))}
      </ul>
      {view.hasMore && (
        <button
          type="button"
          data-testid="see-full-programme"
          onClick={onSeeFull}
          className="mt-1 inline-flex h-[48px] items-center text-[14px] underline"
        >
          See full programme
        </button>
      )}
    </section>
  );
}

export function EventTicketsPage({ seriesId, occurrenceId, organiserId, title, dateLine, venueLine, chipInput, onClose, programHooks }: EventTicketsPageProps) {
  const { useOccurrenceProgram, useProgramItems } = programHooks;
  // Sit below the site header (fixed bar plus the sticky tabs row): measured, 106px on a phone.
  const [topPx, setTopPx] = useState(106);
  useLayoutEffect(() => {
    let b = 0;
    document.querySelectorAll('header.fixed, nav.sticky').forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.top < 120 && r.bottom > b) b = r.bottom;
    });
    if (b > 0) setTopPx(Math.round(b));
  }, []);
  const { data: types } = useQuery({
    queryKey: publicTicketKeys.types(seriesId, occurrenceId),
    queryFn: () => fetchPublicTicketTypes(seriesId, occurrenceId),
    staleTime: 30_000,
  });
  // Same query keys as the Schedule tile, so the programme is shared from cache.
  const occQuery = useOccurrenceProgram(occurrenceId);
  const useSeries = !occurrenceId || (occQuery.isSuccess && (occQuery.data?.length ?? 0) === 0);
  const seriesQuery = useProgramItems(useSeries ? seriesId : null);
  const programme = buildProgramme((useSeries ? seriesQuery.data : occQuery.data) ?? []);
  const chips = buildChips({
    ...chipInput,
    programmeStartIso: chipInput.programmeStartIso ?? programme?.startIso ?? null,
    programmeEndIso: chipInput.programmeEndIso ?? programme?.endIso ?? null,
    latestCloseIso: latestCloseIso((types ?? []).map(closesAt)),
  });
  // "Choose a night": close this page and land on the event's Dates tile.
  const seeDates = () => {
    onClose();
    setTimeout(() => document.querySelector('[data-block-id="dates"]')?.scrollIntoView({ block: 'start' }), 50);
  };
  const seeFull = () => {
    onClose();
    setTimeout(() => document.querySelector('[data-block-id="schedule"]')?.scrollIntoView({ block: 'start' }), 50);
  };

  // The phone's Back button closes the page and returns to the event.
  useEffect(() => {
    window.history.pushState({ eventTickets: true }, '');
    const onPop = () => onClose();
    window.addEventListener('popstate', onPop);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('popstate', onPop);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Tickets"
      data-testid="event-tickets-page"
      className="fixed inset-x-0 bottom-0 z-50 overflow-y-auto"
      style={{ top: topPx, background: 'hsl(var(--bento-surface))', color: 'hsl(var(--bento-fg))' }}
    >
      <div className="mx-auto w-full max-w-[430px] px-3 pb-8">
        <nav className="sticky top-0 z-10 flex items-center gap-2 py-2" style={{ background: 'hsl(var(--bento-surface))' }}>
          <button
            type="button"
            onClick={() => window.history.back()}
            data-testid="tickets-back"
            className="inline-flex h-[48px] items-center gap-1 pr-3 text-[15px]"
          >
            <ChevronLeft className="h-[20px] w-[20px]" />
            Back
          </button>
        </nav>
        <header className="mb-3">
          <h1 className="break-words text-[20px] font-semibold leading-tight">{title}</h1>
          {dateLine && <p className="mt-1 text-[14px]" style={{ color: 'hsl(var(--bento-fg-muted))' }}>{dateLine}</p>}
          {venueLine && <p data-testid="tickets-venue" className="break-words text-[14px]" style={{ color: 'hsl(var(--bento-fg-muted))' }}>{venueLine}</p>}
        </header>
        <ProgrammeBlock view={programme} onSeeFull={seeFull} />
        <ChipRow chips={chips} />
        <TicketsBlock seriesId={seriesId} occurrenceId={occurrenceId} organiserId={organiserId} onChooseNight={seeDates} />
      </div>
    </div>,
    document.body,
  );
}

export default EventTicketsPage;
