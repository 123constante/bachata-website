import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

type DescriptionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  body: string;
};

export const DescriptionModal = ({ open, onOpenChange, body }: DescriptionModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        overlayClassName="z-[70]"
        className="z-[70] flex max-w-none w-screen h-screen flex-col gap-0 rounded-none p-0 sm:h-auto sm:max-h-[80vh] sm:max-w-2xl sm:rounded-xl"
      >
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="text-base font-semibold">About this event</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-y-auto px-5 py-5">
          <p
            className="whitespace-pre-wrap text-[14px] leading-[1.6]"
            style={{
              fontFamily: '"Fraunces", Georgia, serif',
              fontWeight: 500,
            }}
          >
            {body}
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};
