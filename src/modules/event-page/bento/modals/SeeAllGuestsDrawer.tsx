import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { BLOCK_COLORS } from '@/modules/event-page/bento/BentoGrid';
import type { GuestListEntry } from '@/modules/event-page/hooks/useEventGuestList';

type SeeAllGuestsDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entries: GuestListEntry[];
};

const initialFrom = (name: string): string => {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : '?';
};

export const SeeAllGuestsDrawer = ({ open, onOpenChange, entries }: SeeAllGuestsDrawerProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-full max-w-[430px]">
        <DrawerHeader>
          <DrawerTitle>
            Guest list <span className="text-muted-foreground">({entries.length})</span>
          </DrawerTitle>
        </DrawerHeader>
        <div className="max-h-[60vh] overflow-y-auto px-4 pb-6">
          {entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No names on the guest list yet.
            </p>
          ) : (
            <ul className="flex flex-col gap-[6px]">
              {entries.map((entry, i) => (
                <li
                  key={`${entry.first_name}-${entry.created_at}-${i}`}
                  className="flex items-center gap-3 rounded-lg border border-border/60 bg-background px-3 py-2"
                >
                  <div
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white"
                    style={{ background: BLOCK_COLORS.guest }}
                  >
                    {initialFrom(entry.first_name)}
                  </div>
                  <span className="truncate text-sm text-foreground">{entry.first_name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
