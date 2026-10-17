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
  const key = useRef<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const workspace = useQuery({ queryKey: seriesWorkspaceQueryKey(seriesId), queryFn: () => fetchSeriesWorkspace(seriesId), enabled: !!seriesId });
  const current = workspace.data?.series.default_cover_image_url ?? null;

  const choose = async (file: File | undefined) => {
    if (!file || busy) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadEventPicture(seriesId, file);
      const [command] = coverFixCommands(url);
      key.current ??= newIdempotencyKey();
      const version = (await fetchSeriesWorkspace(seriesId)).series.version;
      await runSeriesCommand(envelope(seriesId, version, command, key.current));
      void queryClient.invalidateQueries({ queryKey: seriesWorkspaceQueryKey(seriesId) });
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      goDone(navigate, coverDone(seriesId));
    } catch (err) {
      setError(err instanceof Error && !/version_conflict|rpc|permission/i.test(err.message) ? err.message : commandErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <OrganiserShell title={COVER_TITLE} back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-page-cover">
      {workspace.isPending ? (
        <SkeletonRows count={2} label="Loading" testId="cover-loading" />
      ) : workspace.isError ? (
        <ErrorState title="This event did not load" onRetry={() => void workspace.refetch()} retrying={workspace.isFetching} testId="cover-load-error" />
      ) : (
        <div className="flex flex-col gap-3 p-3">
          {current && <img src={current} alt="Current cover" loading="eager" className="max-h-[240px] w-full rounded-[12px] object-cover" data-testid="cover-current" />}
          <label className="flex min-h-[56px] w-full cursor-pointer items-center justify-center rounded-[12px] bg-[var(--card2)] px-[16px] text-[16px] font-semibold text-[var(--fg)]" data-testid="cover-label">
            {busy ? 'Uploading' : current ? 'Choose a different photo' : 'Choose a photo'}
            <input type="file" accept="image/*" className="sr-only" disabled={busy} data-testid="cover-input" onChange={(e) => void choose(e.target.files?.[0])} />
          </label>
          {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="cover-error">{error}</p>}
        </div>
      )}
    </OrganiserShell>
  );
}
