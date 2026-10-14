// Edit in place: the team picker (mockup "Team sheet", screens 3 and 4). For an
// owner or admin only (teamPickerAccess); the layer never mounts it otherwise.
//
// Keyboard (screen 4): the search box is at the TOP; the sheet sits against
// window.visualViewport (useKeyboardInset, as FieldSheet), so it is never taller
// than what is visible above the keyboard; the results show about three 48px
// rows and scroll INSIDE their own box; "Can't find them? Send an invite link"
// sits right under them, so it is above the keyboard too. Tapping a result
// PICKS the person as a chip and blurs the box, which closes the keyboard, and
// Done is scrolled into view. Done adds every chip (one call each); a refused
// chip stays, with the server's reason in plain words (teamPickerModel).
//
// A modal dialog: focus starts in the search box, Tab is trapped, Escape and the
// overlay close it (not while adding), and the caller returns focus to the
// card's "Add a person" button.
import { useCallback, useEffect, useId, useRef, useState, type KeyboardEvent } from 'react';
import { X } from 'lucide-react';
import { useKeyboardInset } from '@/modules/organiser/ui/useKeyboardInset';
import { ADD_ROLES, ROLE_LABEL } from '@/modules/organiser/shared/teamModel';
import { inBody } from './layers';
import { CREAM, GOLD, INK } from './parts';
import { btn, inputStyle, sheetFrame, trapTab } from './sheetStyles';
import {
  DEFAULT_ADD_ROLE,
  PICKER_COPY,
  ROW_STATE_LABEL,
  addBlockedReason,
  addPicked,
  inviteShare,
  listMessage,
  personInitials,
  personSubline,
  rowActionLabel,
  rowState,
  willAddLine,
  type AddOutcome,
  type AddRole,
  type PersonResult,
} from './teamPickerModel';
import { usePeopleSearch } from './usePeopleSearch';

export interface TeamSheetProps {
  access: 'owner' | 'admin';
  organiserName: string;
  search: (term: string) => Promise<unknown>;
  add: (profileId: string, role: AddRole, reason: string | null) => Promise<unknown>;
  /** After Done has asked the server: every outcome, refused ones included. */
  onAdded: (outcomes: AddOutcome[], role: AddRole) => void;
  onClose: () => void;
  /** Injected by tests; navigator.share / clipboard otherwise. */
  shareInvite?: (share: { title: string; text: string; url: string }) => Promise<'shared' | 'copied'>;
}

const MUTED = 'rgba(246,241,234,0.7)';
const ERROR = '#FF8A70';
const ROW_H = 48;
/** About three rows, plus a sliver of the fourth so a longer list reads as scrollable. */
export const LIST_MAX_H = ROW_H * 3 + 12;

async function defaultShare(share: { title: string; text: string; url: string }): Promise<'shared' | 'copied'> {
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    await navigator.share(share);
    return 'shared';
  }
  await navigator.clipboard.writeText(`${share.text} ${share.url}`);
  return 'copied';
}

function Avatar({ person }: { person: PersonResult }) {
  const [broken, setBroken] = useState(false);
  const size = 36;
  if (person.photoUrl && !broken) {
    return <img src={person.photoUrl} alt="" width={size} height={size} loading="lazy" onError={() => setBroken(true)} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />;
  }
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', background: 'rgba(231,190,110,0.18)', color: GOLD, fontSize: 13, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      {personInitials(person.name)}
    </span>
  );
}

