import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Card, GhostButton, PrimaryButton, SheetView, SkeletonRows } from '../../../ui';
import { Avatar } from '../../../team/Avatar';
import { ROLE_LABEL, type TeamRole } from '@/modules/organiser/shared/teamModel';
import { NEEDS_ADMIN_WORK, removalLoses, type Control, type GroupView, type PersonSheetModel, type PersonView, type TeamDashModel } from './teamDashModel';

/** Everything the view can ask for; the container wires these to the real RPCs. */
export interface TeamDashActions {
  onRetry: () => void;
  onOpenMore: (role: TeamRole) => void;
  onChangeRole: (p: PersonView, role: TeamRole) => Promise<void>;
  onSetHidden: (p: PersonView, hide: boolean) => Promise<void>;
  onRemove: (p: PersonView) => Promise<void>;
  onShareLink: () => Promise<void>;
}

export type SheetState = { kind: 'person'; key: string } | { kind: 'remove'; key: string } | { kind: 'add' } | null;

const btnLine = 'inline-flex min-h-[44px] w-full items-center justify-center rounded-[12px] border border-[var(--line-strong)] px-[16px] text-[15px] font-semibold text-[var(--fg)] disabled:opacity-60';

function Why({ id, children }: { id: string; children: ReactNode }) {
  return <p id={id} className="text-[13px] text-[var(--mut)]" data-testid={id}>{children}</p>;
}

function Ctl({ c, id, onClick, to }: { c: Control; id: string; onClick?: () => void; to?: string }) {
  const why = c.reason ? `${id}-why` : undefined;
  return (
    <div className="flex flex-col gap-[4px]">
      {to && !c.disabled
        ? <Link to={to} data-testid={id} className="inline-flex h-[52px] w-full items-center justify-center rounded-[12px] bg-[var(--btn)] text-[16px] font-bold text-[var(--btnfg)]">{c.label}</Link>
        : <PrimaryButton testId={id} disabled={c.disabled} aria-describedby={why} onClick={onClick}>{c.label}</PrimaryButton>}
      {c.reason && <Why id={`${id}-why`}>{c.reason}</Why>}
    </div>
  );
}

function PersonRowView({ p, onOpen }: { p: PersonView; onOpen: (p: PersonView) => void }) {
  const role = p.role === 'listed' ? 'Listed' : ROLE_LABEL[p.role];
  const body = (
    <>
      <Avatar name={p.name} photoUrl={p.photoUrl} size={40} className={p.isStub ? 'opacity-60' : undefined} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block text-[15px] font-semibold text-[var(--fg)] [overflow-wrap:anywhere]">{p.name}{p.isSelf ? ' (you)' : ''}</span>
        {p.line && <span className="block text-[13px] text-[var(--mut)]" data-testid="team-dash-line">{p.line}</span>}
      </span>
      {p.tappable && <span aria-hidden="true" className="text-[var(--mut)]">&rsaquo;</span>}
    </>
  );
  const common = { 'data-testid': 'team-dash-row', 'data-role': p.role, 'data-hidden': p.hidden ? 'true' : 'false', 'data-stub': p.isStub ? 'true' : 'false' };
  return p.tappable
    ? <button type="button" {...common} aria-label={`${p.name}, ${role}${p.isStub ? ', not claimed yet' : ''}. Open`} onClick={() => onOpen(p)} className="flex min-h-[56px] w-full items-center gap-[12px] px-[16px] py-[8px]">{body}</button>
    : <div {...common} className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[8px]">{body}</div>;
}

