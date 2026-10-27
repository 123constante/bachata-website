import { resolveCanonicalCity } from '@/lib/city-canonical';
import { withNormalizedProtocol } from '@/lib/organiserProfileUpdate';
import type { VenueOption } from '../../shared/publicVenues';
import { venueOverridePatch } from '../../dates/venueOverride';
import { linkProblem, publicUrlOk } from '../../shared/linkRules';
import { groupChatCommand, upsertCommand, type OwnerCommand } from '../../shared/seriesCommands';
import { MAX_DESCRIPTION } from '../../events/EditorSheet';
import { MUSIC_STYLES, MAX_VIDEOS, type EventWorkspace } from '../../events/eventModel';
import { L } from '../model/labels';
import { changedKeys, type FieldSpec } from '../model/saveModel';

/**
 * "Name and details" (P3 W3a, C3 `details`): what the old Details screen edits one row at a
 * time, on one screen with ONE save (p3/model/saveModel). Every rule is the old one: the link
 * rules (shared/linkRules), the music list and video cap (events/eventModel), the description
 * cap (events/EditorSheet), the venue's city (dates/venueOverride). Nothing here sends.
 */
export interface DetailsDraft {
  name: string;
  description: string;
  music: string[];
  venueId: string | null;
  ticket: string;
  cover: string;
  instagram: string;
  /** One video link per line. */
  videos: string;
  chat: string;
}

export type DetailsField = keyof DetailsDraft;

export const MAX_NAME = 120;
export { MAX_DESCRIPTION };


/** The group chat link (event_series_p5.group_chat_url, read by parseEventWorkspace). */
export const groupChatOf = (ws: EventWorkspace): string => ws.groupChatUrl ?? '';

export function detailsDraftOf(ws: EventWorkspace): DetailsDraft {
  const s = ws.series;
  return {
    name: s.name ?? '',
    description: s.default_description ?? '',
    music: [...ws.musicStyles],
    venueId: s.default_venue_id ?? null,
    ticket: s.default_ticket_url ?? '',
    cover: s.default_cover_image_url ?? '',
    instagram: s.instagram_url ?? '',
    videos: ws.videoUrls.join('\n'),
    chat: groupChatOf(ws),
  };
}

/** The video box as a list: blank lines dropped. */
export const videoList = (typed: string): string[] => typed.split('\n').map((v) => v.trim()).filter(Boolean);

/** Music in the order of the shared list, any stored style outside it kept after. */
export const toggleMusic = (picked: readonly string[], style: string): string[] =>
  picked.includes(style) ? picked.filter((m) => m !== style) : [...MUSIC_STYLES.filter((m) => m === style || picked.includes(m)), ...picked.filter((m) => !MUSIC_STYLES.includes(m))];

const sameList = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

export const DETAILS_SPECS: ReadonlyArray<FieldSpec<DetailsDraft>> = [
  { key: 'name', line: (d) => `${L.detailsName}: ${d.name.trim() || L.notSet}` },
  { key: 'description', line: () => L.detailsAbout },
  { key: 'music', line: (d) => `${L.music}: ${d.music.join(', ') || L.detailsNone}`, same: sameList },
  { key: 'venueId', line: () => L.detailsWhere },
  { key: 'ticket', line: () => L.ticket },
  { key: 'cover', line: () => L.detailsCover },
  { key: 'instagram', line: () => L.instagram },
  { key: 'videos', line: (d) => `${L.detailsVideos}: ${videoList(d.videos).length}`, same: (a, b) => sameList(videoList(String(a)), videoList(String(b))) },
  { key: 'chat', line: () => L.detailsChat },
];

/** The Instagram link as sent: a handle becomes its instagram.com address (the owner rule takes links only). */
export function instagramToSend(typed: string): string {
  const v = typed.trim();
  if (!v) return '';
  const sent = withNormalizedProtocol(v, 'instagram.com');
  return /^https?:\/\//i.test(sent) ? sent : `https://www.instagram.com/${sent.replace(/^@/, '')}`;
}

