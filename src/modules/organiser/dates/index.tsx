import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Ban, Coffee, MapPin, Plus, RotateCcw } from 'lucide-react';
import { OrganiserShell, ORG_PATHS } from '../shell';
import {
  AnnounceRegion,
  Card,
  Collapse,
  DateChip,
  ErrorState,
  PreviewBar,
  SkeletonRows,
  StatusTag,
  SummaryRow,
  useAnnounce,
  useShake,
} from '../ui';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { newSession, notEditableCopy, type DraftSession } from '@/modules/organiser/shared/programmeModel';
import { fetchCancellationReasons } from '@/modules/organiser/shared/selfServeApi';
import { cancelCommand, skipDateCommand, uncancelCommand } from '@/modules/organiser/shared/seriesCommands';
import { UNSAVED_MESSAGE } from '@/modules/organiser/shared/editorGuards';
import { dateLabel as labelOf, isRuleDate } from '@/modules/organiser/shared/seriesModel';
import { dateLock, dateTag } from '@/modules/organiser/shared/eventState';
import { useVenueOptions, venueName } from '@/modules/organiser/shared/publicVenues';
import { londonTodayKey } from '@/lib/londonDate';
import { DateSheet, type SheetState } from './DateSheet';
import { DatePreview } from './DatePreview';
import { byTime, dateSpan, peopleLabel, sessionLevelsLabel, sessionName, spanLabel, timesLabel, typeLabel, typeTone } from './dateModel';
import { useDateEditor } from './useDateEditor';

const cancellationReasonsQueryKey = ['cancellation-reasons'] as const;

/**
 * /account/o/events/:seriesId/dates/:occurrenceId -- ONE date: its venue, its
 * SCHEDULE (sessions with their people), break week and cancel. Every editor is
 * a view of one SheetView; the only primary button is Save in the PreviewBar.
 */
