import { useEffect, useId, useState, type ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Check, MapPin, Plus } from 'lucide-react';
import {
  Card,
  Chip,
  Collapse,
  ErrorState,
  Field,
  FIELD_CLASS,
  GhostButton,
  PersonRow,
  PrimaryButton,
  SearchField,
  SheetView,
  SkeletonRows,
  StatusTag,
  useDebounced,
} from '../ui';
import {
  LEVEL_KEYS,
  LEVEL_LABEL,
  PEOPLE_ROLE_LABEL,
  SESSION_TYPES,
  TYPE_LABEL,
  isEditableRole,
  levelsApplyTo,
  removePerson,
  undoRemovePerson,
  type DraftSession,
  type RowProblem,
} from '@/modules/organiser/shared/programmeModel';
import {
  PEOPLE_SEARCH_MIN,
  searchPeople,
  searchPeopleQueryKey,
  type CancellationReason,
} from '@/modules/organiser/shared/selfServeApi';
import { confirmCopy } from '@/modules/organiser/shared/editorGuards';
import type { VenueOption } from '@/modules/organiser/shared/publicVenues';
import { ROLE_NOUN, addRoleFor, onSessionIds, pickPerson, setSessionType, typeLabel, typeTone } from './dateModel';

export type SheetState =
  | { view: 'session'; key: string }
  | { view: 'search'; key: string }
  | { view: 'venue' }
  | { view: 'cancel' }
  | { view: 'uncancel' }
  | { view: 'break' }
  | null;



export interface DateSheetProps {
  state: SheetState;
  onState: (next: SheetState) => void;
  rows: DraftSession[];
  updateRow: (key: string, fn: (row: DraftSession) => DraftSession) => void;
  removeSession: (key: string) => void;
  problems: RowProblem[];
  editable: boolean;
  announce: (text: string) => void;
  /** Venue view. */
  venues: VenueOption[] | undefined;
  venuesLoading: boolean;
  /** The list failed: the view shows a retry. */
  venuesError?: boolean;
  onRetryVenues?: () => void;
  venueId: string | null;
  usualVenueId: string | null;
  onPickVenue: (id: string | null) => void;
  /** Cancel / break views. */
  dateLabel: string;
  reasons: CancellationReason[] | undefined;
  reasonsLoading: boolean;
  reasonsError?: boolean;
  onRetryReasons?: () => void;
  onCancelDate: (reason: string) => void;
  onUncancelDate: () => void;
  onBreak: () => void;
  commandBusy: boolean;
  commandError: string | null;
}

/**
 * The ONE sheet of the date page. Every editor is a VIEW of it (viewKey):
 * a session, the people search for that session, the venue list, cancel,
 * un-cancel and break. No popovers, no nested dialogs (PR #653 finding a).
 */
export function DateSheet(props: DateSheetProps) {
  const { state, onState, rows } = props;
  const open = state !== null;
  const row = state && 'key' in state ? rows.find((r) => r.key === state.key) ?? null : null;
  const close = () => onState(null);

  let title = '';
  let body: ReactNode = null;
  let footer: ReactNode = undefined;
  let onBack: (() => void) | undefined;

  if (state?.view === 'session' && row) {
    title = row.original ? sessionTitle(row) : 'New session';
    body = <SessionView {...props} row={row} />;
    footer = <PrimaryButton onClick={close} testId="date-sheet-done">Done</PrimaryButton>;
  } else if (state?.view === 'search' && row) {
    const role = addRoleFor(row.type);
    title = role === 'djing' ? 'Add a DJ' : 'Add a teacher';
    onBack = () => onState({ view: 'session', key: row.key });
    body = <SearchView {...props} row={row} />;
  } else if (state?.view === 'venue') {
    title = 'Venue for this date';
    body = <VenueView {...props} />;
  } else if (state?.view === 'cancel') {
    title = `Cancel ${props.dateLabel}`;
    body = <CancelView {...props} />;
  } else if (state?.view === 'uncancel') {
    title = `Put ${props.dateLabel} back on`;
    body = (
      <div className="space-y-[12px] text-[15px] text-[var(--fg)]" data-testid="date-uncancel-view">
        <p>{props.dateLabel} goes back on as usual. Dancers no longer see a cancellation.</p>
        {props.commandError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="date-command-error">{props.commandError}</p>}
      </div>
    );
    footer = <PrimaryButton onClick={props.onUncancelDate} loading={props.commandBusy} testId="date-uncancel-confirm">Put it back on</PrimaryButton>;
  } else if (state?.view === 'break') {
    title = 'Break this week';
    body = (
      <div className="space-y-[12px] text-[15px] text-[var(--fg)]" data-testid="date-break-view">
        <p>{props.dateLabel} comes off the calendar for a break. Dancers do not see a cancellation, the date just is not listed.</p>
        <p className="text-[13px] text-[var(--mut)]">You can put it back later from the event&rsquo;s dates.</p>
        {props.commandError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="date-command-error">{props.commandError}</p>}
      </div>
    );
    footer = <PrimaryButton onClick={props.onBreak} loading={props.commandBusy} testId="date-break-confirm">Take this week off</PrimaryButton>;
  }

  // CancelView renders its own footer content through the body (it needs its local state).
  return (
    <SheetView
      open={open && body !== null}
      onOpenChange={(next) => { if (!next) close(); }}
      title={title}
      viewKey={state ? `${state.view}${'key' in state ? `:${state.key}` : ''}` : undefined}
      onBack={onBack}
      fullHeight={state?.view === 'search' || state?.view === 'venue'}
      footer={footer}
      testId="date-sheet"
    >
      {body}
    </SheetView>
  );
}

