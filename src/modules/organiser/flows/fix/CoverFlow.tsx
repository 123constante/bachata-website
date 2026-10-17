import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ORGANISER_HOME_KEY, fetchSeriesWorkspace, runSeriesCommand, seriesWorkspaceQueryKey } from '@/modules/organiser/shared/selfServeApi';
import { envelope, newIdempotencyKey } from '@/modules/organiser/shared/seriesCommands';
import { commandErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { uploadEventPicture } from '../../events/media';
import { OrganiserShell } from '../../shell';
import { ORG_PATHS } from '../../shell/paths';
import { ErrorState, SkeletonRows } from '../../ui';
import { goDone } from '../doneState';
import { EventConflict } from '../event/parts';
import { COVER_TITLE, coverDone, coverFixCommands } from './coverModel';

/**
 * /account/o/cover/:seriesId (C18 -> C18b): pick a photo (the existing event
 * upload), send ONE series.upsert {default_cover_image_url}, land on Done
 * "Cover added". The Home no_cover row, New event and Event details link here.
 */
export default function CoverFlow() {
  const { seriesId = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // One key per uploaded photo: the server replays a stored answer for (actor, key)
  // without comparing the payload, so a retry of the SAME photo is safe and a
  // different photo must not ride the first one's key.
  const key = useRef<{ url: string; key: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(false);
  const workspace = useQuery({ queryKey: seriesWorkspaceQueryKey(seriesId), queryFn: () => fetchSeriesWorkspace(seriesId), enabled: !!seriesId });
  const current = workspace.data?.series.default_cover_image_url ?? null;

  const choose = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    let url: string;
    try {
      url = await uploadEventPicture(seriesId, file);
    } catch (err) {
      // The upload already throws plain copy ("That photo is too big.").
      setError(err instanceof Error ? err.message : commandErrorMessage(err));
      setBusy(false);
      return;
    }
    try {
      const [command] = coverFixCommands(url);
      if (key.current?.url !== url) key.current = { url, key: newIdempotencyKey() };
      const version = (await fetchSeriesWorkspace(seriesId)).series.version;
      await runSeriesCommand(envelope(seriesId, version, command, key.current.key));
      void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      goDone(navigate, coverDone(seriesId));
    } catch (err) {
      // R3-7: someone changed the event first; else never the raw message ("Failed to fetch").
      if (/version_conflict/i.test(String((err as { message?: unknown } | null)?.message ?? ''))) setConflict(true);
      else setError(commandErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OrganiserShell title={COVER_TITLE} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-page-cover">
      {conflict ? (
        <div className="p-3"><EventConflict seriesId={seriesId} /></div>
      ) : workspace.isPending ? (
        <SkeletonRows count={2} label="Loading" testId="cover-loading" />
      ) : workspace.isError ? (
        <ErrorState title="This event did not load" onRetry={() => void workspace.refetch()} retrying={workspace.isFetching} testId="cover-load-error" />
      ) : (
        <div className="flex flex-col gap-3 p-3">
          {current && <img src={current} alt="Current cover" loading="eager" className="max-h-[240px] w-full rounded-[12px] object-cover" data-testid="cover-current" />}
          <label className="flex min-h-[56px] w-full cursor-pointer items-center justify-center rounded-[12px] bg-[var(--card2)] px-[16px] text-[16px] font-semibold text-[var(--fg)]" data-testid="cover-label">
            {busy ? 'Uploading' : current ? 'Choose a different photo' : 'Choose a photo'}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} data-testid="cover-input" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; void choose(f); }} />
          </label>
          {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="cover-error">{error}</p>}
        </div>
      )}
    </OrganiserShell>
  );
}
