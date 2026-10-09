// ONE rule for how a cancelled date reads. A reason that says nothing ("Other",
// any case, or blank) is not shown: the date reads just "Cancelled". A real
// reason reads "Cancelled \u00b7 <reason>".

/** The reason worth showing, or null for "Other" / blank. */
export function shownCancelReason(reason: string | null | undefined): string | null {
  const r = reason?.trim() ?? '';
  return r && r.toLowerCase() !== 'other' ? r : null;
}

/** "Cancelled" or "Cancelled \u00b7 Illness". */
export function cancelledLabel(reason: string | null | undefined): string {
  const r = shownCancelReason(reason);
  return r ? `Cancelled \u00b7 ${r}` : 'Cancelled';
}
