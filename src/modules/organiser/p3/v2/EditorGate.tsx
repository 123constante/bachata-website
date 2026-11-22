import type { ReactNode } from 'react';
import { WorkspaceGate } from '../screens/EventPage';
import { isV2Format } from './editorModel';
import { EditorV2 } from './EditorV2';

/**
 * Editor v2 gate (flag organiserEditorV2, mounted only while it is on): weekly and one-off events get the
 * editor; every other format (festival, course, a festival's series) gets `fallback`, today's screen.
 */
export function R4EditorGate({ fallback }: { fallback: ReactNode }) {
  return (
    <WorkspaceGate>
      {(ws) => (isV2Format(ws.series.format) && !ws.series.festival_id ? <EditorV2 key={ws.series.id} ws={ws} /> : <>{fallback}</>)}
    </WorkspaceGate>
  );
}
