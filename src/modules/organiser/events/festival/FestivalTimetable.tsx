import { useRef, useState } from 'react';
import { Copy, Plus } from 'lucide-react';
import { GhostButton } from '../../ui';
import { SessionSheet } from '../../sessions/SessionSheet';
import type { SearchPeopleFn } from '../../sessions/SessionCard';
import { MAX_SESSIONS, newSession, type SessionDraft, type SessionPerson } from '../../sessions/sessionsModel';
import { copyDay, copyTargets, nightDate, setDaySessions, type FestivalDraft } from './festivalModel';
import { dayWord } from './FestivalNights';

export interface FestivalTimetableProps {
  draft: FestivalDraft;
  onChange: (next: FestivalDraft) => void;
  search: SearchPeopleFn;
}

/** The OPTIONAL workshop timetable: a day at a time, the C4 session card, "Copy a day". Works after Go live too. */
export function FestivalTimetable({ draft, onChange, search }: FestivalTimetableProps) {
  const [editing, setEditing] = useState<number | null>(null);
  const [copying, setCopying] = useState<number | null>(null);
  const [recent, setRecent] = useState<SessionPerson[]>([]);
  const opener = useRef<HTMLButtonElement>(null);
  const edit = (i: number) => {
    // An empty day opens with one workshop to fill in (the sheet needs at least one card).
    if (draft.timetable[i]?.length === 0) onChange(setDaySessions(draft, i, [newSession('workshop', '12:00')]));
    setEditing(i);
  };
  return (
    <div className="space-y-[8px]" data-testid="festival-timetable">
      {draft.nights.map((_n, i) => {
        const list = draft.timetable[i] ?? [];
        return (
          <div key={draft.nights[i].id} className="rounded-[var(--r-card,16px)] border border-[var(--line)] bg-[var(--card)] p-[12px]" data-testid={`festival-day-${i}`}>
            <div className="flex min-h-[44px] items-center justify-between gap-[8px]">
              <span className="text-[16px] font-semibold text-[var(--fg)]">{dayWord(nightDate(draft, i))}</span>
              <span className="text-[15px] text-[var(--mut)]" data-testid={`festival-day-${i}-count`}>{list.length === 0 ? 'No sessions' : list.length === 1 ? '1 session' : `${list.length} sessions`}</span>
            </div>
            <div className="flex gap-[8px]">
              <GhostButton size="sm" ref={editing === i ? opener : undefined} onClick={() => edit(i)} testId={`festival-day-${i}-edit`}>
                <Plus aria-hidden="true" className="h-[18px] w-[18px]" />{list.length ? 'Edit sessions' : 'Add sessions'}
              </GhostButton>
              <GhostButton size="sm" disabled={list.length === 0 || draft.nights.length < 2} onClick={() => setCopying(copying === i ? null : i)} testId={`festival-day-${i}-copy`}>
                <Copy aria-hidden="true" className="h-[18px] w-[18px]" />Copy a day
              </GhostButton>
            </div>
            {list.length === 0 && <p className="mt-[4px] text-[13px] text-[var(--mut)]">Add a class or workshop so dancers see the timetable.</p>}
            {copying === i && (
              <div className="mt-[8px] grid grid-cols-2 gap-[8px]" data-testid={`festival-day-${i}-targets`}>
                {copyTargets(draft, i).map((k) => (
                  <GhostButton key={k} size="sm" onClick={() => { onChange(copyDay(draft, i, k)); setCopying(null); }} testId={`festival-day-${i}-to-${k}`}>to {dayWord(nightDate(draft, k))}</GhostButton>
                ))}
              </div>
            )}
          </div>
        );
      })}
      {editing !== null && (
        <SessionSheet
          open
          onOpenChange={(o) => { if (!o) setEditing(null); }}
          title={dayWord(nightDate(draft, editing))}
          sessions={draft.timetable[editing] as SessionDraft[]}
          onSave={(next) => onChange(setDaySessions(draft, editing, next))}
          search={search}
          recent={recent}
          onRecentChange={setRecent}
          max={MAX_SESSIONS}
          returnFocusRef={opener}
        />
      )}
    </div>
  );
}
