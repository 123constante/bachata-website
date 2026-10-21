// The series-wide media fields (P-SERIES, PARITY-GAP C06): gallery and videos.
// Pure. Each builder returns ONE series.upsert carrying `name` (the handler needs
// it) plus the one changed key, or null when nothing changed. The usual end and the
// price list editors are gone (ER-C8, rules 1 and D1: stored values stay untouched).
// An untouched Save sends nothing.

import { upsertCommand, type OwnerCommand } from '@/modules/organiser/shared/seriesCommands';
import type { EventWorkspace } from './eventModel';

const same = (a: string[], b: string[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** Gallery or videos: ONE upsert with the new list, null when the list is unchanged. */
export function mediaCommand(ws: EventWorkspace, key: 'default_gallery' | 'default_video_urls', next: string[]): OwnerCommand | null {
  const before = key === 'default_gallery' ? ws.gallery : ws.videoUrls;
  const clean = next.map((v) => v.trim()).filter(Boolean);
  return same(before, clean) ? null : upsertCommand({ name: ws.series.name, [key]: clean });
}

export const countLabel = (n: number, one: string, many: string) => (n ? `${n} ${n === 1 ? one : many}` : 'Add');