function Group({ g, onOpen, actions, addTo }: { g: GroupView; onOpen: (p: PersonView) => void; actions: TeamDashActions; addTo: string }) {
  return (
    <section data-testid={`team-dash-group-${g.role}`} aria-labelledby={`tdg-${g.role}`} className="flex flex-col gap-[4px]">
      <div className="flex items-baseline justify-between px-[4px]">
        <h2 id={`tdg-${g.role}`} className="text-[15px] font-bold text-[var(--fg)]">{g.title}</h2>
        <span className="text-[13px] text-[var(--mut)]" data-testid={`team-dash-count-${g.role}`}>{g.count}</span>
      </div>
      <p className="px-[4px] text-[13px] text-[var(--mut)]" data-testid={`team-dash-can-${g.role}`}>{g.can}</p>
      <Card>
        {g.rows.map((p) => <PersonRowView key={p.key} p={p} onOpen={onOpen} />)}
        {g.empty && (
          <div className="flex min-h-[56px] items-center gap-[12px] px-[16px] py-[8px]" data-testid={`team-dash-empty-${g.role}`}>
            <span className="min-w-0 flex-1 text-[14px] text-[var(--mut)]">{g.empty}</span>
            {g.add && (g.add.disabled
              ? <button type="button" disabled aria-describedby={`tdg-add-${g.role}-why`} className="min-h-[44px] rounded-[12px] border border-[var(--line-strong)] px-[12px] text-[14px] font-semibold opacity-60">{g.add.label}</button>
              : <Link to={addTo} data-testid={`team-dash-add-${g.role}`} className="inline-flex min-h-[44px] items-center rounded-[12px] border border-[var(--line-strong)] px-[12px] text-[14px] font-semibold text-[var(--fg)]">{g.add.label}</Link>)}
          </div>
        )}
        {g.folded && (
          <button type="button" data-testid={`team-dash-more-${g.role}`} onClick={() => actions.onOpenMore(g.role)} className="flex min-h-[44px] w-full items-center justify-center text-[15px] font-semibold text-[var(--fg)]">Show all {g.count} {g.title.toLowerCase()}</button>
        )}
      </Card>
      {g.add?.disabled && g.add.reason && <Why id={`tdg-add-${g.role}-why`}>{g.add.reason}</Why>}
    </section>
  );
}

export interface TeamDashViewProps {
  model: TeamDashModel;
  /** Rows by key, for the sheets. */
  people: readonly PersonView[];
  sheetFor: (p: PersonView) => PersonSheetModel;
  actions: TeamDashActions;
  /** The existing find-a-dancer route (it adds managers). */
  addTo: string;
  moreTo: string;
  /** Mounted above the groups (the open "Wants to join" cards). */
  above?: ReactNode;
  /** Said after a change landed, or why it did not. */
  notice?: { tone: 'ok' | 'error'; text: string } | null;
  linkNotice?: string | null;
}

