import { useId, useMemo, useState, type RefObject } from 'react';
import { Plus } from 'lucide-react';
import { GhostButton, PrimaryButton, SheetView } from '../ui';
import { SessionCard, type SearchPeopleFn } from './SessionCard';
import {
  addAnother,
  addRoom,
  blockingIssues,
  canAddAnother,
  canRemoveSession,
  capReason,
  LAST_SESSION_REASON,
  MAX_SESSIONS,
  savedSnapshot,
  nightSpan,
  pushRecent,
  removeRoom,
  removeSession,
  roomVisible,
  sortSessions,
  type SessionDraft,
  type SessionPerson,
} from './sessionsModel';

export interface SessionSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The sessions of ONE date (create, event page, one date, a festival day). */
  sessions: SessionDraft[];
  onSave: (next: SessionDraft[]) => void;
  search: SearchPeopleFn;
  recent: readonly SessionPerson[];
  onRecentChange: (next: SessionPerson[]) => void;
  max?: number;
  title?: string;
  /** The control that opened the sheet (use `useOpenerRef` in the parent that stays mounted). */
  returnFocusRef?: RefObject<HTMLElement>;
}

/**
 * The session editor in a bottom sheet. Edits a local copy; Done hands the
 * time-ordered list up (an untouched list closes without saving), Escape or Close drops it. Focus moves into the sheet
 * and returns to the opener (SheetView).
 */
export function SessionSheet({ open, onOpenChange, sessions, onSave, search, recent, onRecentChange, max, title = 'Sessions', returnFocusRef }: SessionSheetProps) {
  const [initial] = useState<SessionDraft[]>(() => sortSessions(sessions));
  const [list, setList] = useState<SessionDraft[]>(initial);
  const reasonId = useId();
  const addReasonId = useId();
  // F-C4-10: closing with unsaved changes asks first.
  const [leaving, setLeaving] = useState(false);
  const initialSnapshot = useMemo(() => savedSnapshot(initial), [initial]);
  const untouched = savedSnapshot(list) === initialSnapshot;
  // Only new or changed sessions block Done: a stored problem never traps the list.
  const issues = untouched ? [] : blockingIssues(initial, list);
  const rooms = roomVisible(list);
  const roomsFilled = list.filter((s) => (s.room ?? '').trim() !== '').length;
  const cap = max ?? MAX_SESSIONS;
  const canAdd = canAddAnother(list, cap);
  const span = nightSpan(list);

  // Kept in time order while editing (rule 22); sortSessions is stable for equal starts.
  const change = (next: SessionDraft) => setList((cur) => sortSessions(cur.map((x) => (x.id === next.id ? next : x))));
  const requestOpen = (next: boolean) => {
    if (!next && !untouched) setLeaving(true);
    else onOpenChange(next);
  };
  const done = () => {
    if (issues.length > 0) return;
    if (!untouched) onSave(sortSessions(list));
    onOpenChange(false);
  };

  return (
    <SheetView
      open={open}
      onOpenChange={requestOpen}
      title={title}
      fullHeight
      returnFocusRef={returnFocusRef}
      footer={
        <div className="space-y-[6px]">
          {leaving && (
            <div role="group" aria-label="Unsaved changes" data-testid="sessions-leave" className="flex flex-wrap items-center justify-center gap-[8px] text-[13px] text-[var(--fg)]">
              <span>Leave without saving your changes?</span>
              <button type="button" onClick={() => onOpenChange(false)} className="min-h-[44px] px-[8px] font-semibold text-[var(--gold)]">Leave without saving</button>
              <button type="button" onClick={() => setLeaving(false)} className="min-h-[44px] px-[8px] font-semibold text-[var(--fg)]">Keep editing</button>
            </div>
          )}
          {issues.length > 0 && (
            <p id={reasonId} className="text-center text-[13px] text-[var(--mut)]" data-testid="sessions-reason">{issues[0].reason}</p>
          )}
          <PrimaryButton onClick={done} disabled={issues.length > 0} aria-describedby={issues.length > 0 ? reasonId : undefined} testId="sessions-done">
            Done
          </PrimaryButton>
        </div>
      }
    >
      <div className="space-y-[12px]" data-testid="sessions-list">
        {list.map((s, i) => (
          <SessionCard
            key={s.id}
            session={s}
            title={`Session ${i + 1}`}
            onChange={change}
            onRemove={canRemoveSession(list) ? () => setList((cur) => removeSession(cur, s.id)) : null}
            removeReason={LAST_SESSION_REASON}
            roomsFilled={roomsFilled}
            roomShown={rooms}
            onAddRoom={() => setList((cur) => addRoom(cur))}
            onRemoveRoom={() => setList((cur) => removeRoom(cur))}
            recent={recent}
            onPicked={(p) => onRecentChange(pushRecent(recent, p))}
            search={search}
          />
        ))}
        <GhostButton onClick={() => setList((cur) => addAnother(cur, cap))} disabled={!canAdd} aria-describedby={canAdd ? undefined : addReasonId} testId="sessions-add">
          <Plus aria-hidden="true" className="h-[18px] w-[18px]" />Add another session
        </GhostButton>
        {!canAdd && (
          <p id={addReasonId} className="text-center text-[13px] text-[var(--mut)]" data-testid="sessions-add-reason">{capReason(cap)}</p>
        )}
        {span && (
          <p className="text-center text-[13px] text-[var(--mut)]" data-testid="sessions-span">The night runs {span}</p>
        )}
      </div>
    </SheetView>
  );
}
