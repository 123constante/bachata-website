import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { GuestListSection } from '@/modules/event-page/sections/GuestListSection';

type JoinGuestListDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  eventId: string | null;
};

// Thin wrapper that hosts the existing, fully-featured GuestListSection form
// inside a Dialog. Nothing about the form itself is reimplemented — duplicate
// submission, cutoff, pricing, glow animations all come along for free.
export const JoinGuestListDialog = ({ open, onOpenChange, eventId }: JoinGuestListDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="mx-auto max-w-[430px] p-0">
        <DialogHeader className="px-4 pt-4">
          <DialogTitle>Join the guest list</DialogTitle>
        </DialogHeader>
        <div className="px-4 pb-4">
          <GuestListSection eventId={eventId} />
        </div>
      </DialogContent>
    </Dialog>
  );
};