export default function DatePage() {
  const { seriesId = '', occurrenceId = '' } = useParams();
  const navigate = useNavigate();
  const ed = useDateEditor(seriesId, occurrenceId);
  const venues = useVenueOptions();
  const [sheet, setSheet] = useState<SheetState>(null);
  const [leaving, setLeaving] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [commandError, setCommandError] = useState<string | null>(null);
  const [message, announce] = useAnnounce();
  const { shake, shakeProps } = useShake();
  const errorRef = useRef<HTMLParagraphElement>(null);
  const reasons = useQuery({
    queryKey: cancellationReasonsQueryKey,
    queryFn: fetchCancellationReasons,
    enabled: sheet?.view === 'cancel',
    staleTime: 60 * 60 * 1000,
  });

  useUnsavedChangesGuard({ enabled: ed.dirty && !ed.saving, message: UNSAVED_MESSAGE });

  const today = londonTodayKey();
  const series = ed.workspace.data?.series ?? null;
  const date = ed.base?.occurrenceDate ?? ed.detail.data?.date ?? null;
  const label = date ? labelOf(date, today) : 'This date';
  const cancelled = ed.detail.data?.cancelled ?? false;
  const editable = !!ed.base?.editable;
  const live = series?.lifecycle_status === 'live';
  const span = dateSpan(ed.rows);
  const venue = venueName(venues.data, ed.venueId);
  const venueCity = venues.data?.find((v) => v.id === ed.venueId)?.city_name ?? null;
  const ruleDate = !!(date && series && isRuleDate(date, series));
  // Past dates and ended / archived events: the server refuses every owner write here.
  const lock = date && series ? dateLock(series.lifecycle_status, date, today) : null;
  const lockShort = !lock ? null : date && date < today ? 'This date has already happened.'
    : series?.lifecycle_status === 'ended' ? 'This event has ended.' : 'This event is archived.';
  const tag = cancelled ? dateTag('', 'cancelled') : series ? dateTag(series.lifecycle_status, 'scheduled') : null;

  const updateRow = (key: string, fn: (r: DraftSession) => DraftSession) =>
    ed.setRows((rows) => rows.map((r) => (r.key === key ? fn(r) : r)));
  const removeSession = (key: string) => {
    const row = ed.rows.find((r) => r.key === key);
    if (!row) return;
    // A saved session stays, greyed with Undo, until the save; one added here just goes (Collapse, then out of the draft).
    if (row.original) updateRow(key, (r) => ({ ...r, removed: true }));
    else setLeaving((s) => new Set(s).add(key));
    announce(`${sessionName(row)} taken off ${label}.`);
  };
  const addSession = () => {
    const row = newSession('class');
    ed.setRows((rows) => [...rows, row]);
    setSheet({ view: 'session', key: row.key });
  };

  const fail = (text: string) => {
    setError(text);
    shake();
    requestAnimationFrame(() => errorRef.current?.focus());
  };

  const onSave = async () => {
    setError(null);
    const out = await ed.save();
    if (out.ok) {
      setLeaving(new Set());
      announce(out.changed ? `${label} is saved.` : 'Nothing needed saving.');
    } else if (out.message) {
      fail(out.message);
    }
  };

  const command = async (kind: 'series' | 'occurrence', cmd: Parameters<typeof ed.runCommand>[1], done: string, after?: () => void) => {
    setCommandError(null);
    const out = await ed.runCommand(kind, cmd);
    if (!out.ok) {
      setCommandError(out.message ?? null);
      shake();
      return;
    }
    setSheet(null);
    announce(done);
    after?.();
  };

  const loading = ed.programme.isLoading || (!ed.base && !ed.programme.isError);
  const loadError = ed.programme.isError || ed.syncFailed;

  const shown = byTime(ed.rows);

  const content = loadError && !ed.saving ? (
    <ErrorState
      title="This date did not load"
      body="Check your connection, then try again."
      onRetry={() => void (ed.syncFailed ? ed.resync() : ed.programme.refetch())}
      retrying={ed.programme.isFetching}
      testId="date-load-error"
    />
  ) : loading ? (
    <SkeletonRows count={4} label="Loading this date" />
  ) : (
    <div className="space-y-[16px] pb-[8px]">
      <header className="flex items-center gap-[12px]" data-testid="date-header">
        {date && <DateChip date={date} />}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[20px] font-bold text-[var(--fg)]" data-testid="date-title">{date ? labelOf(date, '') : label}</h1>
          <p className="truncate text-[14px] text-[var(--mut)]" data-testid="date-span">
            {[series?.name, spanLabel(span) ?? 'No times yet'].filter(Boolean).join(' \u00b7 ')}
          </p>
        </div>
        {tag && <StatusTag tone={tag.tone} testId="date-status">{tag.label}</StatusTag>}
      </header>

      {cancelled && (
        <p className="rounded-[12px] bg-[var(--warn-bg)] px-[16px] py-[12px] text-[14px] text-[var(--warn-fg)]" data-testid="date-cancelled-note">
          Cancelled{ed.detail.data?.cancellationReason ? ` \u00b7 ${ed.detail.data.cancellationReason}` : ''}. Dancers see this.
        </p>
      )}

      {lock && (
        <p className="rounded-[12px] border border-[var(--line)] bg-[var(--card)] px-[16px] py-[12px] text-[14px] text-[var(--fg)]" data-testid="date-locked-note">
          {lock}
        </p>
      )}

      {error && (
        <p ref={errorRef} tabIndex={-1} role="alert" className="rounded-[12px] bg-[var(--card)] px-[16px] py-[12px] text-[14px] text-[var(--danger)] outline-none" data-testid="date-save-error">
          {error}
        </p>
      )}

      <Card label="Where">
        <SummaryRow
          icon={<MapPin />}
          label="Venue"
          sublabel={venueCity ?? undefined}
          value={venue ?? 'Choose a venue'}
          onPress={cancelled ? undefined : () => setSheet({ view: 'venue' })}
          disabled={!!lock}
          testId="date-venue"
        />
      </Card>

      <section aria-labelledby="schedule-label" className="space-y-[8px]">
        <h2 id="schedule-label" className="px-[4px] text-[13px] font-semibold uppercase tracking-[.04em] text-[var(--mut)]">Schedule</h2>
        {!editable && ed.base && !lock && (
          <p className="px-[4px] text-[13px] text-[var(--mut)]" data-testid="date-readonly-note">{notEditableCopy(ed.base.notEditableReason)}</p>
        )}
        <div className="overflow-hidden rounded-[16px] border border-[var(--line)] bg-[var(--card)]" data-testid="date-schedule">
          {shown.length === 0 && <p className="px-[16px] py-[12px] text-[14px] text-[var(--mut)]" data-testid="date-schedule-empty">No sessions on this date yet.</p>}
          {shown.map((row) => (
            <Collapse
              key={row.key}
              show={!leaving.has(row.key)}
              testId="session-collapse"
              onExited={() => {
                ed.setRows((rows) => rows.filter((r) => r.key !== row.key));
                setLeaving((s) => { const n = new Set(s); n.delete(row.key); return n; });
              }}
            >
              <SessionRow
                row={row}
                problem={ed.validation.rows.some((p) => p.key === row.key)}
                onOpen={editable && !row.removed ? () => setSheet({ view: 'session', key: row.key }) : undefined}
                onUndo={editable && row.removed ? () => { updateRow(row.key, (r) => ({ ...r, removed: false })); announce(`${sessionName(row)} is back on.`); } : undefined}
              />
            </Collapse>
          ))}
          {editable && (
            <button
              type="button"
              onClick={addSession}
              className="flex min-h-[52px] w-full items-center gap-[8px] px-[16px] text-[15px] font-semibold text-[var(--gold)]"
              data-testid="date-add-session"
            >
              <Plus aria-hidden="true" className="h-[20px] w-[20px]" /> Add a session
            </button>
          )}
        </div>
      </section>

      <Card label="This date">
        {cancelled ? (
          <SummaryRow icon={<RotateCcw />} label="Put this date back on" sublabel={lockShort ?? 'It goes ahead as usual.'} disabled={!!lock}
            onPress={() => { setCommandError(null); setSheet({ view: 'uncancel' }); }} testId="date-uncancel" />
        ) : (
          <>
            {ruleDate && (
              <SummaryRow icon={<Coffee />} label="Break this week" sublabel={lockShort ?? (ed.dirty ? 'Save your changes first.' : 'Skip this date. No cancellation shows.')}
                disabled={ed.dirty || !!lock} onPress={() => { setCommandError(null); setSheet({ view: 'break' }); }} testId="date-break" />
            )}
            <SummaryRow icon={<Ban />} label="Cancel this date" sublabel={lockShort ?? (ed.dirty ? 'Save your changes first.' : 'Dancers see Cancelled and your reason.')}
              disabled={ed.dirty || !!lock} onPress={() => { setCommandError(null); setSheet({ view: 'cancel' }); }} testId="date-cancel" />
          </>
        )}
      </Card>
    </div>
  );

  return (
    <OrganiserShell
      title={label}
      back={{ to: ORG_PATHS.event(seriesId), label: 'Event' }}
      testId="org-page-date"
      actionBar={
        // Nothing to save until the date has loaded: loading shows skeletons only,
        // and a failed load's Try again is the one primary button.
        ed.base && !(loadError && !ed.saving) && <PreviewBar
          preview={<DatePreview label={date ? labelOf(date, '') : label} span={span} venue={venue} rows={ed.rows} cancelled={cancelled} reason={ed.detail.data?.cancellationReason ?? null} />}
          actionLabel="Save changes"
          onAction={() => void onSave()}
          loading={ed.saving}
          disabled={!ed.dirty || !ed.base}
          live={live}
          compact={!ed.dirty && !ed.saving}
          summary={lock ? 'Nothing to change here' : 'All changes saved'}
          shakeProps={shakeProps}
          testId="date-preview-bar"
        />
      }
    >
      {content}
      <AnnounceRegion message={message} />
      <DateSheet
        state={sheet}
        onState={setSheet}
        rows={ed.rows}
        updateRow={updateRow}
        removeSession={removeSession}
        problems={ed.validation.rows}
        editable={editable}
        announce={announce}
        venues={venues.data}
        venuesLoading={venues.isLoading}
        venuesError={venues.isError}
        onRetryVenues={() => void venues.refetch()}
        venueId={ed.venueId}
        usualVenueId={series?.default_venue_id ?? null}
        onPickVenue={ed.pickVenue}
        dateLabel={label}
        reasons={reasons.data}
        reasonsLoading={reasons.isLoading}
        reasonsError={reasons.isError}
        onRetryReasons={() => void reasons.refetch()}
        onCancelDate={(reason) => void command('occurrence', cancelCommand(reason), `${label} is cancelled.`)}
        onUncancelDate={() => void command('occurrence', uncancelCommand(), `${label} is back on.`)}
        onBreak={() => void command('series', skipDateCommand(occurrenceId), `${label} is a break.`, () => navigate(ORG_PATHS.event(seriesId)))}
        commandBusy={ed.commandBusy}
        commandError={commandError}
      />
    </OrganiserShell>
  );
}

