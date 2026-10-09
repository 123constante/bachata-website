import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";

import { cn } from "@/lib/utils";

// `label` is required: a progressbar with no accessible name is an axe
// serious finding (aria-progressbar-name), so every caller must say what is
// progressing. `value` is forwarded so the bar also exposes aria-valuenow.
const Progress = React.forwardRef<
  React.ElementRef<typeof ProgressPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ProgressPrimitive.Root> & { label: string }
>(({ className, value, label, ...props }, ref) => (
  <ProgressPrimitive.Root
    ref={ref}
    value={value}
    aria-label={label}
    className={cn("relative h-4 w-full overflow-hidden rounded-full bg-secondary", className)}
    {...props}
  >
    <ProgressPrimitive.Indicator
      className="h-full w-full flex-1 bg-primary transition-all"
      style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
    />
  </ProgressPrimitive.Root>
));
Progress.displayName = ProgressPrimitive.Root.displayName;

export { Progress };
