import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { canConfirm, type ConfirmCopy } from '../editorGuards';

/**
 * The second, explicit step before something is hidden or removed: what will
 * happen in plain words, how to undo it, and a red button that stays off until
 * the organiser ticks "I understand" (for the actions that ask for it).
 */
export function ConfirmPanel({ copy, busy, onConfirm, onKeep, testId = 'confirm-panel' }: {
  copy: ConfirmCopy;
  busy: boolean;
  onConfirm: () => void;
  onKeep: () => void;
  testId?: string;
}) {
  const [acknowledged, setAcknowledged] = useState(false);
  return (
    <div className="space-y-3" role="alertdialog" aria-label={copy.title} data-testid={testId}>
      <div className="rounded-md border border-destructive/40 bg-destructive/5 p-3 space-y-1">
        <p className="text-sm font-semibold">{copy.title}</p>
        <p className="text-sm" data-testid="confirm-consequence">{copy.consequence}</p>
        <p className="text-xs text-muted-foreground" data-testid="confirm-undo">{copy.undo}</p>
      </div>
      {copy.requireAck && (
        <label className="flex items-start gap-2 min-h-[44px] text-sm">
          <input
            type="checkbox"
            className="mt-1 h-5 w-5 shrink-0"
            checked={acknowledged}
            onChange={(e) => setAcknowledged(e.target.checked)}
            data-testid="confirm-ack"
          />
          <span>{copy.ackLabel}</span>
        </label>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" size="sm" variant="outline" className="min-h-[44px]" onClick={onKeep} disabled={busy} data-testid="confirm-keep">
          {copy.keepLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="destructive"
          className="min-h-[44px]"
          disabled={!canConfirm(copy, acknowledged, busy)}
          onClick={onConfirm}
          data-testid="confirm-go"
        >
          {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />} {copy.confirmLabel}
        </Button>
      </div>
    </div>
  );
}
