import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { ORGANISER_HOME_KEY } from '@/modules/organiser/shared/selfServeApi';
import { EventConflict, StepError } from '@/modules/organiser/flows/event';
import {
  cancelInvite, FAILURE_TEXT, inviteOrganiser, leaveEvent, OrganiserApiError, organisersQueryKey, removeOrganiserPage, searchOrganiserPages,
  useSeriesOrganisers,
} from '../organisers/organiserApi';
import { canOffer, viewerRole as viewerRoleOf, withInvited, type OrganiserRow } from '../organisers/organiserModel';
import { OrganiserShell, ORG_PATHS } from '../shell';
import { Card, ErrorState, GhostButton, PersonRow, SearchField, SheetView, SkeletonRows, useDebounced, useOpenerRef } from '../ui';
import { useEventWorkspace } from './eventsApi';
import type { EventWorkspace } from './eventModel';
import { useSeriesRole } from './programmeSeriesApi';
import { BLOCK_TEXT, controlFor, INVITE_LABEL, INVITED_LABEL, LEAVE_CONFIRM, LEAVE_LABEL, removeNote, ROLE_WORD, rowAction, SEARCH_ALL_TAKEN, SEARCH_HINT, SEARCH_NONE } from './organisersModel';

/** Search ANY organiser page; tapping a result sends the invite at once. */
function InviteSheet({ open, onClose, rows, onPick }: { open: boolean; onClose: () => void; rows: OrganiserRow[]; onPick: (page: { id: string; name: string }) => void }) {
  const opener = useOpenerRef(open);
  const [text, setText] = useState('');
  const query = useDebounced(text.trim());
  const found = useQuery({ queryKey: ['org-organiser-search', query], queryFn: () => searchOrganiserPages(query), enabled: open && query.length >= 2, retry: false });
  const offer = (found.data ?? []).filter((p) => canOffer(rows, p.id));
  return (
    <SheetView open={open} returnFocusRef={opener} onOpenChange={(next) => { if (!next) { setText(''); onClose(); } }} title={INVITE_LABEL} fullHeight testId="org-invite-sheet">
      <div className="space-y-[12px]" data-testid="org-invite-view">
        <SearchField value={text} onChange={setText} aria-label="Search organiser pages" placeholder="Page name" testId="org-invite-search" autoFocusInSheet />
        {query.length < 2 ? <p className="text-[14px] text-[var(--mut)]" data-testid="org-invite-hint">{SEARCH_HINT}</p>
          : found.isLoading ? <SkeletonRows count={3} label="Searching" />
          : found.isError ? <p className="text-[14px] text-[var(--mut)]" data-testid="org-invite-fail">{FAILURE_TEXT.failed}</p>
          : offer.length === 0 ? <p className="text-[14px] text-[var(--mut)]" data-testid="org-invite-none">{(found.data ?? []).length ? SEARCH_ALL_TAKEN : SEARCH_NONE}</p> : (
            <Card testId="org-invite-results">
              {offer.map((p) => (
                <PersonRow key={p.id} testId="org-invite-result" name={p.name} onPress={() => { onPick(p); setText(''); onClose(); }}
                  trailing={<Plus aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--gold)]" />} />
              ))}
            </Card>
          )}
      </div>
    </SheetView>
  );
}

function LeaveSheet({ open, onClose, busy, onConfirm }: { open: boolean; onClose: () => void; busy: boolean; onConfirm: () => void }) {
  const opener = useOpenerRef(open);
  return (
    <SheetView open={open} returnFocusRef={opener} onOpenChange={(next) => { if (!next) onClose(); }} title={LEAVE_LABEL} testId="org-leave-sheet">
      <div className="space-y-[12px]" data-testid="org-leave-view">
        <p className="text-[14px] text-[var(--mut)]" data-testid="org-leave-note">{LEAVE_CONFIRM}</p>
        <GhostButton testId="org-leave-confirm" disabled={busy} onClick={onConfirm}>{LEAVE_LABEL}</GhostButton>
        <GhostButton testId="org-leave-stay" onClick={onClose}>Stay on this event</GhostButton>
      </div>
    </SheetView>
  );
}

const ROW_BTN = 'inline-flex h-[44px] shrink-0 items-center rounded-[12px] px-[12px] text-[14px] font-semibold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40';

