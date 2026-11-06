import { TEAM_FULL_REASON } from '@/modules/organiser/shared/teamModel';
import { GhostButton, PrimaryButton, SheetView, useOpenerRef } from '../ui';

export const addConfirmTitle = (name: string, pageName: string | null | undefined) =>
  `Add ${name.trim() || 'this person'} as Manager of ${pageName?.trim() || 'this page'}?`;

/**
 * The question before "Add someone" makes a person a Manager. Add runs the caller's mutation unchanged;
 * Cancel, Escape and a backdrop tap close it and write nothing. Not closable while the add is running.
 */
export function AddConfirm({ person, pageName, pending, full, onAdd, onCancel }: {
  person: { profileId: string; name: string } | null;
  pageName: string | null | undefined;
  pending: boolean;
  full: boolean;
  onAdd: () => void;
  onCancel: () => void;
}) {
  const open = person !== null;
  const opener = useOpenerRef(open);
  const title = addConfirmTitle(person?.name ?? '', pageName);
  return (
    <SheetView open={open} returnFocusRef={opener} onOpenChange={(o) => { if (!o && !pending) onCancel(); }} title="Add as Manager" testId="add-confirm">
      <div className="space-y-[12px] p-[4px]">
        <p className="break-words text-[15px] text-[var(--fg)]" data-testid="add-confirm-question">{title}</p>
        {full && <p className="text-[14px] text-[var(--mut)]" data-testid="add-confirm-full">{TEAM_FULL_REASON}</p>}
        <PrimaryButton size="sm" onClick={onAdd} disabled={full} loading={pending} loadingLabel="Adding" testId="add-confirm-yes">Add</PrimaryButton>
        <GhostButton size="sm" onClick={onCancel} disabled={pending} testId="add-confirm-no">Cancel</GhostButton>
      </div>
    </SheetView>
  );
}
