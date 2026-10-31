import { useCallback, useEffect, useState } from 'react';
import { useRunCommands } from '../../shared/runCommands';
import { commandErrorMessage } from '../../shared/selfServeErrors';
import type { OwnerCommand } from '../../shared/seriesCommands';
import { useGatedCopy } from '../onboarding/gate';
import type { Done } from './StatusSheet';

function Toast({ done, onUndo, onClose }: { done: Done; onUndo: () => void; onClose: () => void }) {
  useEffect(() => {
    const t = window.setTimeout(onClose, 8000);
    return () => window.clearTimeout(t);
  }, [done, onClose]);
  return (
    <div className="p3-toast" role="status" data-testid="p3-toast">
      <span className="p3-grow">{done.text}</span>
      {done.undo && <button type="button" className="p3-link p3-toast-act" onClick={onUndo} data-testid="p3-undo">{done.undoLabel ?? 'Undo'}</button>}
    </div>
  );
}

/**
 * The page's toast and its Undo (moved out of EventPage for All dates, W2b). Undo sends the
 * one command through useRunCommands, so a date undo (a DateStep) goes against its date.
 */
export function useToast(seriesId: string, seriesVersion: number) {
  const run = useRunCommands(seriesId);
  const gated = useGatedCopy();
  const [toast, setToast] = useState<Done | null>(null);
  const close = useCallback(() => setToast(null), []);
  const undo = async (cmd: OwnerCommand, version: number | null | undefined) => {
    setToast(null);
    try {
      await run([cmd], version ?? seriesVersion);
      setToast({ text: 'Undone.', undo: null });
    } catch (e) {
      // an onboarding refusal opens the A1 gate sheet; the toast just goes (P3-GATE)
      const text = gated(e, commandErrorMessage);
      setToast(text ? { text, undo: null } : null);
    }
  };
  const node = toast ? <Toast done={toast} onClose={close} onUndo={() => toast.undo && void undo(toast.undo, toast.version)} /> : null;
  return { run, show: setToast, node };
}
