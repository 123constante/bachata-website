import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { TicketsBlock } from './TicketsBlock';
import { buildChips, type Chip, type GoodToKnowInput } from './goodToKnow';
import { fetchPublicTicketTypes, publicTicketKeys } from './ticketCheckoutApi';

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

export function EventTicketsPage({ seriesId, occurrenceId, organiserId, title, dateLine, chipInput, onClose }: EventTicketsPageProps) {
  const { data: types } = useQuery({
    queryKey: publicTicketKeys.types(seriesId),
    queryFn: () => fetchPublicTicketTypes(seriesId),
    staleTime: 30_000,
  });
  const chips = buildChips({ ...chipInput, latestCloseIso: latestCloseIso((types ?? []).map((t) => t.salesCloseAt)) });

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
      className="fixed inset-0 z-50 overflow-y-auto"
      style={{ background: 'hsl(var(--bento-surface))', color: 'hsl(var(--bento-fg))' }}
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
        </header>
        <ChipRow chips={chips} />
        <TicketsBlock seriesId={seriesId} occurrenceId={occurrenceId} organiserId={organiserId} />
      </div>
    </div>,
    document.body,
  );
}

export default EventTicketsPage;
