import type { ReactNode } from 'react';
import { WorkspaceGate } from '../screens/EventPage';
import { isV2Format } from './editorModel';
import { EventPageV2 } from './EventPageV2';

/**
 * Editor v2 gate (flag organiserEditorV2, mounted only while it is on): weekly and one-off events get the
 * v2 event page; every other format (festival, course, a festival's series) gets `fallback`, today's screen.
 */
export function R4EditorGate({ fallback }: { fallback: ReactNode }) {
  return (
    <WorkspaceGate>
      {(ws) => (isV2Format(ws.series.format) && !ws.series.festival_id ? <EventPageV2 key={ws.series.id} ws={ws} /> : <>{fallback}</>)}
    </WorkspaceGate>
  );
}