export default function TeamSheet({ access, organiserName, search, add, onAdded, onClose, shareInvite = defaultShare }: TeamSheetProps) {
  const titleId = useId();
  const listId = useId();
  const msgId = useId();
  const reasonId = useId();
  const blockedId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef<HTMLButtonElement>(null);
  const { inset, height } = useKeyboardInset(true);
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<PersonResult[]>([]);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const [refusals, setRefusals] = useState<Record<string, string>>({});
  const [role, setRole] = useState<AddRole>(DEFAULT_ADD_ROLE);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [invite, setInvite] = useState<string | null>(null);
  const { state, people } = usePeopleSearch(query, search);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      if (!busy) onClose();
      return;
    }
    trapTab(e, sheetRef.current);
  };

  const pick = useCallback((p: PersonResult) => {
    setPicked((cur) => (cur.some((c) => c.profileId === p.profileId) ? cur : [...cur, p]));
    setRefusals((r) => { const { [p.profileId]: _gone, ...rest } = r; return rest; });
    // Closes the phone keyboard; focus lands on the chips, Done is brought into view.
    inputRef.current?.blur();
    requestAnimationFrame(() => {
      chipsRef.current?.focus({ preventScroll: true });
      doneRef.current?.scrollIntoView?.({ block: 'nearest' });
    });
  }, []);

  const unpick = (id: string) => {
    setPicked((cur) => cur.filter((c) => c.profileId !== id));
    setRefusals((r) => { const { [id]: _gone, ...rest } = r; return rest; });
  };

  const online = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const blocked = addBlockedReason({ access, picked: picked.length, reason, online });
  const willAdd = willAddLine(picked, role);
  const message = listMessage(state);

  const done = async () => {
    if (busy || blocked) return;
    if (picked.length === 0) { onClose(); return; }
    setBusy(true);
    try {
      const outcomes = await addPicked((id) => add(id, role, access === 'admin' ? reason.trim() : null), picked);
      const okIds = new Set(outcomes.filter((o) => o.ok).map((o) => o.profileId));
      setAdded((s) => new Set([...s, ...okIds]));
      setPicked((cur) => cur.filter((c) => !okIds.has(c.profileId)));
      const refused: Record<string, string> = {};
      for (const o of outcomes) if ('message' in o) refused[o.profileId] = o.message;
      setRefusals(refused);
      onAdded(outcomes, role);
      if (outcomes.every((o) => o.ok)) onClose();
    } finally {
      setBusy(false);
    }
  };

  const sendInvite = async () => {
    const share = inviteShare(organiserName, typeof window === 'undefined' ? '' : window.location.origin);
    try {
      const how = await shareInvite(share);
      setInvite(how === 'shared' ? PICKER_COPY.inviteShared : PICKER_COPY.inviteCopied);
    } catch (e) {
      // The share sheet closed without sending: say nothing new.
      if ((e as { name?: string } | null)?.name === 'AbortError') return;
      setInvite(PICKER_COPY.inviteFailed(share.url));
    }
  };

  return inBody(
    <>
      <div aria-hidden="true" data-testid="eip-sheet-overlay" onClick={() => { if (!busy) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)' }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} style={sheetFrame(inset, height)} data-testid="eip-team-sheet">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{PICKER_COPY.title}</h2>
          <button type="button" onClick={onClose} disabled={busy} style={{ ...btn, padding: '0 12px', background: 'none', border: 'none', color: MUTED }}>{PICKER_COPY.cancel}</button>
        </div>
        <label htmlFor={`${titleId}-q`} className="sr-only">{PICKER_COPY.searchLabel}</label>
        <input
          id={`${titleId}-q`}
          ref={inputRef}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); inputRef.current?.blur(); } }}
          placeholder={PICKER_COPY.placeholder}
          aria-controls={listId}
          aria-describedby={message ? msgId : undefined}
          enterKeyHint="search"
          autoComplete="off"
          autoCapitalize="words"
          autoCorrect="off"
          spellCheck={false}
          className="org-eip-input" style={{ ...inputStyle, marginTop: 4 }}
        />
        <div id={listId} role="list" aria-label="People found" data-testid="eip-team-results" style={{ marginTop: 6, maxHeight: LIST_MAX_H, overflowY: 'auto', overscrollBehavior: 'contain' }}>
          {people.map((p) => {
            const st = rowState(p, picked, added);
            return (
              <div role="listitem" key={p.profileId}>
                <button
                  type="button"
                  className="eip-btn"
                  data-testid="eip-team-result"
                  data-state={st}
                  aria-label={rowActionLabel(p, st)}
                  aria-disabled={st !== 'pick' || busy}
                  onClick={() => { if (st === 'pick' && !busy) pick(p); }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', minHeight: ROW_H, padding: '4px 2px', background: 'none', border: 'none', borderTop: '1px solid rgba(246,241,234,0.08)', color: CREAM, textAlign: 'left', cursor: st === 'pick' ? 'pointer' : 'default' }}
                >
                  <Avatar person={p} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                    <span style={{ display: 'block', fontSize: 12.5, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{personSubline(p)}</span>
                  </span>
                  <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 13, fontWeight: 800, color: st === 'pick' ? GOLD : MUTED }}>{ROW_STATE_LABEL[st]}</span>
                </button>
              </div>
            );
          })}
          {message && (
            <p id={msgId} role={message.tone === 'error' ? 'alert' : 'status'} data-testid="eip-team-message" style={{ margin: '8px 0', fontSize: 13.5, color: message.tone === 'error' ? ERROR : MUTED }}>
              {message.text}
            </p>
          )}
        </div>
        <p style={{ margin: '2px 0 0', display: 'flex', alignItems: 'center', flexWrap: 'wrap', columnGap: 4, fontSize: 13.5, color: MUTED }} data-testid="eip-team-invite">
          {PICKER_COPY.inviteLead}
          <button type="button" className="eip-btn" onClick={() => void sendInvite()} style={{ minHeight: 44, padding: '0 4px', background: 'none', border: 'none', color: GOLD, fontSize: 13.5, fontWeight: 700, textDecoration: 'underline', cursor: 'pointer' }}>
            {PICKER_COPY.inviteLink}
          </button>
        </p>
        {invite && <p role="status" data-testid="eip-team-invite-note" style={{ margin: '0 0 4px', fontSize: 13, color: GOLD, overflowWrap: 'anywhere' }}>{invite}</p>}

        <div ref={chipsRef} tabIndex={-1} aria-label={PICKER_COPY.chipsLabel} role="group" data-testid="eip-team-chips" style={{ marginTop: 6, outline: 'none' }}>
          {picked.length === 0 ? (
            <p style={{ margin: '4px 0', fontSize: 13, color: MUTED }}>{PICKER_COPY.noneYet}</p>
          ) : (
            <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {picked.map((p) => (
                <li key={p.profileId} data-testid="eip-team-chip" style={{ display: 'inline-flex', alignItems: 'center', maxWidth: '100%', minHeight: 32, paddingLeft: 10, borderRadius: 999, background: 'rgba(231,190,110,0.16)', border: `1px solid ${refusals[p.profileId] ? ERROR : GOLD}`, color: CREAM, fontSize: 13.5, fontWeight: 600 }}>
                  <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
                  <button type="button" onClick={() => unpick(p.profileId)} disabled={busy} aria-label={`Unpick ${p.name}`} style={{ minWidth: 44, minHeight: 44, margin: '-6px 0', background: 'none', border: 'none', color: CREAM, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                    <X width={14} height={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {picked.filter((p) => refusals[p.profileId]).map((p) => (
            <p key={p.profileId} role="alert" data-testid="eip-team-refusal" style={{ margin: '6px 0 0', fontSize: 13, color: ERROR }}>
              {p.name}: {refusals[p.profileId]}
            </p>
          ))}
        </div>

        <fieldset style={{ border: 'none', margin: '8px 0 0', padding: 0 }}>
          <legend style={{ padding: 0, fontSize: 13, fontWeight: 700, color: CREAM }}>{PICKER_COPY.roleLegend}</legend>
          <div style={{ display: 'flex', gap: 6, marginTop: 4 }}>
            {ADD_ROLES.map((r) => (
              <label key={r} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 999, border: `1px solid ${role === r ? GOLD : 'rgba(246,241,234,0.25)'}`, color: role === r ? GOLD : CREAM, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                <input type="radio" name={`${titleId}-role`} value={r} checked={role === r} onChange={() => setRole(r)} disabled={busy} style={{ width: 18, height: 18, accentColor: GOLD }} />
                {ROLE_LABEL[r]}
              </label>
            ))}
          </div>
          <p style={{ margin: '4px 0 0', fontSize: 12.5, color: MUTED }}>{PICKER_COPY.roleHelp}</p>
        </fieldset>

        {access === 'admin' && (
          <div style={{ marginTop: 8 }}>
            <label htmlFor={reasonId} style={{ display: 'block', fontSize: 13, fontWeight: 700 }}>{PICKER_COPY.reasonLabel}</label>
            <input id={reasonId} value={reason} onChange={(e) => setReason(e.target.value)} disabled={busy} enterKeyHint="done" style={{ ...inputStyle, marginTop: 4 }} aria-describedby={`${reasonId}-help`} />
            <p id={`${reasonId}-help`} style={{ margin: '4px 0 0', fontSize: 12.5, color: MUTED }}>{PICKER_COPY.reasonHelp}</p>
          </div>
        )}

        {willAdd && !blocked && <p data-testid="eip-team-will-add" style={{ margin: '10px 0 0', fontSize: 13, color: CREAM }}>{willAdd}</p>}
        {blocked && <p id={blockedId} data-testid="eip-team-blocked" style={{ margin: '10px 0 0', fontSize: 13, color: ERROR }}>{blocked}</p>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
          <button
            ref={doneRef}
            type="button"
            onClick={() => void done()}
            disabled={busy || !!blocked}
            aria-disabled={busy || !!blocked}
            aria-describedby={blocked ? blockedId : undefined}
            style={{ ...btn, minWidth: 96, background: GOLD, color: INK, border: 'none', opacity: busy || blocked ? 0.5 : 1 }}
          >
            {busy ? PICKER_COPY.adding : PICKER_COPY.done}
          </button>
        </div>
      </div>
    </>,
  );
}
