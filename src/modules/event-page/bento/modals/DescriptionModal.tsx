import { Drawer as DrawerPrimitive } from 'vaul';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { DrawerOverlay, DrawerPortal } from '@/components/ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';

type DescriptionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  body: string;
};

const SURFACE = 'hsl(var(--bento-surface-raised))';

// Brass-outlined circular close, shared by the sheet and the dialog.
const CLOSE_CLASS =
  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border outline-none transition-colors';
const CLOSE_STYLE = {
  borderColor: 'hsl(var(--bento-accent) / 0.45)',
  background: 'hsl(var(--bento-accent) / 0.12)',
  color: 'hsl(var(--bento-accent))',
} as const;

// Scrollable description body. White text on the raised bento surface.
// No flex-1: the body sizes to its content so the container can hug it,
// and min-h-0 + overflow-y-auto lets it scroll once the height cap is hit.
// Desktop uses larger type and roomier padding for presence on wide screens.
const DescriptionBody = ({ body, desktop = false }: { body: string; desktop?: boolean }) => (
  <div className={cn('min-h-0 overflow-y-auto', desktop ? 'px-8 pb-8' : 'px-5 pb-8')}>
    <p
      className={cn(
        'whitespace-pre-wrap text-white',
        desktop ? 'text-[16px] leading-[1.7]' : 'text-[14px] leading-[1.62]',
      )}
      style={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 500 }}
    >
      {body}
    </p>
  </div>
);

// Description reveal. Mobile: brass-handled bottom sheet that hugs its
// content (caps at 85vh, then scrolls) -- no empty void. Desktop (>=768px):
// a centred dialog with an "About this event" heading, larger 16px type and
// roomy padding for presence on wide screens (cap 82vh). White body text.
export const DescriptionModal = ({ open, onOpenChange, body }: DescriptionModalProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
        <DrawerPortal>
          <DrawerOverlay className="z-[70]" />
          <DrawerPrimitive.Content
            className="fixed inset-x-0 bottom-0 z-[70] flex max-h-[85vh] flex-col rounded-t-2xl outline-none"
            style={{ background: SURFACE }}
          >
            <div
              className="mx-auto mt-2.5 h-[5px] w-12 shrink-0 rounded-full"
              style={{ background: 'hsl(var(--bento-accent) / 0.55)' }}
            />
            <div className="flex shrink-0 items-center justify-end px-4 pb-1 pt-2">
              <DrawerPrimitive.Close aria-label="Close description" className={CLOSE_CLASS} style={CLOSE_STYLE}>
                <X className="h-4 w-4" />
              </DrawerPrimitive.Close>
            </div>
            <DescriptionBody body={body} />
          </DrawerPrimitive.Content>
        </DrawerPortal>
      </DrawerPrimitive.Root>
    );
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[70] bg-black/70 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-1/2 z-[70] flex max-h-[82vh] w-[92vw] max-w-3xl -translate-x-1/2 -translate-y-1/2 flex-col rounded-2xl shadow-2xl outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          style={{ background: SURFACE }}
        >
          <div className="flex shrink-0 items-center justify-between gap-4 px-8 pb-3 pt-6">
            <DialogPrimitive.Title
              className="text-[16px]"
              style={{ fontFamily: '"Fraunces", Georgia, serif', fontWeight: 600, color: 'hsl(var(--bento-fg))' }}
            >
              About this event
            </DialogPrimitive.Title>
            <DialogPrimitive.Close aria-label="Close description" className={CLOSE_CLASS} style={CLOSE_STYLE}>
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          </div>
          <DescriptionBody body={body} desktop />
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};