const sessionTitle = (row: DraftSession) => row.title.trim() || typeLabel(row.type);

// ---- session ----------------------------------------------------------------

function SessionView({ row, updateRow, removeSession, onState, problems, editable, announce }: DateSheetProps & { row: DraftSession }) {
  const nameId = useId();
  const startId = useId();
  const endId = useId();
  const role = addRoleFor(row.type);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const problem = (field: RowProblem['field']) => problems.find((p) => p.key === row.key && p.field === field)?.message ?? null;
  const people = row.people ?? [];
  const set = (fn: (r: DraftSession) => DraftSession) => updateRow(row.key, fn);

  return (
    <div className="space-y-[16px]" data-testid="date-session-view">
      <Field label="Type" testId="session-type" error={problem('type')}>
        {row.original ? (
          <div className="flex items-center gap-[8px]">
            <StatusTag tone={typeTone(row.type)} testId="session-type-tag">{typeLabel(row.type)}</StatusTag>
            <span className="text-[13px] text-[var(--mut)]">To change the type, remove this session and add a new one.</span>
          </div>
        ) : (
          <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Session type">
            {SESSION_TYPES.map((t) => (
              <Chip key={t} selected={row.type === t} onToggle={() => set((r) => setSessionType(r, t))} testId={`session-type-${t}`}>
                {TYPE_LABEL[t]}
              </Chip>
            ))}
          </div>
        )}
      </Field>

      <Field label="Name" htmlFor={nameId} error={problem('title')}>
        <input
          id={nameId}
          className={`${FIELD_CLASS} h-[48px]`}
          value={row.title}
          maxLength={120}
          placeholder={typeLabel(row.type)}
          disabled={!editable}
          onChange={(e) => set((r) => ({ ...r, title: e.target.value }))}
          data-testid="session-name"
        />
      </Field>

      <div>
        <div className="grid grid-cols-2 gap-[12px]">
          <Field label="Starts" htmlFor={startId}>
            <input id={startId} type="time" className={`${FIELD_CLASS} h-[48px]`} value={row.start} disabled={!editable}
              onChange={(e) => set((r) => ({ ...r, start: e.target.value }))} data-testid="session-start" />
          </Field>
          <Field label="Ends" htmlFor={endId}>
            <input id={endId} type="time" className={`${FIELD_CLASS} h-[48px]`} value={row.end} disabled={!editable}
              onChange={(e) => set((r) => ({ ...r, end: e.target.value }))} data-testid="session-end" />
          </Field>
        </div>
        {problem('times') && <p role="alert" className="mt-[4px] text-[13px] text-[var(--danger)]" data-testid="session-times-error">{problem('times')}</p>}
      </div>

      {/* Levels are offered only for a class or a masterclass (levelsApplyTo, ARC DOMAIN). */}
      {levelsApplyTo(row.type) && (
        <Field label="Levels (optional)" testId="session-levels" error={problem('levels')}>
          <div className="flex flex-wrap gap-[8px]" role="group" aria-label="Levels">
            {LEVEL_KEYS.map((l) => {
              const on = row.levels.includes(l);
              return (
                <Chip key={l} selected={on} disabled={!editable} testId={`session-level-${l}`}
                  onToggle={() => set((r) => ({ ...r, levels: on ? r.levels.filter((x) => x !== l) : [...r.levels, l] }))}>
                  {LEVEL_LABEL[l]}
                </Chip>
              );
            })}
          </div>
        </Field>
      )}

      <section aria-label="People" className="space-y-[8px]" data-testid="session-people">
        <p className="text-[13px] font-semibold text-[var(--mut)]">{role === 'djing' ? 'DJs' : role === 'teaching' ? 'Teachers' : 'People'}</p>
        {people.length > 0 && (
          <Card>
            {people.map((p, i) => {
              const team = !isEditableRole(p.role);
              return (
                <Collapse
                  key={p.id}
                  show={!leaving.has(p.id)}
                  testId={`person-collapse-${p.id}`}
                  onExited={() => {
                    // The row is gone from the screen; now it leaves the draft.
                    set((r) => {
                      const at = (r.people ?? []).findIndex((q) => q.id === p.id);
                      return at >= 0 ? removePerson(r, at) : r;
                    });
                    setLeaving((s) => { const n = new Set(s); n.delete(p.id); return n; });
                  }}
                >
                  <PersonRow
                    testId="session-person"
                    name={p.name}
                    role={PEOPLE_ROLE_LABEL[p.role ?? ''] ?? undefined}
                    sublabel={team ? 'Added by the team' : p.removed ? 'Comes off when you save' : p.origin === 'added' ? 'Added when you save' : undefined}
                    removed={p.removed}
                    onUndo={() => { set((r) => undoRemovePerson(r, i)); announce(`${p.name} is back on.`); }}
                    onRemove={!editable || team ? undefined : () => {
                      if (p.origin === 'added') setLeaving((s) => new Set(s).add(p.id));
                      else set((r) => removePerson(r, i));
                      announce(`${p.name} taken off.`);
                    }}
                  />
                </Collapse>
              );
            })}
          </Card>
        )}
        {role === null ? (
          <p className="text-[13px] text-[var(--mut)]" data-testid="session-people-team">
            Performers and the MC are added by the Bachata Calendar team.
          </p>
        ) : editable ? (
          <GhostButton size="sm" onClick={() => onState({ view: 'search', key: row.key })} testId="session-add-person">
            <Plus aria-hidden="true" className="h-[16px] w-[16px]" /> Add a {ROLE_NOUN[role]}
          </GhostButton>
        ) : null}
        {problem('people') && <p role="alert" className="text-[13px] text-[var(--danger)]">{problem('people')}</p>}
      </section>

      {editable && (
        <button
          type="button"
          onClick={() => { removeSession(row.key); onState(null); }}
          className="min-h-[44px] w-full rounded-[12px] text-[15px] font-semibold text-[var(--danger)]"
          data-testid="session-remove"
        >
          Remove from this date
        </button>
      )}
    </div>
  );
}

