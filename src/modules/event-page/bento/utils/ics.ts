// Client-side .ics generator + Google Calendar URL builder.
//
// Event/occurrence times are stored "local-as-UTC": a naive wall clock tagged
// with a +00 offset ("...T13:00:00+00:00" means 1 PM LOCAL, not a real 13:00
// UTC instant -- see occurrenceFormat.ts). To emit a correct invite we convert
// that wall clock through the event's IANA timezone into a TRUE UTC instant,
// then format as YYYYMMDDTHHMMSSZ. Passing the stored value straight to
// Date.toISOString() (the previous behaviour) created invites an hour late in
// BST. Event timezone is also carried in the description; VTIMEZONE blocks are
// a rabbit hole we don't need for a single-event invite.

export type CalendarEventInput = {
  eventId: string;
  title: string;
  startIso: string | null;
  endIso: string | null;
  timezone: string | null;
  description: string | null;
  locationName: string | null;
  locationAddress: string | null;
  pageUrl: string;
};

const compact = (d: Date): string =>
  d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

// Format a genuine UTC instant (e.g. DTSTAMP "now") as compact UTC.
const instantToCompactUtc = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : compact(d);
};

// Convert a stored local-as-UTC wall clock into a true UTC instant using the
// event timezone, then format as compact UTC. Offset-probe technique mirrors
// admin's lib/datetimeInputHelpers.fromDatetimeLocal.
const naiveLocalToCompactUtc = (iso: string | null, timezone: string | null): string | null => {
  if (!iso) return null;
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/);
  if (!m) return null;
  const [, y, mo, d, h, mi, s] = m;
  const tz = timezone || 'Europe/London';
  const guess = new Date(`${y}-${mo}-${d}T${h}:${mi}:${s ?? '00'}Z`);
  if (Number.isNaN(guess.getTime())) return null;
  const fmt = new Intl.DateTimeFormat('en-US', {
    timeZone: tz,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
  const parts = fmt.formatToParts(guess);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '00';
  const hour = get('hour') === '24' ? '00' : get('hour');
  const observed = new Date(
    `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}:${get('second')}Z`,
  );
  if (Number.isNaN(observed.getTime())) return null;
  const delta = observed.getTime() - guess.getTime();
  return compact(new Date(guess.getTime() - delta));
};

const escapeIcsText = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');

const foldIcsLine = (line: string): string => {
  // RFC 5545: lines longer than 75 octets should be folded with CRLF + space.
  // Node/browser string length ≈ octets for ASCII; good enough for our content.
  if (line.length <= 75) return line;
  const chunks: string[] = [];
  let i = 0;
  while (i < line.length) {
    chunks.push(line.slice(i, i + 75));
    i += 75;
  }
  return chunks.join('\r\n ');
};

const buildLocation = (input: CalendarEventInput): string | null => {
  const parts = [input.locationName, input.locationAddress].filter(Boolean) as string[];
  return parts.length ? parts.join(', ') : null;
};

export const buildIcs = (input: CalendarEventInput): string => {
  const dtStart = naiveLocalToCompactUtc(input.startIso, input.timezone);
  const dtEnd = naiveLocalToCompactUtc(input.endIso ?? input.startIso, input.timezone);
  const dtStamp = instantToCompactUtc(new Date().toISOString()) ?? '';
  const uid = `${input.eventId}@bachatacalendar.co.uk`;
  const location = buildLocation(input);

  const descriptionParts: string[] = [];
  if (input.description) descriptionParts.push(input.description);
  if (input.timezone) descriptionParts.push(`Local timezone: ${input.timezone}`);
  descriptionParts.push(`Page: ${input.pageUrl}`);
  const description = descriptionParts.join('\n\n');

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bachata Calendar//Event Page//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    dtStart ? `DTSTART:${dtStart}` : null,
    dtEnd ? `DTEND:${dtEnd}` : null,
    `SUMMARY:${escapeIcsText(input.title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    location ? `LOCATION:${escapeIcsText(location)}` : null,
    `URL:${input.pageUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter((x): x is string => typeof x === 'string');

  return lines.map(foldIcsLine).join('\r\n');
};

export const downloadIcs = (input: CalendarEventInput, filename = 'event.ics') => {
  const ics = buildIcs(input);
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  // Revoke a tick later so iOS Safari has time to start the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export const buildGoogleCalendarUrl = (input: CalendarEventInput): string => {
  const dtStart = naiveLocalToCompactUtc(input.startIso, input.timezone);
  const dtEnd = naiveLocalToCompactUtc(input.endIso ?? input.startIso, input.timezone);
  const location = buildLocation(input) ?? '';
  const descParts: string[] = [];
  if (input.description) descParts.push(input.description);
  descParts.push(input.pageUrl);
  if (input.timezone) descParts.push(`Local timezone: ${input.timezone}`);
  const details = descParts.join('\n\n');

  const params = new URLSearchParams({
    action: 'TEMPLATE',
    text: input.title,
    details,
    location,
  });
  if (dtStart && dtEnd) {
    params.set('dates', `${dtStart}/${dtEnd}`);
  }
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
};
