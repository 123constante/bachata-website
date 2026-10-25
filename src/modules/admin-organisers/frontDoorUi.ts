/** A greyed button has no fill, a dashed edge and muted words, so it never looks like the live one beside it (#1033 critique C1). */
const OFF = 'disabled:cursor-not-allowed disabled:border disabled:border-dashed disabled:border-border disabled:bg-transparent disabled:text-muted-foreground';
const FOCUS = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';
export const BTN = `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium ${OFF} ${FOCUS}`;
export const BTN_PRIMARY = `inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground ${OFF} ${FOCUS}`;
export const FIELD = 'w-full min-h-[44px] rounded border border-border bg-background px-2 py-2 text-sm';
/** The words beside a switch: muted when the switch is locked, so only live switches read live. */
export const switchLabel = (locked: boolean) => `flex min-h-[44px] items-center gap-2 text-sm${locked ? ' text-muted-foreground' : ''}`;
/** The count badge on the Needs you tab and the entry button: white on red-700 (6.5:1; the destructive token is 3.8:1 at 10px). */
export const BADGE = 'ml-1 rounded-full bg-red-700 px-1.5 py-0.5 text-xs font-semibold text-white';
export const organiserHref = (id: string) => `/organisers/${id}`;