function OrganisersBody({ ws, rows }: { ws: EventWorkspace; rows: OrganiserRow[] }) {
  const seriesId = ws.series.id;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { myPages } = useSeriesRole(seriesId);
  const myPageIds = myPages.map((p) => p.id);
  const role = viewerRoleOf(rows, myPageIds);
  const [inviting, setInviting] = useState(false);
  const [leaving, setLeaving] = useState<OrganiserRow | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const invite = controlFor(role, ws.series.lifecycle_status, 'invite');
  const key = organisersQueryKey(seriesId);
  const done = () => { void queryClient.invalidateQueries({ queryKey: key }); void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY }); };
  const onFail = (e: unknown) => {
    const kind = e instanceof OrganiserApiError ? e.kind : 'failed';
    if (kind === 'conflict') setConflict(true);
    else setFailure(FAILURE_TEXT[kind]);
  };
  const inviteM = useMutation({
    mutationFn: (page: { id: string; name: string }) => inviteOrganiser(seriesId, page.id),
    onSuccess: (inviteId, page) => { setFailure(null); queryClient.setQueryData<OrganiserRow[]>(key, (cur) => withInvited(cur ?? rows, page, inviteId)); done(); },
    onError: onFail,
  });
  const cancelM = useMutation({ mutationFn: (r: OrganiserRow) => cancelInvite(r.inviteId ?? ''), onSuccess: () => { setFailure(null); done(); }, onError: onFail });
  const removeM = useMutation({ mutationFn: (r: OrganiserRow) => removeOrganiserPage(seriesId, r.pageId), onSuccess: () => { setFailure(null); done(); }, onError: onFail });
  const leaveM = useMutation({
    mutationFn: (r: OrganiserRow) => leaveEvent(seriesId, r.pageId),
    onSuccess: () => { setLeaving(null); done(); navigate(ORG_PATHS.home); },
    onError: (e) => { setLeaving(null); onFail(e); },
  });
  const busy = inviteM.isPending || cancelM.isPending || removeM.isPending || leaveM.isPending;
  if (conflict) return <EventConflict seriesId={seriesId} />;
  const note = removeNote(role, rows);
  return (
    <>
      <p className="px-[4px] text-[14px] text-[var(--mut)]" data-testid="org-block-text">{BLOCK_TEXT}</p>
      <Card testId="org-linked">
        {rows.map((r) => {
          const action = rowAction(r, role, myPageIds);
          const word = r.status === 'invited' ? INVITED_LABEL : ROLE_WORD[r.role];
          return (
            <div key={r.pageId} className="flex items-center gap-[8px] pr-[8px]" data-testid="org-linked-row" data-role={r.role} data-status={r.status}>
              <div className="min-w-0 flex-1">
                <PersonRow name={r.name} role={word} onRemove={action === 'cancel' ? () => cancelM.mutate(r) : undefined} />
              </div>
              {action === 'remove' && <button type="button" disabled={busy} onClick={() => removeM.mutate(r)} data-testid="org-remove" className={ROW_BTN}>Remove</button>}
              {action === 'leave' && <button type="button" disabled={busy} onClick={() => setLeaving(r)} data-testid="org-leave" className={ROW_BTN}>{LEAVE_LABEL}</button>}
            </div>
          );
        })}
      </Card>
      {note && <p className="px-[4px] text-[13px] text-[var(--mut)]" data-testid="org-remove-note">{note}</p>}
      <GhostButton size="sm" block={false} disabled={!invite.on || busy} aria-describedby={invite.reason ? 'org-invite-reason' : undefined} onClick={() => setInviting(true)} testId="org-invite">
        <Plus aria-hidden="true" className="h-[16px] w-[16px]" /> {INVITE_LABEL}
      </GhostButton>
      {invite.reason && <p id="org-invite-reason" className="px-[4px] text-[13px] text-[var(--mut)]" data-testid="org-invite-reason">{invite.reason}</p>}
      <StepError text={failure} />
      <InviteSheet open={inviting && invite.on} onClose={() => setInviting(false)} rows={rows} onPick={(p) => inviteM.mutate(p)} />
      <LeaveSheet open={!!leaving} onClose={() => setLeaving(null)} busy={leaveM.isPending} onConfirm={() => { if (leaving) leaveM.mutate(leaving); }} />
    </>
  );
}

/**
 * /account/o/events/:seriesId/organisers (ER-C11): who runs the event. Every organiser can invite;
 * the owner removes a co-organiser; a co-organiser can only leave; nobody removes the owner.
 * Each change saves at once through its own RPC (no Save button).
 */
export default function SeriesOrganisers() {
  const { seriesId = '' } = useParams();
  const ws = useEventWorkspace(seriesId);
  const organisers = useSeriesOrganisers(seriesId);
  const failed = ws.isError ? ws.error : organisers.isError ? organisers.error : null;
  return (
    <OrganiserShell title="Organisers" back={{ to: ORG_PATHS.eventDetails(seriesId), label: 'Back' }} testId="org-page-organisers">
      <div className="flex flex-col gap-3 p-3">
        {failed && isAccessRefusal(failed) ? <NoAccess />
          : failed ? (
            <ErrorState onRetry={() => { void ws.refetch(); void organisers.refetch(); }} retrying={ws.isFetching || organisers.isFetching} testId="org-organisers-error" />
          ) : !ws.data || !organisers.data ? <SkeletonRows count={3} label="Loading the organisers" testId="org-organisers-loading" />
            : <OrganisersBody key={ws.data.series.version} ws={ws.data} rows={organisers.data} />}
      </div>
    </OrganiserShell>
  );
}
