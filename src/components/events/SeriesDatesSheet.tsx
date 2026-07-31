import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import EventRow, { type EventRowProps } from '@/components/events/EventRow';

export interface SeriesDatesSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  seriesName: string;
  /**
   * Pre-built row props for every upcoming date in the series -- computed by
   * the caller (same helpers it uses for the main list's single rows) rather
   * than raw occurrence rows, so this sheet stays as time-library-agnostic as
   * EventRow itself.
   */
  dates: EventRowProps[];
}

export default function SeriesDatesSheet({
  open,
  onOpenChange,
  seriesName,
  dates,
}: SeriesDatesSheetProps) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-full max-w-[430px]">
        <DrawerHeader>
          <DrawerTitle>
            {seriesName} &mdash; {dates.length} {dates.length === 1 ? 'date' : 'dates'}
          </DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-2 overflow-y-auto px-4 pb-6" style={{ maxHeight: '60vh' }}>
          {dates.map((d, i) => (
            // index-suffixed: `href` alone can repeat when occurrenceId is
            // null for more than one date of the same series (falls back to
            // the bare event href in buildEventRowProps), which would
            // otherwise collide as duplicate React keys.
            <EventRow key={`${d.href}-${i}`} {...d} fallbackIndex={i} />
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
