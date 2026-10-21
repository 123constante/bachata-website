import { Fragment, useEffect, useId, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Chip, FIELD_CLASS, PersonRow, SearchField, useDebounced } from '../ui';
import { LEVEL_LABEL } from '../shared/programmeModel';
import { toMinutes } from '../shared/eventRules';
import {
  LEVEL_KEYS,
  addPerson,
  chooseOtherLength,
  endOptions,
  hitsFor,
  kindOptions,
  levelAllowed,
  lineupLabel,
  otherLengthSelected,
  quickLengthOptions,
  quickLengthSelected,
  recentFor,
  removePerson,
  searchRole,
  sessionIssues,
  setEnd,
  setKind,
  setLength,
  setRoom,
  setStart,
  showQuickLengths,
  PICK_START,
  startOptions,
  toggleLevel,
  type SessionDraft,
  type SessionPerson,
} from './sessionsModel';

export type SearchPeopleFn = (term: string, role: 'teaching' | 'djing') => Promise<SessionPerson[]>;

export interface SessionCardProps {
  session: SessionDraft;
  /** Heading, e.g. "Session 2". */
  title: string;
  onChange: (next: SessionDraft) => void;
  /** Null when this is the only session. */
  onRemove: (() => void) | null;
  /** True once any session in the list has a room (or "+ Add a room" was pressed). */
  roomShown: boolean;
  onAddRoom: () => void;
  onRemoveRoom: () => void;
  recent: readonly SessionPerson[];
  onPicked: (p: SessionPerson) => void;
  search: SearchPeopleFn;
  /** Show the reason under the card. On by default: a card always says what is wrong with it. */
  showIssues?: boolean;
}

const selectClass = `${FIELD_CLASS} h-[48px]`;
const labelClass = 'text-[13px] font-semibold text-[var(--mut)]';

/**
 * ONE session card for create, the event page, one date and festival days
 * (rule 25). Pure view of a SessionDraft: every change goes up through
 * onChange, built from the pure setters in sessionsModel.
 */
