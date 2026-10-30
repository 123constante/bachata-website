import { useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { keepReturnTo } from '@/modules/organiser/flows/doneState';
import { useQuery } from '@tanstack/react-query';
import { Plus } from 'lucide-react';
import { isAccessRefusal } from '@/modules/organiser/shared/selfServeErrors';
import { NoAccess } from '@/modules/organiser/shared/components/NoAccess';
import { EventConflict, StepError, useEventSend } from '@/modules/organiser/flows/event';
import { useOrgSurface } from '../shell/surface';
import { Card, ErrorState, GhostButton, PersonRow, PrimaryButton, SheetView, SkeletonRows, useOpenerRef } from '../ui';
import { useEventWorkspace } from './eventsApi';
import type { EventWorkspace } from './eventModel';
import { fetchOrganiserPages, useSeriesRole } from './programmeSeriesApi';
import { ADD_NONE_LEFT, ADD_ONLY_YOURS, addablePages, addOrganiser, type LinkedOrganiser, organisersEmpty, organisersCommand, organisersOff, removeOff, removeOrganiser } from './organisersModel';

/** AW1 B-2: only the viewer's own live pages are offered; the server refuses any other added page. */
function AddSheet({ open, onClose, offer, onPick }: { open: boolean; onClose: () => void; offer: LinkedOrganiser[]; onPick: (id: string) => void }) {
  const opener = useOpenerRef(open);
  return (
    <SheetView open={open} returnFocusRef={opener} onOpenChange={(next) => { if (!next) onClose(); }} title="Link an organiser page" fullHeight testId="org-add-sheet">
      <div className="space-y-[12px]" data-testid="org-add-view">
        {offer.length === 0 ? <p className="text-[14px] text-[var(--mut)]" data-testid="org-add-empty">{ADD_NONE_LEFT}</p> : (
          <>
            <p className="text-[13px] text-[var(--mut)]" data-testid="org-add-note">{ADD_ONLY_YOURS}</p>
            <Card testId="org-add-results">
              {offer.map((o) => (
                <PersonRow key={o.id} testId="org-add-result" name={o.name} onPress={() => { onPick(o.id); onClose(); }}
                  trailing={<Plus aria-hidden="true" className="h-[20px] w-[20px] shrink-0 text-[var(--gold)]" />} />
              ))}
            </Card>
          </>
        )}
      </div>
    </SheetView>
  );
}

function OrganisersBody({ ws }: { ws: EventWorkspace }) {
  const seriesId = ws.series.id;
  const stored = ws.organiserIds;
  const [ids, setIds] = useState<string[]>(stored);
  const [adding, setAdding] = useState(false);
  const { sendThenDone, busy, conflict, error } = useEventSend(seriesId);
  const { role, myPages } = useSeriesRole(seriesId);
  const off = organisersOff({ lifecycle: ws.series.lifecycle_status, isOwner: role === 'owner' });
  const pages = useQuery({ queryKey: ['org-organiser-pages', ...ids], queryFn: () => fetchOrganiserPages(ids), enabled: ids.length > 0 });
  const command = organisersCommand(stored, ids);
  const lastOff = removeOff(ids);
  if (conflict) return <EventConflict seriesId={seriesId} />;
  const nameOf = (id: string) => pages.data?.find((p) => p.id === id)?.name ?? 'Organiser page';
  return (
    <>
      {off && <p id="org-off-reason" className="px-[4px] text-[14px] text-[var(--mut)]" data-testid="org-off-reason">{off}</p>}
      {ids.length === 0 ? (
        <p className="px-[4px] text-[14px] text-[var(--mut)]" data-testid="org-empty">{organisersEmpty(off)}</p>
      ) : pages.isLoading ? <SkeletonRows count={ids.length} label="Loading the organisers" /> : (
        <Card testId="org-linked">
          {ids.map((id) => (
            <div key={id} className="flex items-center gap-[8px] pr-[8px]" data-testid="org-linked-row">
              <div className="min-w-0 flex-1"><PersonRow name={nameOf(id)} /></div>
              <button type="button" disabled={!!off || !!lastOff} aria-describedby={off ? 'org-off-reason' : lastOff ? 'org-last-reason' : undefined}
                onClick={() => setIds((l) => removeOrganiser(l, id))} data-testid="org-remove"
                className="inline-flex h-[44px] shrink-0 items-center rounded-[12px] px-[12px] text-[14px] font-semibold text-[var(--danger)] disabled:cursor-not-allowed disabled:opacity-40">
                Remove
              </button>
            </div>
          ))}
        </Card>
      )}
      {!off && lastOff && ids.length > 0 && <p id="org-last-reason" className="px-[4px] text-[13px] text-[var(--mut)]" data-testid="org-last-reason">{lastOff}</p>}
      <GhostButton size="sm" block={false} disabled={!!off} aria-describedby={off ? 'org-off-reason' : undefined} onClick={() => setAdding(true)} testId="org-add">
        <Plus aria-hidden="true" className="h-[16px] w-[16px]" /> Link a page
      </GhostButton>
      <PrimaryButton testId="org-save" loading={busy} aria-disabled={off || !command ? true : undefined}
        className={off || !command ? 'cursor-not-allowed opacity-60' : undefined}
        onClick={() => { if (!off && command) void sendThenDone(ws.series.version, command, { title: 'Saved', message: 'Saved' }); }}>
        Save
      </PrimaryButton>
      {(off || !command) && <p className="text-[13px] text-[var(--mut)]" data-testid="org-save-reason">{off ?? 'Nothing changed yet'}</p>}
      <StepError text={error} />
      <AddSheet open={adding && !off} onClose={() => setAdding(false)} offer={addablePages(myPages, ids)} onPick={(id) => setIds((l) => addOrganiser(l, id))} />
    </>
  );
}

/**
 * /account/o/events/:seriesId/organisers (SW1): the organiser pages linked to the event.
 * Owner only (a manager reads the list, with the reason); the last organiser cannot be
 * removed; ONE series.set_organisers with the complete list, behind the platform gate.
 */
export default function SeriesOrganisers() {
  const { seriesId = '' } = useParams();
  const { search } = useLocation();
  const ws = useEventWorkspace(seriesId);
  const { kind, Shell, paths } = useOrgSurface();
  // P3 opens it from the event page (R1 from Name and details)
  const back = kind === 'p3' ? paths.event(seriesId) : paths.eventDetails(seriesId);
  return (
    <Shell title="Organisers" back={{ to: keepReturnTo(back, search), label: 'Back' }} testId="org-page-organisers">
      <div className="flex flex-col gap-3 p-3">
        {ws.isError && isAccessRefusal(ws.error) ? <NoAccess />
          : ws.isError ? <ErrorState onRetry={() => void ws.refetch()} retrying={ws.isFetching} testId="org-organisers-error" />
          : !ws.data ? <SkeletonRows count={3} label="Loading the organisers" testId="org-organisers-loading" />
            : <OrganisersBody key={ws.data.series.version} ws={ws.data} />}
      </div>
    </Shell>
  );
}
