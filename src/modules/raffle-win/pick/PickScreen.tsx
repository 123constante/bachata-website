// Raffle winner journey, Pick screen (layout A). Controlled and UNROUTED: the parent owns nights,
// selection and banner, and applies refusals with applyRefusal(). The step rail belongs to the shell.
import { useMemo, useState } from 'react';
import { Search, TriangleAlert } from 'lucide-react';
import type { OpenNight } from '../model';
import { EventCard } from './EventCard';
import {
  DOCK_IDLE, LOCK_LABEL, PICK_INTRO, PICK_TITLE, REFUSAL_LINES, SEARCH_CLEAR, SEARCH_EMPTY, SEARCH_LABEL, type ShownRefusal,
} from './pickCopy';
import { autoSelection, filterEvents, groupNights, selectedNight, type PickEvent, type PickSelection } from './pickModel';

type Props = {
  nights: OpenNight[];
  selection: PickSelection;
  banner: ShownRefusal | null;
  onSelect: (selection: PickSelection) => void;
  onLock: (night: OpenNight) => void;
};

export function PickScreen({ nights, selection, banner, onSelect, onLock }: Props) {
  const [q, setQ] = useState('');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const [nudge, setNudge] = useState(false);
  const events = useMemo(() => groupNights(nights), [nights]);
  const shown = useMemo(() => filterEvents(events, q), [events, q]);
  const chosen = selectedNight(events, selection);

  const toggle = (ev: PickEvent) => {
    const opening = openKey !== ev.key;
    setOpenKey(opening ? ev.key : null);
    if (opening) {
      const auto = autoSelection(ev);
      if (auto) onSelect(auto);
    }
  };
  const lock = () => {
    if (!chosen) { setNudge(true); window.setTimeout(() => setNudge(false), 400); return; }
    onLock(chosen.date.night);
  };

  return (
    <div className="flex min-h-full flex-col gap-3 px-5 pb-6 pt-2 text-[#f7ecd9]">
      <h1 className="text-[24px] font-extrabold leading-tight">{PICK_TITLE}</h1>
      <p className="text-[13.5px] opacity-70">{PICK_INTRO}</p>
      <label className="flex h-[46px] items-center gap-[10px] rounded-[14px] border-[1.5px] border-white/15 bg-white/10 px-[14px]">
        <Search className="h-[18px] w-[18px] flex-none opacity-70" aria-hidden="true" />
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={SEARCH_LABEL}
          aria-label={SEARCH_LABEL}
          className="min-w-0 flex-1 border-0 bg-transparent text-[16px] outline-none"
        />
      </label>
      {banner ? (
        <div role="status" data-testid="pick-banner" className="flex items-start gap-[10px] rounded-[16px] border border-[#ff5470]/50 bg-[#ff5470]/15 px-[14px] py-[13px] text-[15px] font-semibold">
          <TriangleAlert className="mt-[1px] h-[20px] w-[20px] flex-none text-[#ff5470]" aria-hidden="true" />
          <span>{REFUSAL_LINES[banner]}</span>
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {shown.map((ev) => (
          <EventCard
            key={ev.key}
            event={ev}
            open={openKey === ev.key}
            selection={selection}
            onToggle={toggle}
            onPickDate={(e, occurrenceId) => onSelect({ eventKey: e.key, occurrenceId })}
          />
        ))}
        {shown.length === 0 && q.trim() ? (
          <div className="flex flex-col items-center gap-3 py-5 text-center opacity-80">
            <p>{SEARCH_EMPTY}</p>
            <button type="button" onClick={() => setQ('')} className="min-h-[44px] rounded-[14px] border-[1.5px] border-white/20 px-5 text-[15px] font-bold">
              {SEARCH_CLEAR}
            </button>
          </div>
        ) : null}
      </div>
      <div className="mt-auto flex flex-col gap-[10px] pt-3">
        <div
          data-testid="pick-dock-line"
          className={`min-h-[20px] text-center text-[14px] font-semibold ${chosen ? '' : 'opacity-70'} ${nudge && !chosen ? 'animate-pulse' : ''}`}
        >
          {chosen ? `${chosen.event.title}, ${chosen.date.label}` : DOCK_IDLE}
        </div>
        <button
          type="button"
          aria-disabled={!chosen}
          onClick={lock}
          className={`h-[56px] w-full rounded-[18px] text-[17px] font-bold ${chosen ? 'bg-[#ec3458] text-white' : 'bg-[#321c3f] text-white/40'}`}
        >
          {LOCK_LABEL}
        </button>
      </div>
    </div>
  );
}