export function SessionCard({ session: s, title, onChange, onRemove, roomShown, onAddRoom, onRemoveRoom, recent, onPicked, search, showIssues = true }: SessionCardProps) {
  const uid = useId();
  const who = lineupLabel(s.kind);
  const issues = showIssues ? sessionIssues(s) : [];
  const [term, setTerm] = useState('');
  const settled = useDebounced(term.trim(), 250);
  const [found, setFound] = useState<{ key: string; rows: SessionPerson[] } | null>(null);
  const role = searchRole(s.kind);

  useEffect(() => {
    if (settled.length < 2) return;
    let live = true;
    const key = `${role}:${settled}`;
    search(settled, role).then(
      (rows) => live && setFound({ key, rows }),
      () => live && setFound({ key, rows: [] }),
    );
    return () => {
      live = false;
    };
  }, [settled, role, search]);

  const pick = (p: SessionPerson) => {
    onChange(addPerson(s, p));
    onPicked(p);
    setTerm('');
  };
  // Results count only for the term they were fetched for (a stale list never shows).
  const hits = term.trim() === settled && found?.key === `${role}:${settled}` ? found.rows : null;
  const shownHits = hits ? hitsFor(hits, s) : null;
  const rec = recentFor(recent, s);
  const quick = showQuickLengths(s);
  const timed = toMinutes(s.start) !== null;
  const ends = endOptions(s.start, s.end);
  const lengths = quickLengthOptions(s.kind);

  return (
    <section aria-label={title} data-testid={`session-${s.id}`} className="space-y-[12px] rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-[12px]">
      <div className="flex items-center justify-between">
        <h3 className="text-[15px] font-bold text-[var(--fg)]">{title}</h3>
        {onRemove && (
          <button type="button" onClick={onRemove} data-testid={`session-${s.id}-remove`} className="min-h-[44px] px-[8px] text-[15px] font-semibold text-[var(--gold)]">
            Remove
          </button>
        )}
      </div>

      <div role="group" aria-label="Type" className="flex flex-wrap gap-[8px]">
        {kindOptions().map((k) => (
          <Chip key={k.kind} selected={s.kind === k.kind} onToggle={() => onChange(setKind(s, k.kind))} testId={`kind-${k.kind}`}>
            {k.label}
          </Chip>
        ))}
      </div>

      <div className="space-y-[4px]">
        <label htmlFor={`${uid}-name`} className={labelClass}>Name</label>
        <input
          id={`${uid}-name`}
          data-testid="session-name"
          className={`${FIELD_CLASS} h-[48px]`}
          value={s.name}
          maxLength={50}
          onChange={(e) => onChange({ ...s, name: e.target.value })}
        />
      </div>

      <div className="grid grid-cols-2 gap-[12px]">
        <div className="space-y-[4px]">
          <label htmlFor={`${uid}-start`} className={labelClass}>Starts</label>
          <select id={`${uid}-start`} data-testid="session-start" className={selectClass} value={s.start} onChange={(e) => onChange(setStart(s, e.target.value))}>
            {startOptions(s.start).map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div className="space-y-[4px]">
          {quick ? (
            <>
              <span className={labelClass}>Ends</span>
              <div data-testid="session-end-text" className="flex h-[48px] items-center text-[16px] text-[var(--fg)]">
                {ends.find((o) => o.value === s.end)?.label ?? s.end}
              </div>
            </>
          ) : (
            <>
              <label htmlFor={`${uid}-end`} className={labelClass}>Ends</label>
              <select id={`${uid}-end`} data-testid="session-end" className={selectClass} value={timed ? s.end : ''} disabled={!timed} onChange={(e) => onChange(setEnd(s, e.target.value))}>
                {!timed && <option value="">{PICK_START}</option>}
                {ends.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </>
          )}
        </div>
      </div>

      {lengths.length > 0 && (
        <div role="group" aria-label="Length" className="flex flex-wrap gap-[8px]">
          {lengths.map((q) => (
            <Chip key={q.minutes} selected={quickLengthSelected(s, q.minutes)} onToggle={() => onChange(setLength(s, q.minutes))} disabled={!timed} testId={`length-${q.minutes}`}>
              {q.label}
            </Chip>
          ))}
          <Chip selected={timed && otherLengthSelected(s)} onToggle={() => onChange(chooseOtherLength(s))} disabled={!timed} testId="length-other">Other</Chip>
        </div>
      )}

      {levelAllowed(s.kind) && (
        <div className="space-y-[4px]">
          <span className={labelClass}>Level</span>
          <div role="group" aria-label="Level" className="flex flex-wrap gap-[8px]">
            {LEVEL_KEYS.map((l) => (
              <Chip key={l} selected={s.levels.includes(l)} onToggle={() => onChange(toggleLevel(s, l))} testId={`level-${l}`}>
                {LEVEL_LABEL[l]}
              </Chip>
            ))}
          </div>
        </div>
      )}

      {roomShown ? (
        <div className="space-y-[4px]">
          <div className="flex items-center justify-between">
            <label htmlFor={`${uid}-room`} className={labelClass}>Room</label>
            <button type="button" onClick={onRemoveRoom} data-testid="room-remove" aria-label="Remove rooms" className="flex min-h-[44px] items-center gap-[4px] px-[8px] text-[14px] text-[var(--gold)]">
              <X aria-hidden="true" className="h-[16px] w-[16px]" />Remove
            </button>
          </div>
          <input id={`${uid}-room`} data-testid="session-room" className={`${FIELD_CLASS} h-[48px]`} value={s.room} maxLength={30} placeholder="Main room" onChange={(e) => onChange(setRoom(s, e.target.value))} />
        </div>
      ) : (
        <button type="button" onClick={onAddRoom} data-testid="room-add" className="flex min-h-[44px] items-center gap-[6px] text-[15px] font-semibold text-[var(--gold)]">
          <Plus aria-hidden="true" className="h-[16px] w-[16px]" />Add a room
        </button>
      )}

      <div className="space-y-[8px]">
        <span className={labelClass}>{who}</span>
        {s.people.map((p) => (
          <PersonRow key={p.id} name={p.name} role={who} onRemove={() => onChange(removePerson(s, p.id))} testId={`person-${p.id}`} />
        ))}
        <SearchField value={term} onChange={setTerm} aria-label={`Search for a ${who.toLowerCase()}`} placeholder={`Search for a ${who.toLowerCase()}`} testId="lineup-search" />
        {term.trim() !== '' && shownHits !== null && shownHits.length === 0 && (
          <p className="text-[13px] text-[var(--mut)]" data-testid="lineup-none">No one called &ldquo;{term.trim()}&rdquo;. Only people with a profile can be added.</p>
        )}
        {shownHits?.map((p) => (
          <PersonRow key={p.id} name={p.name} onPress={() => pick(p)} testId={`hit-${p.id}`} />
        ))}
        {term.trim() === '' && rec.length > 0 && (
          <div className="flex flex-wrap items-center gap-[8px]" data-testid="lineup-recent">
            <span className="text-[13px] text-[var(--mut)]">Recent</span>
            {rec.map((p) => (
              <Chip key={p.id} selected={false} onToggle={() => pick(p)} testId={`recent-${p.id}`}>{p.name}</Chip>
            ))}
          </div>
        )}
      </div>

      {issues.length > 0 && (
        <p aria-live="polite" data-testid="session-issues" className="text-[13px] text-[var(--danger)]">{issues.map((i, n) => (
            <Fragment key={i.code}>{n > 0 && <> &middot; </>}{i.reason}</Fragment>
          ))}</p>
      )}
    </section>
  );
}
