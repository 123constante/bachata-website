import { Drawer as DrawerPrimitive } from 'vaul';
import { X } from 'lucide-react';

import { DrawerOverlay, DrawerPortal } from '@/components/ui/drawer';

type DescriptionModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  body: string;
};

// Bottom-sheet description reveal. Brass-tinted drag handle + brass-
// outlined circular X close, no title. Snaps to 80vh; drag-down or X
// dismisses. Replaces the prior full-screen Dialog.
export const DescriptionModal = ({ open, onOpenChange, body }: DescriptionModalProps) => {
  return (
    <DrawerPrimitive.Root open={open} onOpenChange={onOpenChange} shouldScaleBackground>
      <DrawerPortal>
        <DrawerOverlay className="z-[70]" />
        <DrawerPrimitive.Content
          className="fixed inset-x-0 bottom-0 z-[70] flex h-[80vh] flex-col rounded-t-2xl outline-none"
          style={{ background: 'hsl(var(--bento-surface-raised))' }}
        >
          <div
            className="mx-auto mt-2.5 h-[5px] w-12 rounded-full"
            style={{ background: 'hsl(var(--bento-accent) / 0.55)' }}
          />
          <div className="flex items-center justify-end px-4 pb-1 pt-2">
            <DrawerPrimitive.Close
              aria-label="Close description"
              className="flex h-8 w-8 items-center justify-center rounded-full border transition-colors"
              style={{
                borderColor: 'hsl(var(--bento-accent) / 0.45)',
                background: 'hsl(var(--bento-accent) / 0.12)',
                color: 'hsl(var(--bento-accent))',
              }}
            >
              <X className="h-4 w-4" />
            </DrawerPrimitive.Close>
          </div>
          <div className="flex-1 overflow-y-auto px-5 pb-8">
            <p
              className="whitespace-pre-wrap text-[14px] leading-[1.6]"
              style={{
                fontFamily: '"Fraunces", Georgia, serif',
                fontWeight: 500,
                color: 'hsl(var(--bento-fg))',
              }}
            >
              {body}
            </p>
          </div>
        </DrawerPrimitive.Content>
      </DrawerPortal>
    </DrawerPrimitive.Root>
  );
};
