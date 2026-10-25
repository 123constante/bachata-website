import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Copy } from 'lucide-react';
import { eventWorkspaceQueryKey, fetchEventWorkspace } from '@/modules/organiser/shared/runCommands';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import { GhostButton } from '@/modules/organiser/ui';
import { COPY_TEXT, copyEvent, copyView, sourceFromWorkspace, type CopyState } from './copyModel';

/**
 * "Copy as a new event": reads the event, then opens the NORMAL New event flow with the
 * copy as pre-fill. Nothing is saved here. A second tap while the first is opening does nothing.
 */
export function CopyButton({ seriesId, testId = 'org-copy', size = 'md' }: { seriesId: string; testId?: string; size?: 'md' | 'sm' }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const tapped = useRef(false);
  const [opening, setOpening] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [off, setOff] = useState<{ label: string; reason: string } | null>(null);
  const view = copyView({ found: true, role: 'organiser', source: null, opening });
  const label = off?.label ?? 'Copy as a new event';

  const open = async () => {
    if (tapped.current) return;
    tapped.current = true;
    setOpening(true);
    setError(null);
    try {
      const ws = await queryClient.fetchQuery({ queryKey: eventWorkspaceQueryKey(seriesId), queryFn: () => fetchEventWorkspace(seriesId) });
      const src = sourceFromWorkspace(ws.series, ws.dates.map((d) => d.occurrence_date));
      const v = copyView({ found: !!ws.series.id, role: 'organiser', source: ws.series.id ? src : null });
      if (!v.enabled) {
        setOff({ label: v.label, reason: v.reason ?? COPY_TEXT.nothingCopyable });
        tapped.current = false;
        setOpening(false);
        return;
      }
      const state: CopyState = { copy: copyEvent(src) };
      navigate(ORG_PATHS.newName(ws.series.format === 'one_off' ? 'one_off' : 'recurring'), { state });
    } catch {
      setError(COPY_TEXT.network);
      tapped.current = false;
      setOpening(false);
    }
  };

  const reason = off?.reason ?? (opening ? view.reason : null);
  return (
    <div className="flex flex-col gap-[6px]">
      <GhostButton size={size} onClick={() => void open()} disabled={!!off || opening} testId={testId}>
        <Copy aria-hidden="true" className="h-[18px] w-[18px]" /> {label}
      </GhostButton>
      {reason && <p className="text-[14px] text-[var(--mut)]" data-testid={`${testId}-reason`}>{reason}</p>}
      {error && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid={`${testId}-error`}>{error}</p>}
    </div>
  );
}
