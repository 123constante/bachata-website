import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { DATES_HEAD, DATES_HEAD_ONE } from './pickCopy';
import type { PickEvent, PickSelection } from './pickModel';

type Props = {
  event: PickEvent;
  open: boolean;
  selection: PickSelection;
  onToggle: (event: PickEvent) => void;
  onPickDate: (event: PickEvent, occurrenceId: string) => void;
};

export function EventCard({ event, open, selection, onToggle, onPickDate }: Props) {
  const picked = selection?.eventKey === event.key ? event.dates.find((d) => d.occurrenceId === selection.occurrenceId) : undefined;
  return (
    <div
      data-testid="pick-event"
      className={`rounded-[18px] border-[1.5px] ${picked ? 'border-[#ff5470] bg-[#ff5470]/20' : 'border-white/15 bg-white/10'}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => onToggle(event)}
        className="flex min-h-[62px] w-full items-center gap-3 py-[9px] pl-[10px] pr-[10px] text-left"
      >
        {event.posterUrl ? (
          <img src={event.posterUrl} alt="" className="h-[50px] w-[40px] flex-none rounded-[8px] object-cover" />
        ) : (
          <span data-testid="pick-flyer-fallback" className="grid h-[50px] w-[40px] flex-none place-items-center rounded-[8px] bg-[#3a2f42] text-white/50">
            <CalendarDays className="h-[20px] w-[20px]" aria-hidden="true" />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-[2px]">
          <strong className="text-[17px] font-extrabold leading-tight">{event.title}</strong>
          {event.venueName ? <small className="text-[13px] opacity-70">{event.venueName}</small> : null}
          {picked && !open ? <em data-testid="pick-date-line" className="mt-[3px] text-[13px] font-bold not-italic">{picked.label}</em> : null}
        </span>
        <span className={`grid h-[28px] w-[28px] flex-none place-items-center rounded-full ${picked ? 'bg-[#ff5470] text-white' : 'opacity-70'} ${open && !picked ? 'rotate-180' : ''}`}>
          {picked ? <Check className="h-[16px] w-[16px]" aria-hidden="true" /> : <ChevronDown className="h-[20px] w-[20px]" aria-hidden="true" />}
        </span>
      </button>
      {open ? (
        <div role="group" aria-label={`Upcoming dates for ${event.title}`} className="grid grid-cols-2 gap-2 px-[10px] pb-3">
          <p className="col-span-2 pl-[6px] text-[13px] font-semibold opacity-70">{event.dates.length > 1 ? DATES_HEAD : DATES_HEAD_ONE}</p>
          {event.dates.map((d) => (
            <button
              key={d.occurrenceId}
              type="button"
              aria-pressed={picked?.occurrenceId === d.occurrenceId}
              onClick={() => onPickDate(event, d.occurrenceId)}
              className={`min-h-[46px] rounded-[12px] text-[14.5px] font-bold ${picked?.occurrenceId === d.occurrenceId ? 'bg-[#ff5470] text-white' : 'bg-[#f7ecd9] text-[#24121f]'}`}
            >
              {d.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
