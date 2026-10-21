import { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { Field, FIELD_CLASS, PrimaryButton } from '../../ui';
import type { SearchPeopleFn } from '../../sessions/SessionCard';
import { FestivalArtists } from './FestivalArtists';
import { FestivalNights } from './FestivalNights';
import { FestivalTimetable } from './FestivalTimetable';
import type { FestivalDeps } from './festivalApi';
import {
  artistsDirty,
  festivalCommands,
  festivalFromStored,
  festivalProblem,
  ticketProblem,
  type FestivalOriginal,
} from './festivalModel';

export const FESTIVAL_ENTRIES = [
  { id: 'hours', label: 'Party hours' },
  { id: 'artists', label: 'Artists' },
  { id: 'timetable', label: 'Timetable' },
  { id: 'flyer', label: 'Flyer' },
  { id: 'details', label: 'Details' },
  { id: 'about', label: 'About' },
] as const;
export type FestivalEntry = (typeof FESTIVAL_ENTRIES)[number]['id'];
/** Entries other slices' editors own (the shared event editor); this module only lists them. */
export const OTHER_ENTRIES: readonly FestivalEntry[] = ['flyer', 'details', 'about'];

export interface FestivalEditProps {
  original: FestivalOriginal;
  /** A live festival: the Save button reads "Update live event". */
  live: boolean;
  deps: FestivalDeps;
  search: SearchPeopleFn;
  /** Flyer / Details / About open the shared editor. */
  onOpenOther: (entry: FestivalEntry) => void;
  onSaved?: () => void;
}

/** The festival Edit bar: six entries, the three this module owns open in place, one Save. */
export function FestivalEdit({ original, live, deps, search, onOpenOther, onSaved }: FestivalEditProps) {
  const start = useMemo(() => festivalFromStored({ startDate: original.startDate, ticketUrl: original.ticketUrl, tree: original.tree, artists: original.artists }), [original]);
  const [draft, setDraft] = useState(start);
  const [open, setOpen] = useState<FestivalEntry | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const commands = festivalCommands(draft, original);
  const artistsChanged = artistsDirty(draft.artists, original.artists);
  const changed = commands.length > 0 || artistsChanged;
  const problem = festivalProblem(draft);
  const reason = problem ?? (changed ? null : 'No changes yet');
  const label = live ? 'Update live event' : 'Save';

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      for (const c of commands) await deps.send(c);
      if (artistsChanged) await deps.saveArtists(draft.artists);
      onSaved?.();
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not save. Try again.');
    } finally {
      setSaving(false);
    }
  };

  const summary = (id: FestivalEntry): string | null => {
    if (id === 'hours') return draft.nights.length === 1 ? '1 night' : `${draft.nights.length} nights`;
    if (id === 'artists') return draft.artists.length ? `${draft.artists.length}` : null;
    if (id === 'timetable') { const n = draft.timetable.reduce((a, t) => a + t.length, 0); return n ? `${n} sessions` : 'None'; }
    return null;
  };

  return (
    <div className="space-y-[12px]" data-testid="festival-edit">
      <ul className="space-y-[8px]">
        {FESTIVAL_ENTRIES.map((e) => (
          <li key={e.id}>
            <button type="button" aria-expanded={OTHER_ENTRIES.includes(e.id) ? undefined : open === e.id} data-testid={`festival-entry-${e.id}`}
              className="flex min-h-[52px] w-full items-center justify-between gap-[12px] rounded-[var(--r-card,16px)] border border-[var(--line)] bg-[var(--card)] px-[12px] text-left"
              onClick={() => (OTHER_ENTRIES.includes(e.id) ? onOpenOther(e.id) : setOpen(open === e.id ? null : e.id))}>
              <span className="text-[16px] font-semibold text-[var(--fg)]">{e.label}</span>
              <span className="flex items-center gap-[4px] text-[15px] text-[var(--mut)]">{summary(e.id)}<ChevronRight aria-hidden="true" className="h-[18px] w-[18px]" /></span>
            </button>
            {open === e.id && e.id === 'hours' && (
              <div className="space-y-[12px] pt-[8px]">
                <Field label="First day" htmlFor="festival-edit-start">
                  <input id="festival-edit-start" type="date" className={`${FIELD_CLASS} h-[48px]`} value={draft.startDate} data-testid="festival-edit-start" onChange={(ev) => ev.target.value && setDraft({ ...draft, startDate: ev.target.value })} />
                </Field>
                <Field label="Ticket link" htmlFor="festival-edit-ticket" error={ticketProblem(draft.ticketUrl)}>
                  <input id="festival-edit-ticket" type="url" inputMode="url" className={`${FIELD_CLASS} h-[48px]`} value={draft.ticketUrl} data-testid="festival-edit-ticket" onChange={(ev) => setDraft({ ...draft, ticketUrl: ev.target.value })} />
                </Field>
                <FestivalNights draft={draft} onChange={setDraft} />
              </div>
            )}
            {open === e.id && e.id === 'artists' && <div className="pt-[8px]"><FestivalArtists draft={draft} onChange={setDraft} search={deps.search} /></div>}
            {open === e.id && e.id === 'timetable' && <div className="pt-[8px]"><FestivalTimetable draft={draft} onChange={setDraft} search={search} /></div>}
          </li>
        ))}
      </ul>
      {error && <p role="alert" className="text-[13px] text-[var(--danger)]" data-testid="festival-error">{error}</p>}
      {reason && <p className="text-center text-[13px] text-[var(--mut)]" data-testid="festival-save-reason">{reason}</p>}
      <PrimaryButton disabled={reason !== null} loading={saving} onClick={() => void save()} testId="festival-save">{label}</PrimaryButton>
    </div>
  );
}