// ---- people search (a view of the same sheet) ---------------------------------


function SearchView({ row, updateRow, onState, announce }: DateSheetProps & { row: DraftSession }) {
  const role = addRoleFor(row.type);
  const [q, setQ] = useState('');
  const term = useDebounced(q.trim());
  const ready = !!role && term.length >= PEOPLE_SEARCH_MIN;
  const results = useQuery({
    queryKey: role ? searchPeopleQueryKey(role, term) : ['organiser-search-people', 'none'],
    queryFn: () => searchPeople(term, role!),
    enabled: ready,
    staleTime: 60_000,
  });
  if (!role) return null;
  const on = onSessionIds(row);
  const list = (results.data ?? []).filter((p) => !on.has(p.id));
  const noun = ROLE_NOUN[role];

  return (
    <div className="space-y-[12px]" data-testid="date-search-view">
      <SearchField value={q} onChange={setQ} aria-label={`Search ${noun}s`} placeholder={`Search ${noun}s by name`} autoFocusInSheet testId="people-search" />
      {!ready ? (
        <p className="text-[13px] text-[var(--mut)]">Type at least {PEOPLE_SEARCH_MIN} letters of a name.</p>
      ) : results.isLoading ? (
        <SkeletonRows count={3} label={`Searching ${noun}s`} />
      ) : results.isError ? (
        <p role="alert" className="text-[14px] text-[var(--danger)]">We could not search just now. Check your connection and try again.</p>
      ) : list.length === 0 ? (
        <p className="text-[14px] text-[var(--mut)]" data-testid="people-search-empty">No {noun}s match &ldquo;{term}&rdquo;.</p>
      ) : (
        <Card testId="people-results">
          {list.map((p) => (
            <PersonRow
              key={p.id}
              testId="people-result"
              name={p.name}
              sublabel={p.place ?? undefined}
              onPress={() => {
                updateRow(row.key, (r) => pickPerson(r, p));
                announce(`${p.name} added. Save to keep it.`);
                onState({ view: 'session', key: row.key });
              }}
              trailing={<Plus aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--gold)]" />}
            />
          ))}
        </Card>
      )}
    </div>
  );
}

