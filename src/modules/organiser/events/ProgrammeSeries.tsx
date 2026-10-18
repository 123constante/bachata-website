import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { londonTodayKey } from '@/lib/londonDate';
import { dateLabel } from '@/modules/organiser/shared/homeModel';
import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { LevelText } from '@/modules/organiser/shared/components/LevelText';
import { useFlowHome } from '@/modules/organiser/flows/add/useFlow';
import { EventConflict, SendButton, StepError, useEventSend } from '@/modules/organiser/flows/event';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { AnnounceRegion, Card, ErrorState, GhostButton, SkeletonRows, useAnnounce } from '../ui';
import { useEventWorkspace } from './eventsApi';
import type { EventWorkspace } from './eventModel';
import { useRecentPeople, useSeriesRole } from './programmeSeriesApi';
import { ProgrammeSheet, type SheetState } from './ProgrammeSheet';
import {
  START_SECTIONS, addSession, differingDates, differsLabel, itemName, lengthLine, moveOff, moveSession, parseTree,
  programCommand, programmeOff, removeConfirmCopy, removeSession, roleWord, sectionWord, sessionCount, timeLine, treeDirty, typeWord, updateItem, validateTree,
  type PItem, type PSection, type PTree,
} from './programmeSeriesModel';

const BTN = 'inline-flex h-[44px] w-[44px] shrink-0 items-center justify-center rounded-[12px] text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-40';
const REASON_ID = 'prog-off-reason';

/** "Ana, Ben +2" for a session row, with the role word once. */
const lineupLine = (it: PItem): string | null => {
  if (it.people.length === 0) return null;
  const names = it.people.slice(0, 2).map((p) => `${p.name} (${roleWord(p.role)})`);
  return it.people.length > 2 ? `${names.join(', ')} +${it.people.length - 2}` : names.join(', ');
};

function SessionRow({ it, tree, off, onOpen, onMove, onRemove }: {
  it: PItem; tree: PTree; off: string | null; onOpen: () => void; onMove: (dir: -1 | 1) => void; onRemove: () => void;
}) {
  const [confirm, setConfirm] = useState(false);
  const lineup = lineupLine(it);
  const length = lengthLine(it);
  const levels = it.levels.map((l) => <span key={l} className="rounded-[6px] bg-[var(--card2)] px-[6px] py-[1px] text-[12px] text-[var(--fg)]"><LevelText level={l} /></span>);
  const main = (
    <span className="min-w-0 flex-1 text-left">
      <span className="block truncate text-[15px] font-semibold text-[var(--fg)]" data-testid="prog-item-name">{itemName(it)}</span>
      <span className="block break-words text-[13px] text-[var(--mut)]" data-testid="prog-item-time">{timeLine(it)}{length ? ` \u00b7 ${length}` : ''}</span>
      {lineup && <span className="block break-words text-[13px] text-[var(--mut)]" data-testid="prog-item-lineup">{lineup}</span>}
      {levels.length > 0 && <span className="mt-[2px] flex flex-wrap gap-[4px]" data-testid="prog-item-levels">{levels}</span>}
    </span>
  );
  return (
    <div data-testid="prog-item" className="px-[8px] py-[4px]">
      <div className="flex min-h-[52px] items-center gap-[4px]">
        {off ? <div className="flex min-w-0 flex-1 items-center px-[8px] py-[4px]">{main}</div> : (
          <button type="button" onClick={onOpen} className="flex min-h-[52px] min-w-0 flex-1 items-center px-[8px] py-[4px]" data-testid="prog-item-open">{main}</button>
        )}
        <button type="button" className={BTN} disabled={!!off || !!moveOff(tree, it.key, -1)} aria-label={`Move ${itemName(it)} up`}
          aria-describedby={off ? REASON_ID : undefined} onClick={() => onMove(-1)} data-testid="prog-up"><ArrowUp aria-hidden="true" className="h-[18px] w-[18px]" /></button>
        <button type="button" className={BTN} disabled={!!off || !!moveOff(tree, it.key, 1)} aria-label={`Move ${itemName(it)} down`}
          aria-describedby={off ? REASON_ID : undefined} onClick={() => onMove(1)} data-testid="prog-down"><ArrowDown aria-hidden="true" className="h-[18px] w-[18px]" /></button>
        <button type="button" className={cn(BTN, 'text-[var(--danger)]')} disabled={!!off} aria-label={`Remove ${itemName(it)}`}
          aria-describedby={off ? REASON_ID : undefined} onClick={() => setConfirm(true)} data-testid="prog-delete"><Trash2 aria-hidden="true" className="h-[18px] w-[18px]" /></button>
      </div>
      {confirm && !off && (
        <div role="group" aria-label="Confirm remove" className="mb-[8px] space-y-[8px] rounded-[12px] bg-[var(--card2)] p-[12px]" data-testid="prog-delete-confirm">
          <p className="text-[14px] text-[var(--fg)]" data-testid="prog-delete-copy">{removeConfirmCopy(itemName(it))}</p>
          <div className="flex gap-[8px]">
            <GhostButton size="sm" block={false} onClick={() => setConfirm(false)} testId="prog-delete-keep">Keep it</GhostButton>
            <GhostButton size="sm" block={false} onClick={() => { setConfirm(false); onRemove(); }} testId="prog-delete-yes">Remove it</GhostButton>
          </div>
        </div>
      )}
    </div>
  );
}

