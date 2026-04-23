import { CalendarDays, Apple, Mail } from 'lucide-react';
import {
  Drawer,
  DrawerClose,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import {
  buildGoogleCalendarUrl,
  downloadIcs,
  type CalendarEventInput,
} from '@/modules/event-page/bento/utils/ics';

type AddToCalendarChooserProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  event: CalendarEventInput | null;
};

type Option = {
  key: 'google' | 'apple' | 'outlook';
  label: string;
  hint: string;
  Icon: typeof CalendarDays;
  onPick: (e: CalendarEventInput) => void;
};

// Apple Calendar and Outlook both just consume .ics — the only real difference
// is filename (some clients key intent off it).
const OPTIONS: Option[] = [
  {
    key: 'google',
    label: 'Google Calendar',
    hint: 'Opens in a new tab',
    Icon: CalendarDays,
    onPick: (e) => window.open(buildGoogleCalendarUrl(e), '_blank', 'noopener,noreferrer'),
  },
  {
    key: 'apple',
    label: 'Apple Calendar',
    hint: 'Downloads .ics',
    Icon: Apple,
    onPick: (e) => downloadIcs(e, 'event-apple.ics'),
  },
  {
    key: 'outlook',
    label: 'Outlook',
    hint: 'Downloads .ics',
    Icon: Mail,
    onPick: (e) => downloadIcs(e, 'event-outlook.ics'),
  },
];

export const AddToCalendarChooser = ({ open, onOpenChange, event }: AddToCalendarChooserProps) => {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="mx-auto w-full max-w-[430px]">
        <DrawerHeader>
          <DrawerTitle>Add to calendar</DrawerTitle>
        </DrawerHeader>
        <div className="flex flex-col gap-2 px-4 pb-6">
          {OPTIONS.map(({ key, label, hint, Icon, onPick }) => (
            <DrawerClose asChild key={key}>
              <button
                type="button"
                disabled={!event}
                onClick={() => {
                  if (!event) return;
                  onPick(event);
                }}
                className="flex items-center gap-3 rounded-lg border border-border bg-background px-3 py-3 text-left transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                <Icon className="h-5 w-5 text-foreground" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-semibold text-foreground">{label}</div>
                  <div className="text-xs text-muted-foreground">{hint}</div>
                </div>
              </button>
            </DrawerClose>
          ))}
        </div>
      </DrawerContent>
    </Drawer>
  );
};
