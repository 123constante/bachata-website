import { GhostButton, PrimaryButton, SheetView } from '@/modules/organiser/ui';

/** "Discard changes?" (D119 #2): Keep editing is the one primary; Discard leaves. */
export function DiscardSheet({ open, onKeep, onDiscard }: { open: boolean; onKeep: () => void; onDiscard: () => void }) {
  return (
    <SheetView
      open={open}
      onOpenChange={(o) => { if (!o) onKeep(); }}
      title="Discard changes?"
      description="You have edits that are not saved."
      testId="discard-sheet"
      footer={
        <div className="space-y-[8px]">
          <PrimaryButton testId="discard-keep" onClick={onKeep}>Keep editing</PrimaryButton>
          <GhostButton testId="discard-leave" onClick={onDiscard}>Discard</GhostButton>
        </div>
      }
    >
      <p className="text-[15px] text-[var(--mut)]">What you changed is not saved yet. If you leave now, it is lost.</p>
    </SheetView>
  );
}