function SectionCard({ section, tree, off, onOpen, onMove, onRemove, readOnly }: {
  section: PSection; tree: PTree; off: string | null; onOpen: (key: string) => void; onMove: (key: string, dir: -1 | 1) => void; onRemove: (key: string) => void; readOnly: boolean;
}) {
  return (
    <section aria-label={sectionWord(section)} data-testid="prog-section">
      <p className="px-[4px] pb-[6px] text-[13px] font-semibold text-[var(--mut)]" data-testid="prog-section-title">{sectionWord(section)}</p>
      <Card>
        {section.items.map((it) => readOnly ? (
          <div key={it.key} data-testid="prog-item" className="px-[16px] py-[10px]">
            <p className="truncate text-[15px] font-semibold text-[var(--fg)]" data-testid="prog-item-name">{itemName(it)}</p>
            <p className="truncate text-[13px] text-[var(--mut)]" data-testid="prog-item-time">{[timeLine(it), lengthLine(it), typeWord(it.type)].filter(Boolean).join(' \u00b7 ')}</p>
            {lineupLine(it) && <p className="truncate text-[13px] text-[var(--mut)]" data-testid="prog-item-lineup">{lineupLine(it)}</p>}
          </div>
        ) : (
          <SessionRow key={it.key} it={it} tree={tree} off={off} onOpen={() => onOpen(it.key)} onMove={(d) => onMove(it.key, d)} onRemove={() => onRemove(it.key)} />
        ))}
      </Card>
    </section>
  );
}