// ---- venue ---------------------------------------------------------------------

function VenueView({ venues, venuesLoading, venuesError, onRetryVenues, venueId, usualVenueId, onPickVenue, onState }: DateSheetProps) {
  const [q, setQ] = useState('');
  const term = q.trim().toLowerCase();
  const all = venues ?? [];
  const usual = all.find((v) => v.id === usualVenueId) ?? null;
  const list = all
    .filter((v) => !term || `${v.name} ${v.city_name ?? ''} ${v.neighbourhood ?? ''}`.toLowerCase().includes(term))
    .slice(0, 40);
  const pick = (id: string | null) => { onPickVenue(id); onState(null); };
  const item = (v: VenueOption, sub?: string) => (
    <button
      key={v.id}
      type="button"
      onClick={() => pick(v.id)}
      aria-pressed={v.id === venueId}
      data-testid="venue-option"
      className="flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[8px] text-left"
    >
      <MapPin aria-hidden="true" className="h-[16px] w-[16px] shrink-0 text-[var(--mut)]" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] text-[var(--fg)]">{v.name}</span>
        <span className="block truncate text-[13px] text-[var(--mut)]">{sub ?? [v.neighbourhood, v.city_name].filter(Boolean).join(', ')}</span>
      </span>
      {v.id === venueId && <Check aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--gold)]" />}
    </button>
  );
  return (
    <div className="space-y-[12px]" data-testid="date-venue-view">
      <SearchField value={q} onChange={setQ} aria-label="Search venues" placeholder="Search venues" autoFocusInSheet testId="venue-search" />
      <p className="text-[13px] text-[var(--mut)]">Only this date moves. The city follows the venue.</p>
      {venuesLoading ? (
        <SkeletonRows count={3} label="Loading venues" />
      ) : !venues && venuesError ? (
        <ErrorState title="Venues did not load" onRetry={() => onRetryVenues?.()} testId="date-venue-error" />
      ) : (
        <Card>
          {usual && !term && item(usual, 'The usual venue')}
          {list.filter((v) => !(usual && !term && v.id === usual.id)).map((v) => item(v))}
          {list.length === 0 && <p className="px-[16px] py-[12px] text-[14px] text-[var(--mut)]">No venue matches.</p>}
        </Card>
      )}
    </div>
  );
}

// ---- cancel --------------------------------------------------------------------

function CancelView({ dateLabel, reasons, reasonsLoading, reasonsError, onRetryReasons, onCancelDate, commandBusy, commandError }: DateSheetProps) {
  const [reason, setReason] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const copy = confirmCopy('cancel_date', { subject: dateLabel, reason });
  return (
    <div className="space-y-[16px]" data-testid="date-cancel-view">
      <div className="space-y-[8px]">
        <p className="text-[13px] font-semibold text-[var(--mut)]" id="cancel-reason-label">Why? Dancers see this.</p>
        {reasonsLoading ? (
          <SkeletonRows count={2} label="Loading reasons" />
        ) : !reasons && reasonsError ? (
          <ErrorState quiet title="Reasons did not load" onRetry={() => onRetryReasons?.()} testId="date-reasons-error" />
        ) : (
          <div className="flex flex-wrap gap-[8px]" role="group" aria-labelledby="cancel-reason-label">
            {(reasons ?? []).map((r) => (
              <Chip key={r.key} selected={reason === r.label} onToggle={() => setReason(r.label)} testId="cancel-reason">{r.label}</Chip>
            ))}
          </div>
        )}
      </div>
      <p className="text-[15px] text-[var(--fg)]">{copy.consequence} {copy.undo}</p>
      <label className="flex min-h-[44px] items-start gap-[12px] text-[15px] text-[var(--fg)]">
        <input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} className="mt-[4px] h-[20px] w-[20px] accent-[var(--gold)]" data-testid="cancel-ack" />
        {copy.ackLabel}
      </label>
      {commandError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="date-command-error">{commandError}</p>}
      <PrimaryButton disabled={!reason || !ack} loading={commandBusy} onClick={() => reason && onCancelDate(reason)} testId="date-cancel-confirm">
        {copy.confirmLabel}
      </PrimaryButton>
    </div>
  );
}
