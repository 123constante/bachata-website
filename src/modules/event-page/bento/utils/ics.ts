// Client-side .ics generator + Google Calendar URL builder.
//
// Times are converted to UTC and formatted as YYYYMMDDTHHMMSSZ — the most
// portable form across calendar clients. Event timezone is carried in the
// description, not the timestamps, because RFC 5545 VTIMEZONE blocks are a
// rabbit hole we don't need for a single-event invite.

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

const toCompactUtc = (iso: string | null): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  // YYYYMMDDTHHMMSSZ
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
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
  const dtStart = toCompactUtc(input.startIso);
  const dtEnd = toCompactUtc(input.endIso ?? input.startIso);
  const dtStamp = toCompactUtc(new Date().toISOString()) ?? '';
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
  const dtStart = toCompactUtc(input.startIso);
  const dtEnd = toCompactUtc(input.endIso ?? input.startIso);
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