function ProgrammeBody({ ws, today }: { ws: EventWorkspace; today: string }) {
  const seriesId = ws.series.id;
  const original = useMemo(() => parseTree(ws.program), [ws.program]);
  const [draft, setDraft] = useState<PTree>(original);
  const [sheet, setSheet] = useState<SheetState>(null);
  const [message, announce] = useAnnounce();
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const { role, loading: roleLoading } = useSeriesRole(seriesId);
  const recent = useRecentPeople(seriesId);
  const festival = ws.series.format === 'festival';
  const off = programmeOff({ format: ws.series.format, lifecycle: ws.series.lifecycle_status, canEdit: role !== null });
  const differing = differingDates(ws.dates, today);
  const problems = validateTree(draft, original);
  const dirty = treeDirty(draft, original);
  const open = sheet ? Object.values(draft.days).flatMap((d) => d.sections.flatMap((s) => s.items)).find((i) => i.key === sheet.key) ?? null : null;
  const total = sessionCount(draft);

  if (conflict) return <EventConflict seriesId={seriesId} />;
  // Until organiser_home_v1 says who is looking, the "who may change it" reason would be a guess (REVIEW-SW1 N4).
  if (roleLoading) return <SkeletonRows count={4} label="Loading the programme" testId="org-programme-role-loading" />;
  const update = (key: string, fn: (it: PItem) => PItem) => setDraft((t) => {
    const it = t.days.flatMap((d) => d.sections.flatMap((s) => s.items)).find((i) => i.key === key);
    return it ? updateItem(t, key, fn(it)) : t;
  });
  const add = (kind: string, type: string) => {
    const r = addSession(draft, kind, type);
    setDraft(r.tree);
    setSheet({ view: 'session', key: r.key });
  };
  const save = () => {
    const command = programCommand(draft, original);
    if (command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Saved' });
  };
  const saveReason = off ?? (!dirty ? 'Nothing changed yet' : problems.length ? 'Fix the highlighted session first' : null);
  const multiDay = draft.days.length > 1;

  return (
    <>
      {off && <p id={REASON_ID} className="px-[4px] text-[14px] text-[var(--mut)]" data-testid="prog-off-reason">{off}</p>}
      {differing.length > 0 && (
        <div className="space-y-[6px] rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-[12px]" data-testid="prog-differs">
          <p className="text-[14px] font-semibold text-[var(--fg)]" data-testid="prog-differs-badge">{differsLabel(differing.length)}</p>
          <p className="text-[13px] text-[var(--mut)]">Those dates keep their own changes when you edit a session here. Removing a session takes its date changes with it.</p>
          <div className="flex flex-col">
            {differing.slice(0, 5).map((d) => (
              <Link key={d.id} to={ORG_PATHS.dateLineup(seriesId, d.id)} data-testid="prog-differs-link" className="flex min-h-[44px] items-center text-[14px] text-[var(--gold)] underline">
                {dateLabel(d.occurrence_date, today)}
              </Link>
            ))}
            {differing.length > 5 && <p className="text-[13px] text-[var(--mut)]">and {differing.length - 5} more</p>}
          </div>
        </div>
      )}
      {total === 0 && (
        <p className="px-[4px] text-[14px] text-[var(--mut)]" data-testid="prog-empty">
          {festival ? 'This festival has no days listed yet.' : off ? 'No sessions are listed on this event.' : 'No sessions yet. Add a class or a party so dancers see what is on.'}
        </p>
      )}
      {draft.days.map((day, di) => (
        <div key={day.key} className="flex flex-col gap-3" data-testid="prog-day">
          {(multiDay || festival) && <p className="px-[4px] text-[15px] font-bold text-[var(--fg)]" data-testid="prog-day-title">{`DAY ${di + 1}${typeof day.raw.label === 'string' && day.raw.label ? `: ${day.raw.label}` : ''}`}</p>}
          {day.sections.filter((s) => s.items.length > 0).map((s) => (
            <SectionCard key={s.key} section={s} tree={draft} off={off} readOnly={festival}
              onOpen={(key) => setSheet({ view: 'session', key })}
              onMove={(key, dir) => setDraft((t) => moveSession(t, key, dir))}
              onRemove={(key) => { setDraft((t) => removeSession(t, key)); announce('Session removed. Save to keep it.'); }} />
          ))}
        </div>
      ))}
      {!festival && (
        <div className="flex flex-wrap gap-[8px]" data-testid="prog-add-row">
          {START_SECTIONS.map((kind) => (
            <GhostButton key={kind} size="sm" block={false} disabled={!!off} aria-describedby={off ? REASON_ID : undefined}
              onClick={() => add(kind, kind === 'party' ? 'party' : 'class')} testId={`prog-add-${kind}`}>
              <Plus aria-hidden="true" className="h-[16px] w-[16px]" /> Add {kind === 'party' ? 'a party' : 'a class'}
            </GhostButton>
          ))}
        </div>
      )}
      {!festival && <SendButton label="Save" testId="prog-save" reason={saveReason} busy={busy} onSend={save} />}
      <StepError text={error} />
      <AnnounceRegion message={message} />
      <ProgrammeSheet state={off ? null : sheet} onState={setSheet} item={open} update={update} problems={problems}
        recent={recent.data ?? []} recentLoading={recent.isLoading} announce={announce} />
    </>
  );
}

/**
 * /account/o/events/:seriesId/programme (SW1): the sessions and line-up of the whole
 * series, in the admin editor's shape (Classes, Party; type, name, times, length,
 * order, remove, levels, people with role and level). ONE series.set_program with the
 * complete tree, behind the platform gate (AW1_APPLIED). A festival's day tree is shown
 * read only. A course edits like a recurring series.
 */
export default function ProgrammeSeries() {
  const { seriesId = '' } = useParams();
  const home = useFlowHome();
  const ws = useEventWorkspace(seriesId);
  const today = home.data?.today ?? londonTodayKey();
  return (
    <OrganiserShell title="Programme" back={{ to: ORG_PATHS.eventDetails(seriesId), label: 'Back' }} testId="org-page-programme">
      <div className="flex flex-col gap-3 p-3">
        {ws.isError && isAccessRefusal(ws.error) ? <NoAccess />
          : ws.isError ? <ErrorState onRetry={() => void ws.refetch()} retrying={ws.isFetching} testId="org-programme-error" />
          : !ws.data ? <SkeletonRows count={4} label="Loading the programme" testId="org-programme-loading" />
            : <ProgrammeBody key={ws.data.series.version} ws={ws.data} today={today} />}
      </div>
    </OrganiserShell>
  );
}