function SessionRow({ row, problem, onOpen, onUndo }: { row: DraftSession; problem: boolean; onOpen?: () => void; onUndo?: () => void }) {
  const people = peopleLabel(row);
  const meta = [timesLabel(row), sessionLevelsLabel(row)].filter(Boolean).join(' \u00b7 ');
  const body = (
    <span className={`flex min-w-0 flex-1 flex-col gap-[4px] text-left ${row.removed ? 'opacity-[.72]' : ''}`}>
      <span className="flex min-w-0 items-center gap-[8px]">
        <StatusTag tone={typeTone(row.type)} className="shrink-0">{typeLabel(row.type)}</StatusTag>
        <span className={`truncate text-[15px] font-semibold text-[var(--fg)] ${row.removed ? 'line-through' : ''}`} data-testid="session-row-name">{sessionName(row)}</span>
      </span>
      {/* A faded row's muted text would fall under 4.5:1, so it switches to --fg. */}
      {meta && <span className={`truncate text-[13px] ${row.removed ? 'text-[var(--fg)]' : 'text-[var(--mut)]'}`} data-testid="session-row-meta">{meta}</span>}
      {!row.removed && (
        <span className={`truncate text-[13px] ${people ? 'text-[var(--fg)]' : 'text-[var(--mut)]'}`} data-testid="session-row-people">
          {people ?? (row.type === 'performance' ? 'Performers added by the team' : row.type === 'party' ? 'No DJ yet' : 'No teacher yet')}
        </span>
      )}
      {row.removed && <span className="text-[13px] text-[var(--fg)]">Comes off this date when you save</span>}
      {problem && !row.removed && <span className="text-[13px] text-[var(--danger)]" data-testid="session-row-problem">Needs a fix before saving</span>}
    </span>
  );
  return (
    <div className="flex min-h-[64px] items-center gap-[8px] border-b border-[var(--line)] px-[16px] py-[12px]" data-testid="session-row" data-removed={row.removed || undefined}>
      {onOpen ? (
        <button type="button" onClick={onOpen} className="flex min-h-[44px] min-w-0 flex-1 items-center" data-testid="session-row-open">{body}</button>
      ) : body}
      {onUndo && (
        <button type="button" onClick={onUndo} className="min-h-[44px] shrink-0 px-[8px] text-[15px] font-semibold text-[var(--gold)]" data-testid="session-row-undo">Undo</button>
      )}
    </div>
  );
}
