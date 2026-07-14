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

import { wallClockToInstant, type WallClock } from '@/lib/time/wallClock';

export type CalendarEventInput = {
  eventId: string;
  title: string;
  startIso: WallClock | null;
  endIso: WallClock | null;
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

// Convert a stored wall clock into a true UTC instant (via the event timezone),
// then format as compact UTC. Delegates to the sanctioned wallClockToInstant --
// byte-identical to the previous inline offset-probe (parity-checked in
// tests/wallClockFormat.test.ts). ICS `Z`-suffixed DTSTART/DTEND are read as
// real instants by calendar clients, so this conversion is mandatory.
const compactFromWallClock = (wc: WallClock | null, timezone: string | null): string | null => {
  if (!wc) return null;
  const d = wallClockToInstant(wc, timezone || 'Europe/London');
  return d ? compact(d) : null;
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
  const dtStart = compactFromWallClock(input.startIso, input.timezone);
  const dtEnd = compactFromWallClock(input.endIso ?? input.startIso, input.timezone);
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
  const dtStart = compactFromWallClock(input.startIso, input.timezone);
  const dtEnd = compactFromWallClock(input.endIso ?? input.startIso, input.timezone);
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
