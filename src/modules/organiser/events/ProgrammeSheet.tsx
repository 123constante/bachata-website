import { useId, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { Card, Chip, Field, FIELD_CLASS, GhostButton, PersonRow, PrimaryButton, SearchField, SheetView, SkeletonRows, useDebounced, useOpenerRef } from '../ui';
import { LEVEL_KEYS, PEOPLE_ROLES, SESSION_TYPES, levelsApplyTo, type PeopleRole } from '@/modules/organiser/shared/programmeModel';
import { PEOPLE_SEARCH_MIN } from '@/modules/organiser/shared/selfServeApi';
import { pickerQueryKey, searchPickerRows } from '../dates/peoplePicker';
import type { RecentPerson } from './programmeSeriesApi';
import {
  addPerson, addRoleFor, itemName, lengthLine, levelShort, levelWord, removePerson, roleWord, setPersonLevel, setPersonRole, setType,
  toggleLevel, typeWord, whyCannotAddPerson, type ItemProblem, type PItem,
} from './programmeSeriesModel';

export type SheetState = { view: 'session' | 'search'; key: string } | null;

export interface ProgrammeSheetProps {
  state: SheetState;
  onState: (s: SheetState) => void;
  item: PItem | null;
  update: (key: string, fn: (it: PItem) => PItem) => void;
  problems: ItemProblem[];
  recent: RecentPerson[];
  recentLoading: boolean;
  announce: (text: string) => void;
}

/** The ONE sheet of the series programme: a session, and the line-up search as a view of it (no nesting). */
export function ProgrammeSheet(props: ProgrammeSheetProps) {
  const { state, onState, item } = props;
  const opener = useOpenerRef(state !== null);
  const role = addRoleFor(item?.type ?? null);
  const searching = state?.view === 'search';
  const body: ReactNode = !state || !item ? null : searching ? <SearchView {...props} item={item} /> : <SessionView {...props} item={item} />;
  return (
    <SheetView
      open={!!state && !!item}
      returnFocusRef={opener}
      onOpenChange={(next) => { if (!next) onState(null); }}
      title={!state || !item ? '' : searching ? (role === 'djing' ? 'Add a DJ' : 'Add a teacher') : item.added ? 'New session' : itemName(item)}
      viewKey={state ? `${state.view}:${state.key}` : undefined}
      onBack={searching && item ? () => onState({ view: 'session', key: item.key }) : undefined}
      fullHeight={searching}
      footer={searching ? undefined : <PrimaryButton onClick={() => onState(null)} testId="prog-sheet-done">Done</PrimaryButton>}
      testId="prog-sheet"
    >
      {body}
    </SheetView>
  );
}

function SessionView({ item, update, problems, onState, announce }: ProgrammeSheetProps & { item: PItem }) {
  const nameId = useId();
  const startId = useId();
  const endId = useId();
  const set = (fn: (it: PItem) => PItem) => update(item.key, fn);
  const problem = (field: ItemProblem['field']) => problems.find((p) => p.key === item.key && p.field === field)?.message ?? null;
  const addOff = whyCannotAddPerson(item);
  const length = lengthLine(item);
  return (
    <div className="space-y-[16px]" data-testid="prog-session-view">
      <Field label="Type" testId="prog-type" error={problem('type')}>
        {item.added ? (
          <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Session type">
            {SESSION_TYPES.map((t) => (
              <Chip key={t} selected={item.type === t} onToggle={() => set((it) => setType(it, t))} testId={`prog-type-${t}`}>{typeWord(t)}</Chip>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-[8px]">
            <span className="rounded-[8px] bg-[var(--card2)] px-[8px] py-[2px] text-[13px] font-semibold text-[var(--fg)]" data-testid="prog-type-tag">{typeWord(item.type)}</span>
            <span className="text-[13px] text-[var(--mut)]">To change the type, remove this session and add a new one.</span>
          </div>
        )}
      </Field>

      <Field label="Name" htmlFor={nameId} error={problem('title')}>
        <input id={nameId} className={`${FIELD_CLASS} h-[48px]`} value={item.title} maxLength={120} placeholder={typeWord(item.type)}
          onChange={(e) => set((it) => ({ ...it, title: e.target.value }))} data-testid="prog-name" />
      </Field>

      <div>
        <div className="grid grid-cols-2 gap-[12px]">
          <Field label="Starts" htmlFor={startId}>
            <input id={startId} type="time" className={`${FIELD_CLASS} h-[48px]`} value={item.start}
              onChange={(e) => set((it) => ({ ...it, start: e.target.value }))} data-testid="prog-start" />
          </Field>
          <Field label="Ends" htmlFor={endId}>
            <input id={endId} type="time" className={`${FIELD_CLASS} h-[48px]`} value={item.end}
              onChange={(e) => set((it) => ({ ...it, end: e.target.value }))} data-testid="prog-end" />
          </Field>
        </div>
        {length && <p className="mt-[4px] text-[13px] text-[var(--mut)]" data-testid="prog-length">{length}{item.end && item.end <= item.start ? ', ends the next day' : ''}</p>}
        {problem('times') && <p role="alert" className="mt-[4px] text-[13px] text-[var(--danger)]" data-testid="prog-times-error">{problem('times')}</p>}
      </div>

      {levelsApplyTo(item.type) && (
        <Field label="Levels (optional)" testId="prog-levels">
          <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Levels">
            {LEVEL_KEYS.map((l) => (
              <Chip key={l} selected={item.levels.includes(l)} onToggle={() => set((it) => toggleLevel(it, l))} testId={`prog-level-${l}`}>
                <span aria-hidden="true">{levelShort(l)}</span><span className="sr-only">{levelWord(l)}</span>
              </Chip>
            ))}
          </div>
          <p className="text-[13px] text-[var(--mut)]">B Beginner, IM Improver, IN Intermediate, AD Advanced, OL Open level.</p>
        </Field>
      )}

      <section aria-label="Line-up" className="space-y-[8px]" data-testid="prog-people">
        <p className="text-[13px] font-semibold text-[var(--mut)]">Line-up</p>
        {item.people.length > 0 && (
          <Card>
            {item.people.map((p) => {
              const mine = (PEOPLE_ROLES as readonly string[]).includes(p.role ?? '');
              return (
                <div key={p.profileId} data-testid="prog-person">
                  <PersonRow name={p.name} role={roleWord(p.role)} sublabel={mine ? undefined : 'Added by the team'}
                    onRemove={mine ? () => { set((it) => removePerson(it, p.profileId)); announce(`${p.name} taken off.`); } : undefined} />
                  {mine && (
                    <div className="space-y-[8px] px-[16px] pb-[12px]">
                      <div className="flex flex-wrap gap-[8px]" role="group" aria-label={`Role for ${p.name}`}>
                        {PEOPLE_ROLES.map((r) => (
                          <Chip key={r} selected={p.role === r} onToggle={() => set((it) => setPersonRole(it, p.profileId, r))} testId={`prog-role-${r}`}>{roleWord(r)}</Chip>
                        ))}
                      </div>
                      <div className="flex flex-wrap gap-[8px]" role="group" aria-label={`Level for ${p.name}`}>
                        {LEVEL_KEYS.map((l) => (
                          <Chip key={l} selected={p.level === l} onToggle={() => set((it) => setPersonLevel(it, p.profileId, l))} testId={`prog-plevel-${l}`}>
                            <span aria-hidden="true">{levelShort(l)}</span><span className="sr-only">{levelWord(l)}</span>
                          </Chip>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </Card>
        )}
        {item.people.length === 0 && <p className="text-[13px] text-[var(--mut)]" data-testid="prog-people-empty">Nobody on this session yet. Add a {addRoleFor(item.type) === 'djing' ? 'DJ' : 'teacher'} so dancers see who is on.</p>}
        <GhostButton size="sm" disabled={!!addOff} aria-describedby={addOff ? 'prog-add-person-reason' : undefined}
          onClick={() => onState({ view: 'search', key: item.key })} testId="prog-add-person">
          <Plus aria-hidden="true" className="h-[16px] w-[16px]" /> Add {addRoleFor(item.type) === 'djing' ? 'a DJ' : 'a teacher'}
        </GhostButton>
        {addOff && <p id="prog-add-person-reason" className="text-[13px] text-[var(--mut)]" data-testid="prog-add-person-reason">{addOff}</p>}
      </section>
    </div>
  );
}

function SearchView({ item, update, onState, recent, recentLoading, announce }: ProgrammeSheetProps & { item: PItem }) {
  const role = addRoleFor(item.type) as PeopleRole;
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const ready = !!role && term.length >= PEOPLE_SEARCH_MIN;
  const results = useQuery({ queryKey: pickerQueryKey(role, term), queryFn: () => searchPickerRows(term, role), enabled: ready, staleTime: 60_000 });
  const on = new Set(item.people.map((p) => p.profileId));
  const noun = role === 'djing' ? 'DJ' : 'teacher';
  const pick = (id: string, name: string, as: PeopleRole) => {
    update(item.key, (it) => addPerson(it, { id, name, role: as }));
    announce(`${name} added. Save to keep it.`);
    onState({ view: 'session', key: item.key });
  };
  const recents = recent.filter((r) => !on.has(r.profileId) && (r.role === null || r.role === role));
  const list = (results.data ?? []).filter((p) => !on.has(p.id));
  return (
    <div className="space-y-[12px]" data-testid="prog-search-view">
      {!term && recentLoading && <SkeletonRows count={2} label="Loading recent people" />}
      {!term && recents.length > 0 && (
        <section aria-label="Recent" className="space-y-[8px]" data-testid="prog-recent">
          <p className="text-[13px] font-semibold text-[var(--mut)]">Recent</p>
          <Card>
            {recents.map((r) => (
              <PersonRow key={r.profileId} testId="prog-recent-person" name={r.name} onPress={() => pick(r.profileId, r.name, role)}
                trailing={<Plus aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--gold)]" />} />
            ))}
          </Card>
        </section>
      )}
      <SearchField value={q} onChange={setQ} aria-label={`Search ${noun}s`} placeholder={`Search ${noun}s by name`} autoFocusInSheet testId="prog-people-search" />
      {!ready ? (
        <p className="text-[13px] text-[var(--mut)]">Type at least {PEOPLE_SEARCH_MIN} letters of a name.</p>
      ) : results.isLoading ? (
        <SkeletonRows count={3} label={`Searching ${noun}s`} />
      ) : results.isError ? (
        <p role="alert" className="text-[14px] text-[var(--danger)]">We could not search just now. Check your connection and try again.</p>
      ) : list.length === 0 ? (
        <p className="text-[14px] text-[var(--mut)]" data-testid="prog-search-empty">No {noun}s match &ldquo;{term}&rdquo;.</p>
      ) : (
        <Card testId="prog-results">
          {list.map((p) => (
            <PersonRow key={p.id} testId="prog-result" name={p.name} sublabel={p.sublabel} onPress={() => pick(p.id, p.name, role)}
              trailing={<Plus aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--gold)]" />} />
          ))}
        </Card>
      )}
    </div>
  );
}

