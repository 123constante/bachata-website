import { useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import type { EventWorkspace } from '../../events/eventModel';
import { endRunCommand } from '../../events/eventModel';
import { fetchOrganiserPages } from '../../events/programmeSeriesApi';
import { lifecycleCommand, upsertCommand, type OwnerCommand } from '../../shared/seriesCommands';
import { V2 } from './copy';
import type { WriteStep } from './editorModel';
import { organisersPayload } from './editorModel';
import type { OnSave } from './WhenSheet';
import { savedLabel } from './WhereSheet';
import { NameSheet } from './NameSheet';
import { MusicSheet } from './MusicSheet';
import { OrgSheet } from './OrgSheet';
import { EndCard, type LifeState } from './EndCard';
import { GoLiveBar, isDraftEvent } from './GoLiveBar';
import { StatusSheet } from './StatusSheets';
import { V2Sheet } from './V2Sheet';

const E = V2.every;
const O = V2.oneOff;

/** One raised one-line row (prototype factLn). */
function Line({ id, label, value, onOpen }: { id: string; label: string; value: ReactNode; onOpen: () => void }) {
  return (
    <div className="fwrap" data-testid={`row-${id}`}>
      <button type="button" className="fbtn ln" onClick={onOpen}>
        <span className="lt">{label}</span>
        <span className="lv"><b>{value}</b></span>
        <span className="fgo">&rsaquo;</span>
      </button>
    </div>
  );
}

/**
 * "The event" group of a one-off (slice 15, O-09..O-11): Name, Music, Tickets, Organisers (no Description, no Repeats),
 * then the End card (Pause / End / Make it live again; no Cancel the event). Every save toasts "Saved".
 */
export function OneOffBody({ ws, saveNow, busy, onOpenTickets }: { ws: EventWorkspace; saveNow: OnSave; busy?: boolean; onOpenTickets?: () => void }) {
  const s = ws.series;
  const [sheet, setSheet] = useState<'name' | 'music' | 'orgs' | 'pause' | 'end' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const orgIds = ws.organiserIds ?? [];
  const pages = useQuery({ queryKey: ['org-organiser-pages', ...orgIds], queryFn: () => fetchOrganiserPages(orgIds), enabled: orgIds.length > 0 });
  const label = savedLabel('oneOff', '');
  const name = s.name ?? '';
  const music = (ws.musicStyles ?? []).length ? ws.musicStyles.join(', ') : E.noneYet;
  const orgs = orgIds.length === 0 ? E.noneYet : pages.data?.length ? pages.data.map((p) => p.name).join(', ') : E.organisersN(orgIds.length);
  const life: LifeState = s.lifecycle_status === 'cancelled' ? 'Cancelled' : s.lifecycle_status === 'paused' ? 'Paused' : s.lifecycle_status === 'ended' ? 'Ended' : 'Live';

  const send = async (part: string, payload: Record<string, unknown>, before: Record<string, unknown>) => {
    const step: WriteStep = { part, target: 'series', id: s.id, version: s.version, command: upsertCommand({ name: s.name ?? '', ...payload }), order: 1 };
    const r = await saveNow([step], [{ name: s.name ?? '', ...before }], label);
    if (r.ok) setSheet(null);
  };
  const saveOrgs = async (command: OwnerCommand) => {
    const step: WriteStep = { part: E.organisers, target: 'series', id: s.id, version: s.version, command, order: 1 };
    const r = await saveNow([step], [organisersPayload(ws.organiserIds)], label);
    if (r.ok) setSheet(null);
  };
  const setLife = async (to: 'paused' | 'live', toast: string) => {
    const step: WriteStep = { part: toast, target: 'series', id: s.id, version: s.version, command: lifecycleCommand(to), order: 1 };
    const r = await saveNow([step], [{ to: s.lifecycle_status ?? 'live' }], toast);
    if (r.ok) setSheet(null); else setError(r.error);
  };
  // End on a one-off: before stays { to } (no resume). A one-off has no saved repeat rule, so Undo is set_lifecycle back.
  const endDo = async () => {
    setError(null);
    const step: WriteStep = { part: E.toastEnded, target: 'series', id: s.id, version: s.version, command: endRunCommand(null), order: 1 };
    const r = await saveNow([step], [{ to: s.lifecycle_status ?? 'live' }], E.toastEnded);
    if (r.ok) setSheet(null); else setError(r.error);
  };

  return (
    <>
      <div className="grp" data-testid="oneoff-event">
        <div className="lab hd">{O.eventHead}</div>
        <div className="card"><div className="fb-list">
          <Line id="name" label={E.name} value={name} onOpen={() => setSheet('name')} />
          <Line id="music" label={E.music} value={music} onOpen={() => setSheet('music')} />
          <Line id="goTickets" label={V2.ticketsPay.rowLabel} value={O.ticketsValue} onOpen={() => onOpenTickets?.()} />
          <Line id="organisers" label={E.organisers} value={orgs} onOpen={() => setSheet('orgs')} />
        </div></div>
      </div>
      {isDraftEvent(ws) && <GoLiveBar ws={ws} />}
      {!isDraftEvent(ws) && <EndCard oneOff status={life} endDate={null} reason={null}
        onLive={() => void setLife('live', E.toastLive)} onPause={() => { setError(null); setSheet('pause'); }} onEnd={() => { setError(null); setSheet('end'); }} />}
      {sheet === 'pause' && <StatusSheet to="Paused" from={life} lastNight="" tonight={false} error={error} onDo={() => setLife('paused', E.toastPaused)} onClose={() => setSheet(null)} />}
      {sheet === 'end' && (
        <V2Sheet open title={E.endTitle} onClose={() => setSheet(null)}>
          <div className="grp">
            <p className="txt">{O.endText}</p>
            {error && <p className="txt" role="alert" data-testid="status-error">{error}</p>}
            <button type="button" className="btn dan solid" data-testid="status-do" disabled={busy} onClick={() => void endDo()}>{E.endRow}</button>
            <button type="button" className="btn sec" data-testid="status-keep" onClick={() => setSheet(null)}>{E.keepIt(life)}</button>
          </div>
        </V2Sheet>
      )}
      {sheet === 'name' && <NameSheet current={name} day="" onSave={async (v) => { await send(E.name, { name: v }, {}); }} onClose={() => setSheet(null)} />}
      {sheet === 'music' && <MusicSheet current={ws.musicStyles ?? []} onSave={async (m) => { await send(E.music, { default_music_styles: m }, { default_music_styles: ws.musicStyles ?? [] }); }} onClose={() => setSheet(null)} />}
      {sheet === 'orgs' && <OrgSheet stored={orgIds} names={Object.fromEntries((pages.data ?? []).map((p) => [p.id, p.name]))} seriesId={s.id} lifecycle={s.lifecycle_status ?? ''} onSave={saveOrgs} onClose={() => setSheet(null)} />}
    </>
  );
}