/** The chat link rule (the dispatcher's owner arm): blank, or a public https:// link. */
export const chatProblem = (typed: string): string | null => {
  const v = typed.trim();
  return !v || (publicUrlOk(v) && /^https:\/\//i.test(v)) ? null : L.detailsChatBad;
};

/**
 * What is wrong with each field, in plain words. Only a CHANGED field is held to its rule: a
 * stored link that breaks today's rule (2 live events on prod, 2026-10-27) shows its problem
 * but never blocks saving the other fields, because the save leaves it out.
 */
export function detailsProblems(base: DetailsDraft, draft: DetailsDraft): Partial<Record<DetailsField, string>> {
  const out: Partial<Record<DetailsField, string>> = {};
  const name = draft.name.trim();
  if (!name) out.name = L.detailsNameNeeded;
  else if (name.length > MAX_NAME) out.name = L.detailsTooLong(MAX_NAME);
  if (draft.description.trim().length > MAX_DESCRIPTION) out.description = L.detailsTooLong(MAX_DESCRIPTION);
  const ticket = linkProblem('ticket', draft.ticket);
  if (ticket) out.ticket = ticket;
  const ig = linkProblem('instagram', draft.instagram);
  if (ig) out.instagram = ig;
  const vids = videoList(draft.videos);
  const badVideo = vids.map((v) => linkProblem('video', v)).find(Boolean);
  if (badVideo) out.videos = badVideo;
  else if (vids.length > MAX_VIDEOS) out.videos = L.detailsTooManyVideos(MAX_VIDEOS);
  const chat = chatProblem(draft.chat);
  if (chat) out.chat = chat;
  if (!draft.venueId && base.venueId) out.venueId = L.detailsWhereNeeded;
  return out;
}

/** The first problem among the CHANGED fields (the one the Save button names); null when it can save. */
export function detailsBlocker(base: DetailsDraft, draft: DetailsDraft): string | null {
  const problems = detailsProblems(base, draft);
  const changed = changedKeys(DETAILS_SPECS, base, draft);
  // the name goes with every upsert, so a blank name blocks any save
  if (changed.length && problems.name) return problems.name;
  return changed.map((k) => problems[k]).find(Boolean) ?? null;
}

/**
 * The venue's city, resolved the way a date's own venue is: null when the place has no city
 * that can be found. A lookup that FAILED throws instead of reading as "no city", so the
 * screen can say so and hold the save (PR #1082 r1 #3).
 */
export async function cityForVenue(venueId: string, venues: VenueOption[] | undefined): Promise<string | null> {
  let failed: unknown = null;
  const patch = await venueOverridePatch(venueId, venues, async (name) => {
    try { return await resolveCanonicalCity(name); } catch (e) { failed = e; throw e; }
  });
  if (failed) throw failed;
  return patch.city_id;
}

/**
 * What ONE save sends: a series.upsert with `name` (the handler needs it) and ONLY the changed
 * keys, then, when the chat link changed, series.set_group_chat (the server keeps that link
 * behind its own command). [] when nothing changed or a changed field has a problem. A new
 * place always carries its city, null included, so the old place's city is never left behind.
 * An unchanged `name` is the one the screen opened with; the save goes against the version it
 * opened with too, so it can never overwrite someone else's rename (PR #1082 r1 #1).
 */
export function detailsPlan(base: DetailsDraft, draft: DetailsDraft, cityId: string | null = null): OwnerCommand[] {
  const changed = new Set(changedKeys(DETAILS_SPECS, base, draft));
  if (!changed.size || detailsBlocker(base, draft)) return [];
  const payload: Record<string, unknown> = {};
  if (changed.has('description')) payload.default_description = draft.description.trim();
  if (changed.has('music')) payload.default_music_styles = draft.music;
  if (changed.has('venueId') && draft.venueId) {
    payload.default_venue_id = draft.venueId;
    payload.default_city_id = cityId;
  }
  if (changed.has('ticket')) payload.default_ticket_url = draft.ticket.trim();
  if (changed.has('cover')) payload.default_cover_image_url = draft.cover.trim();
  if (changed.has('instagram')) payload.instagram_url = instagramToSend(draft.instagram);
  if (changed.has('videos')) payload.default_video_urls = videoList(draft.videos);
  const plan: OwnerCommand[] = [];
  if (changed.has('name') || Object.keys(payload).length) plan.push(upsertCommand({ name: draft.name.trim(), ...payload }));
  if (changed.has('chat')) plan.push(groupChatCommand(draft.chat));
  return plan;
}
