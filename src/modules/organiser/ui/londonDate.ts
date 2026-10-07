const LONDON = 'Europe/London';

function toDate(input: string | Date): Date {
  if (input instanceof Date) return input;
  // A bare YYYY-MM-DD is a London calendar date: read it at UTC noon so no
  // timezone can roll it into the neighbouring day.
  if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return new Date(`${input}T12:00:00Z`);
  return new Date(input);
}

/** Day number, short month and full label for a date, always in London time. */
export function londonDateParts(input: string | Date): { day: string; month: string; label: string } {
  const d = toDate(input);
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, day: 'numeric' }).format(d);
  const month = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, month: 'short' }).format(d);
  const label = new Intl.DateTimeFormat('en-GB', { timeZone: LONDON, weekday: 'short', day: 'numeric', month: 'long' }).format(d);
  return { day, month, label };
}
