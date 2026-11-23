import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { PEOPLE_SEARCH_MIN } from '@/modules/organiser/shared/selfServeApi';
import type { PeopleRole } from '../../shared/programmeModel';
import { pickerQueryKey, searchPickerRows, type PickerRow } from '../../dates/peoplePicker';
import { flags } from '@/lib/featureFlags';
import { V2 } from './copy';
import { Avatar, PeoplePickerScreen, PICKER_COPY, roleWord, type PeoplePickerScreenProps } from './PeoplePickerScreen';
import { TeamPickerScreen } from './TeamPickerScreen';

export interface GroupPerson {
  id: string;
  name: string;
  /** False: a read-only chip with no x (the team's people). */
  canRemove: boolean;
}

export interface PeopleGroupProps {
  label: string;
  people: GroupPerson[];
  /** null = no picker and no Add (read-only group). */
  role: PeopleRole | null;
  /** Ids the search must not offer again. */
  onIds: ReadonlySet<string>;
  hint?: string;
  onAdd: (p: { id: string; name: string }) => void;
  onRemove: (id: string) => void;
  /** Teachers on this page's team, listed first in the picker (flag organiserPickerList). */
  teamIds?: ReadonlySet<string>;
}

/** With flag organiserPickerList the picker reads the page's team itself unless a caller passes teamIds. */
const Picker = (p: PeoplePickerScreenProps) => (flags.organiserPickerList ? <TeamPickerScreen {...p} /> : <PeoplePickerScreen {...p} />);

/** One people group of the session sheet: label, chips with x, "None yet", picker + Add, or read-only. */
export function PeopleGroup({ label, people, role, onIds, hint, onAdd, onRemove, teamIds }: PeopleGroupProps) {
  const [term, setTerm] = useState('');
  const [picked, setPicked] = useState<PickerRow | null>(null);
  const [open, setOpen] = useState(false);
  const [photos, setPhotos] = useState<Record<string, string | null>>({});
  const newPicker = flags.organiserPeoplePicker && flags.organiserP3;
  const t = term.trim();
  const ready = !newPicker && !!role && t.length >= PEOPLE_SEARCH_MIN;
  const q = useQuery({
    queryKey: role ? pickerQueryKey(role, t) : ['organiser-people-picker', 'none'],
    queryFn: () => searchPickerRows(t, role!),
    enabled: ready,
    staleTime: 60_000,
  });
  const rows = ready ? (q.data ?? []).filter((r) => !onIds.has(r.id)) : [];
  const add = () => {
    if (!picked) return;
    onAdd({ id: picked.id, name: picked.name });
    setPicked(null);
    setTerm('');
  };
  return (
    <div className="grp" data-testid={`grp-${label}`}>
      <div className="flab">{label}</div>
      <div className="chipsw">
        {people.length === 0 ? (
          <span className="hint">{V2.session.noneYet}</span>
        ) : (
          people.map((p) => (
            <span className="pchip" key={p.id} style={newPicker ? { paddingLeft: 4 } : undefined}>
              {newPicker && <Avatar id={p.id} name={p.name} url={photos[p.id] ?? null} size={24} />}
              {newPicker && ' '}
              {p.name}
              {p.canRemove && <button type="button" aria-label={V2.session.removeName(p.name)} onClick={() => onRemove(p.id)}>&times;</button>}
            </span>
          ))
        )}
      </div>
      {hint && <p className="hint">{hint}</p>}
      {role && newPicker && (
        <>
          <button type="button" aria-label={`${label} add`} onClick={() => setOpen(true)}
            style={{ width: '100%', minHeight: 44, border: '1px solid #C2410C', borderRadius: 8, background: '#FFFFFF', color: '#C2410C', fontSize: 15, textAlign: 'left', padding: '0 12px' }}>
            {PICKER_COPY.addRow(roleWord(role))}
          </button>
          {open && (
            <Picker
              role={role}
              onIds={onIds}
              teamIds={teamIds}
              onBack={() => setOpen(false)}
              onPick={(r) => {
                setPhotos((m) => ({ ...m, [r.id]: r.avatarUrl }));
                onAdd({ id: r.id, name: r.name });
                setOpen(false);
              }}
            />
          )}
        </>
      )}
      {role && !newPicker && (
        <>
          <div className="pickrow">
            <input
              type="text"
              className="fld"
              value={picked ? picked.name : term}
              aria-label={`${label} search`}
              placeholder="Search by name"
              onChange={(e) => { setPicked(null); setTerm(e.target.value); }}
            />
            <button type="button" className="btn sec addb" disabled={!picked} onClick={add}>{V2.session.add}</button>
          </div>
          {!picked && rows.length > 0 && (
            <div className="pickres" role="listbox" aria-label={`${label} results`}>
              {rows.map((r) => (
                <button type="button" role="option" aria-selected={false} className="pickopt" key={r.id} onClick={() => setPicked(r)}>
                  <b>{r.name}</b> <span className="hint">{r.sublabel}</span>
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