export function TeamDashView({ model: m, people, sheetFor, actions, addTo, moreTo, above, notice = null, linkNotice = null }: TeamDashViewProps) {
  const [sheet, setSheet] = useState<SheetState>(null);
  const [busy, setBusy] = useState(false);
  const opener = useRef<HTMLElement>(null);
  const person = sheet && 'key' in sheet ? people.find((p) => p.key === sheet.key) ?? null : null;
  const close = () => setSheet(null);
  // iOS taps do not focus buttons, so remember the opener ourselves (B-S8).
  const remember = () => { (opener as { current: HTMLElement | null }).current = document.activeElement as HTMLElement | null; };
  const open = (p: PersonView) => setSheet({ kind: 'person', key: p.key });
  const run = async (f: () => Promise<void>, after: 'close' | 'stay') => {
    setBusy(true);
    try { await f(); if (after === 'close') close(); } finally { setBusy(false); }
  };

  if (m.load === 'loading') {
    return (
      <div className="flex flex-col gap-3" data-testid="team-dash-loading">
        <SkeletonRows count={3} label="Loading your team" testId="team-loading" />
        {m.add && <Ctl c={m.add} id="team-dash-add" />}
      </div>
    );
  }
  if (m.load === 'error') {
    return (
      <div role="alert" className="flex flex-col gap-3 rounded-[16px] border border-[var(--line)] bg-[var(--card)] p-[16px]" data-testid="team-dash-error">
        <strong className="text-[15px] text-[var(--fg)]">We could not load your team.</strong>
        <p className="text-[14px] text-[var(--mut)]">Nothing was changed. Check your signal, then try again.</p>
        <button type="button" className={btnLine} onClick={actions.onRetry} data-testid="team-dash-retry">Try again</button>
      </div>
    );
  }
  const sm = person && sheet?.kind === 'person' ? sheetFor(person) : null;
  const rm = person && sheet?.kind === 'remove' ? sheetFor(person) : null;
  return (
    <div className="flex flex-col gap-3" data-testid="team-dash">
      {m.viewOnlyNote && <div role="note" className="rounded-[12px] border border-[var(--line)] bg-[var(--card)] p-[12px] text-[14px] text-[var(--fg)]" data-testid="team-dash-viewonly">{m.viewOnlyNote}</div>}
      {notice && <p role={notice.tone === 'error' ? 'alert' : 'status'} className={`text-[14px] ${notice.tone === 'error' ? 'text-[var(--danger)]' : 'text-[var(--fg)]'}`} data-testid="team-dash-notice">{notice.text}</p>}
      {m.readNote && <p className="text-[13px] text-[var(--mut)]" data-testid="team-dash-readnote">{m.readNote}</p>}
      {above}
      {m.solo && (
        <Card variant="padded" testId="team-dash-solo">
          <h2 className="text-[15px] font-bold text-[var(--fg)]">Only you so far</h2>
          <p className="text-[14px] text-[var(--mut)]">Add a teammate to share the work. They see the same pages you do, with the role they hold.</p>
        </Card>
      )}
      {m.solo && m.add && <Ctl c={m.add} id="team-dash-add" onClick={() => { remember(); setSheet({ kind: 'add' }); }} />}
      {m.groups.map((g) => <Group key={g.role} g={g} onOpen={(p) => { remember(); open(p); }} actions={actions} addTo={addTo} />)}
      {m.listedOnly.length > 0 && (
        <section data-testid="team-dash-listed" className="flex flex-col gap-[4px]">
          <h2 className="px-[4px] text-[15px] font-bold text-[var(--fg)]">Listed on the public page</h2>
          <p className="px-[4px] text-[13px] text-[var(--mut)]">Shown on the page, but not on the team.</p>
          <Card>{m.listedOnly.map((p) => <PersonRowView key={p.key} p={p} onOpen={open} />)}</Card>
        </section>
      )}
      {!m.solo && m.add && <Ctl c={m.add} id="team-dash-add" onClick={() => { remember(); setSheet({ kind: 'add' }); }} />}
      <p className="text-[13px] text-[var(--mut)]" data-testid="team-dash-publicnote">{m.publicNote}</p>

      <SheetView open={!!sm} onOpenChange={(o) => { if (!o) close(); }} title={person?.name ?? 'Person'} returnFocusRef={opener} testId="team-dash-person-sheet">
        {person && sm && (
          <div className="flex flex-col gap-3 p-[16px]">
            {sm.stubNote && <p className="text-[14px] text-[var(--fg)]" data-testid="team-dash-stub">{sm.stubNote}</p>}
            <h3 className="text-[15px] font-bold text-[var(--fg)]">Role</h3>
            <div role="radiogroup" aria-label="Role" className="flex flex-col">
              {sm.roles.map((r) => (
                <button key={r.role} type="button" role="radio" aria-checked={r.selected} disabled={r.disabled || busy} aria-describedby={r.reason ? `tds-role-${r.role}-why` : undefined}
                  data-testid={`team-dash-role-${r.role}`} onClick={() => !r.selected && void run(() => actions.onChangeRole(person, r.role), 'stay')}
                  className="flex min-h-[52px] w-full items-center gap-[12px] px-[4px] py-[8px] text-left disabled:opacity-60">
                  <span aria-hidden="true" className={`h-[20px] w-[20px] shrink-0 rounded-full border ${r.selected ? 'border-[var(--gold)] bg-[var(--gold)]' : 'border-[var(--line-strong)]'}`} />
                  <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-[var(--fg)]">{ROLE_LABEL[r.role]}</span>
                    {r.reason && <span id={`tds-role-${r.role}-why`} className="block text-[13px] text-[var(--mut)]">{r.reason}</span>}</span>
                </button>
              ))}
            </div>
            {sm.lastOwnerNote && <p className="text-[13px] text-[var(--mut)]">{sm.lastOwnerNote}</p>}
            <h3 className="text-[15px] font-bold text-[var(--fg)]">Public page</h3>
            <p className="text-[14px] text-[var(--fg)]" data-testid="team-dash-public-text">{sm.publicText}</p>
            {sm.publicSwitch && (
              <>
                <button type="button" role="switch" aria-checked={person.shared?.isPublic ?? false} disabled={busy || !sm.publicSwitch.press} aria-label={`Show ${person.name} on the public page`}
                  data-testid="team-dash-switch" onClick={() => sm.publicSwitch?.press && void run(() => actions.onSetHidden(person, sm.publicSwitch!.press === 'hide'), 'stay')}
                  className="min-h-[44px] w-full rounded-[12px] border border-[var(--line-strong)] px-[16px] text-[15px] font-semibold text-[var(--fg)] disabled:opacity-60">
                  {person.shared?.isPublic ? 'Shown. Tap to hide' : 'Hidden. Tap to show'}
                </button>
                {sm.publicSwitch.reason && <p className="text-[13px] text-[var(--mut)]" data-testid="team-dash-switch-why">{sm.publicSwitch.reason}</p>}
              </>
            )}
            {sm.leaveVia === 'more'
              ? <Link to={moreTo} data-testid="team-dash-remove" className={btnLine}>{sm.remove.label}</Link>
              : <button type="button" data-testid="team-dash-remove" disabled={sm.remove.disabled} aria-describedby={sm.remove.reason ? 'team-dash-remove-why' : undefined}
                  onClick={() => setSheet({ kind: 'remove', key: person.key })} className={`${btnLine} text-[var(--danger)]`}>{sm.remove.label}</button>}
            {sm.remove.reason && <Why id="team-dash-remove-why">{sm.remove.reason}</Why>}
          </div>
        )}
      </SheetView>

      <SheetView open={!!rm} onOpenChange={(o) => { if (!o) close(); }} title={person ? `${person.isSelf ? 'Leave' : 'Remove'} ${person.name}?` : 'Remove'} onBack={() => person && setSheet({ kind: 'person', key: person.key })} returnFocusRef={opener} testId="team-dash-remove-sheet">
        {person && rm && (
          <div className="flex flex-col gap-3 p-[16px]">
            <p className="text-[14px] font-bold text-[var(--fg)]">{person.name.split(' ')[0]} will lose:</p>
            <ul className="list-disc pl-[20px] text-[14px] text-[var(--fg)]" data-testid="team-dash-loses">
              {removalLoses(person.role === 'listed' ? 'contributor' : person.role, person.hidden).map((x) => <li key={x}>{x}</li>)}
            </ul>
            <p className="text-[14px] text-[var(--mut)]">Their own dancer profile and anything they posted stay. We do not message them. You can add them again any time.</p>
            <PrimaryButton testId="team-dash-confirm-remove" loading={busy} onClick={() => void run(() => actions.onRemove(person), 'close')}>{person.isSelf ? 'Leave' : `Remove ${person.name.split(' ')[0]}`}</PrimaryButton>
            <GhostButton testId="team-dash-keep" onClick={() => setSheet({ kind: 'person', key: person.key })}>Keep {person.name.split(' ')[0]}</GhostButton>
          </div>
        )}
      </SheetView>

      <SheetView open={sheet?.kind === 'add'} onOpenChange={(o) => { if (!o) close(); }} title="Add a teammate" returnFocusRef={opener} testId="team-dash-add-sheet">
        <div className="flex flex-col gap-3 p-[16px]">
          <Link to={addTo} data-testid="team-dash-tab-find" className="flex min-h-[52px] items-center rounded-[12px] border border-[var(--line)] px-[16px] text-[15px] font-semibold text-[var(--fg)]">Find a dancer on Bachata Calendar</Link>
          <button type="button" data-testid="team-dash-tab-link" className="flex min-h-[52px] w-full items-center rounded-[12px] border border-[var(--line)] px-[16px] text-left text-[15px] font-semibold text-[var(--fg)]" onClick={() => void actions.onShareLink()}>Send a sign-up link</button>
          {linkNotice && <p role="status" className="text-[13px] text-[var(--fg)]" data-testid="team-dash-link-notice">{linkNotice}</p>}
          <button type="button" disabled aria-describedby="team-dash-email-why" data-testid="team-dash-tab-email" className="flex min-h-[52px] w-full items-center rounded-[12px] border border-[var(--line)] px-[16px] text-left text-[15px] font-semibold text-[var(--fg)] opacity-60">Invite by email</button>
          <Why id="team-dash-email-why">{NEEDS_ADMIN_WORK.email}</Why>
          <p className="text-[13px] text-[var(--mut)]" data-testid="team-dash-rolepick-why">{NEEDS_ADMIN_WORK.rolePick}</p>
        </div>
      </SheetView>
    </div>
  );
}
