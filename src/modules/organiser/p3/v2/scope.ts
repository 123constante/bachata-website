import { flags } from '@/lib/featureFlags';

/**
 * Editor v2: one save bar across the event page and its nights. Moving between `events/<id>/edit` and
 * `events/<id>/night/<occ>` keeps the draft and never asks; leaving that pair asks. Kept apart from
 * editorModel so the shared leave guard (EditTray) does not pull the v2 copy into its chunk.
 */
const V2_SCOPE = /\/events\/([^/]+)\/(?:edit|night\/[^/]+)\/?$/;
export function sameV2Editor(from: string, to: string): boolean {
  const a = V2_SCOPE.exec(from);
  const b = V2_SCOPE.exec(to);
  return !!a && !!b && a[1] === b[1];
}
/** The leave guard's no-ask pair, only while v2 is on (flag off: every screen asks as before). */
export const v2KeepsDraft = (from: string, to: string, on: boolean = flags.organiserEditorV2): boolean =>
  on && sameV2Editor(from, to);
