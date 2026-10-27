import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { isEditableRole, type DraftPerson, type PeopleRole } from '../../shared/programmeModel';
import { PEOPLE_SEARCH_MIN, searchPeople, searchPeopleQueryKey } from '../../shared/selfServeApi';
import { addRoleFor, roleWord, whyCannotAddPerson, type PItem } from '../../events/programmeSeriesModel';
import { L } from '../model';
import { lineupChanged } from '../data/sessions';
import { Sheet } from './Sheet';

/** The roles an organiser adds here (organiser_search_people_v1 takes these two; performers and the MC are the team's). */
const ADD_ROLES: ReadonlyArray<PeopleRole> = ['teaching', 'djing'];

/**
 * C3 line-up sheet: who is on ONE session, in the scope the session sheet picked.
 * Teachers and DJs are added from a search (organiser_search_people_v1) and taken off
 * (greyed with Put back until saved); the one stored `mc` row and any performer render
 * read-only with the shared role word. Saving goes back to the session sheet's send.
 */
export function LineupSheet({ name, where, type, initial, why, busy, error, onSave, onBack }: {
  name: string;
  where: string;
  type: string | null;
  initial: DraftPerson[];
  /** The rule set's reason the line-up cannot change here; null = it can. */
  why: string | null;
  busy: boolean;
  error: string | null;
  onSave: (people: DraftPerson[]) => void;
  onBack: () => void;
}) {
  const [people, setPeople] = useState<DraftPerson[]>(initial);
  const [role, setRole] = useState<PeopleRole>(addRoleFor(type) ?? 'teaching');
  const [term, setTerm] = useState('');
  const q = term.trim();
  const results = useQuery({
    queryKey: searchPeopleQueryKey(role, q),
    queryFn: () => searchPeople(q, role),
    enabled: !why && q.length >= PEOPLE_SEARCH_MIN,
  });
  const changed = lineupChanged(people);
  // a performance takes no organiser role: the old screen's sentence, from its one copy (review r1 #5)
  const teamOnly = addRoleFor(type) === null ? whyCannotAddPerson({ type, people: [] } as Pick<PItem, 'type' | 'people'> as PItem) : null;
  const toggle = (i: number) => setPeople((list) => {
    const p = list[i];
    if (!p || !isEditableRole(p.role)) return list;
    if (p.origin === 'added') return list.filter((_, j) => j !== i);
    return list.map((x, j) => (j === i ? { ...x, removed: !x.removed } : x));
  });
  const add = (r: { id: string; name: string }) => setPeople((list) =>
    list.some((p) => p.id === r.id && !p.removed) ? list : [...list.filter((p) => p.id !== r.id || p.origin === 'stored'), { id: r.id, name: r.name, role, origin: 'added', removed: false }]);
  return (
    <Sheet title={L.lineup} onClose={onBack}>
      <p className="p3-note" data-testid="p3-lineup-where">{`${name} \u00b7 ${where}`}</p>
      {why && <p className="p3-warn" data-testid="p3-lineup-why">{why}</p>}
      <div className="p3-card p3-tight">
        {people.length ? (
          <ul className="p3-list p3-flush" data-testid="p3-lineup-people">
            {people.map((p, i) => (
              <li key={`${p.id}|${p.role}`} className="p3-row" data-testid="p3-lineup-person" data-removed={p.removed}>
                <div className="p3-grow">
                  <div className={`p3-row-t ${p.removed ? 'p3-struck' : ''}`}>{p.name}</div>
                  <div className="p3-row-s">{roleWord(p.role)}{isEditableRole(p.role) ? '' : ` \u00b7 ${L.readOnlyPerson}`}</div>
                </div>
                {isEditableRole(p.role) && (
                  <button type="button" className="p3-btn p3-btn-line p3-btn-sm" disabled={!!why || busy} onClick={() => toggle(i)} data-testid="p3-lineup-toggle">
                    {p.removed ? L.putBack : L.takeOff}
                  </button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p3-note p3-pad" data-testid="p3-lineup-empty">{L.nobodyYet}</p>
        )}
      </div>
      {!why && (
        <>
          {teamOnly && <p className="p3-note" data-testid="p3-lineup-teamonly">{teamOnly}</p>}
          <span className="p3-field">{L.addAs}</span>
          <div className="p3-seg p3-seg2" role="group" aria-label={L.addAs}>
            {ADD_ROLES.map((r) => (
              <button key={r} type="button" aria-pressed={role === r} onClick={() => setRole(r)} data-testid={`p3-lineup-role-${r}`}>{roleWord(r)}</button>
            ))}
          </div>
          <label className="p3-field" htmlFor="p3-lineup-search">{L.searchPeople}</label>
          <input id="p3-lineup-search" className="p3-in" value={term} onChange={(e) => setTerm(e.target.value)} autoComplete="off"
            placeholder={L.searchPlaceholder} data-testid="p3-lineup-search" />
          {q.length < PEOPLE_SEARCH_MIN ? <p className="p3-note">{L.searchHint}</p> : results.isError ? (
            <p className="p3-error" role="alert">{L.sessionsLoadFail.replace('this date\u2019s sessions', 'the people')}</p>
          ) : results.data && results.data.length === 0 ? (
            <p className="p3-note" data-testid="p3-lineup-nomatch">{L.noMatch}</p>
          ) : (
            <div className="p3-stack-s" data-testid="p3-lineup-results">
              {(results.data ?? []).map((r) => {
                const on = people.some((p) => p.id === r.id && !p.removed);
                // a stored person taken off comes back with their row's button, never as a second entry (review r1 #4)
                const off = people.some((p) => p.id === r.id && p.origin === 'stored' && p.removed);
                return (
                  <button key={r.id} type="button" className="p3-choice" disabled={on || off || busy} onClick={() => add(r)} data-testid="p3-lineup-result">
                    <span className="p3-row-t">{r.name}</span>
                    <span className="p3-row-s">{on ? L.alreadyOn(roleWord(people.find((p) => p.id === r.id)?.role ?? null)) : off ? L.useKeepOn : r.place ?? roleWord(role)}</span>
                  </button>
                );
              })}
            </div>
          )}
        </>
      )}
      {error && <p className="p3-error" role="alert" data-testid="p3-sheet-error">{error}</p>}
      <div className="p3-stack-s p3-gap-t">
        <button type="button" className="p3-btn" disabled={!changed || !!why || busy} onClick={() => onSave(people)} data-testid="p3-lineup-save">
          {changed ? L.saveLineup : L.nothingChanged}
        </button>
        <button type="button" className="p3-btn p3-btn-line" onClick={onBack} data-testid="p3-lineup-back">{L.back}</button>
      </div>
    </Sheet>
  );
}
