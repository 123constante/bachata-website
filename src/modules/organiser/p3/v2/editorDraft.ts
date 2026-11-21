import { useCallback, useSyncExternalStore } from 'react';
import { EMPTY_DRAFT, type EditorDraft } from './editorModel';

/**
 * The one v2 draft per event, shared by the event page and every night screen (handover item 7):
 * a change made on a night stays in the save bar back on the event page and the other way round.
 * In memory only: a reload starts clean (the leave guard asks before that).
 */
const drafts = new Map<string, EditorDraft>();
const listeners = new Set<() => void>();
const emit = () => { for (const l of listeners) l(); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export const draftOf = (seriesId: string): EditorDraft => drafts.get(seriesId) ?? EMPTY_DRAFT;
export function setDraftOf(seriesId: string, fn: (d: EditorDraft) => EditorDraft): void {
  drafts.set(seriesId, fn(draftOf(seriesId)));
  emit();
}
export function clearDraftOf(seriesId: string): void {
  if (drafts.delete(seriesId)) emit();
}

export function useEditorDraft(seriesId: string) {
  const draft = useSyncExternalStore(subscribe, () => draftOf(seriesId), () => EMPTY_DRAFT);
  const update = useCallback((fn: (d: EditorDraft) => EditorDraft) => setDraftOf(seriesId, fn), [seriesId]);
  const clear = useCallback(() => clearDraftOf(seriesId), [seriesId]);
  return { draft, update, clear };
}
