// Edit in place: the Team sheet's "Who shows on your page" list (J7, scope 4/4a).
// Opens from the Team card for owner, admin, manager and the self arm
// (visibilityAccess). Each row says whether the person is shown on or hidden
// from the public page; a Hide / Show button appears ONLY where canSetHidden()
// says so (teamVisibilityModel). If the hidden read fails the sheet says
// "Couldn't check who is hidden. Try again" and draws NO controls: a button
// that guesses the current state could undo someone else's choice.
//
// After every Hide / Show the public Team and the hidden list are re-read
// together (organiserPublicTeamKey + organiserTeamHiddenKey). A refusal shows
// the server's reason in plain words (hideErrorMessage) under that row.
//
// A modal dialog: focus starts on Close, Tab is trapped, Escape and the overlay
// close it (not while a change is being sent); the caller returns focus.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { TeamMember, TeamRole } from '@/modules/organiser/shared/teamModel';
import {
  fetchOrganiserPublicTeam,
  fetchTeamHidden,
  hideErrorMessage,
  organiserPublicTeamKey,
  organiserTeamHiddenKey,
  setTeamMemberHidden,
} from '@/modules/organiser/team/publicTeamApi';
import type { PublicTeamRow } from '@/modules/profile/organiserTeam';
import { supabase } from '@/integrations/supabase/client';
import { useKeyboardInset } from '@/modules/organiser/ui/useKeyboardInset';
import { inBody } from './layers';
import { GOLD } from './parts';
import { btn, sheetFrame, trapTab } from './sheetStyles';
import { VISIBILITY_COPY, actionAriaLabel, unnamedHiddenIds, visibilityRows, type VisibilityRow } from './teamVisibilityModel';

const MUTED = 'rgba(246,241,234,0.7)';
const ERROR = '#FF8A70';

/** Names for hidden people on no seat and no public row. A failed read only falls back to "A team member". */
async function defaultFetchNames(ids: string[]): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (ids.length === 0) return out;
  const { data, error } = await supabase.from('dancer_profiles').select('id, first_name, surname').in('id', ids);
  if (error) throw error;
  for (const r of (data ?? []) as { id: string; first_name: string | null; surname: string | null }[]) {
    const name = [r.first_name, r.surname].filter((s) => typeof s === 'string' && s.trim() !== '').join(' ').trim();
    if (name) out.set(r.id, name);
  }
  return out;
}

export interface TeamVisibilitySheetProps {
  organiserId: string;
  myRole: TeamRole | 'admin' | null | undefined;
  members: readonly TeamMember[];
  onClose: () => void;
  /** Injected by tests; the real RPCs otherwise. */
  fetchPublic?: (organiserId: string) => Promise<PublicTeamRow[]>;
  fetchHidden?: (organiserId: string) => Promise<Set<string>>;
  fetchNames?: (ids: string[]) => Promise<Map<string, string>>;
  setHidden?: (organiserId: string, personId: string, hidden: boolean) => Promise<unknown>;
}

export default function TeamVisibilitySheet({ organiserId, myRole, members, onClose, fetchPublic, fetchHidden, fetchNames, setHidden }: TeamVisibilitySheetProps) {
  const queryClient = useQueryClient();
  const titleId = useId();
  const sheetRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const { inset, height } = useKeyboardInset();
  const [busy, setBusy] = useState<string | null>(null);
  const [rowError, setRowError] = useState<{ key: string; text: string } | null>(null);

  const publicQuery = useQuery({
    queryKey: organiserPublicTeamKey(organiserId),
    queryFn: () => (fetchPublic ?? fetchOrganiserPublicTeam)(organiserId),
  });
  const hiddenQuery = useQuery({
    queryKey: organiserTeamHiddenKey(organiserId),
    queryFn: () => (fetchHidden ?? fetchTeamHidden)(organiserId),
    retry: false,
  });
  const needNames = useMemo(
    () => (publicQuery.data && hiddenQuery.data ? unnamedHiddenIds({ members, publicRows: publicQuery.data, hidden: hiddenQuery.data }) : []),
    [members, publicQuery.data, hiddenQuery.data],
  );
  const namesQuery = useQuery({
    queryKey: ['organiser-team-hidden-names', organiserId, needNames] as const,
    queryFn: () => (fetchNames ?? defaultFetchNames)(needNames),
    enabled: needNames.length > 0,
    retry: false,
  });

  const rows: VisibilityRow[] | null = useMemo(() => {
    if (!publicQuery.data || !hiddenQuery.data) return null;
    // Wait for the name read (or its failure) so a hidden person never flashes as "A team member".
    if (needNames.length > 0 && namesQuery.isPending) return null;
    return visibilityRows({ myRole, members, publicRows: publicQuery.data, hidden: hiddenQuery.data, names: namesQuery.data });
  }, [myRole, members, publicQuery.data, hiddenQuery.data, namesQuery.data, namesQuery.isPending, needNames.length]);

  useEffect(() => { closeRef.current?.focus(); }, []);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape' && !busy) { e.preventDefault(); onClose(); return; }
    trapTab(e, sheetRef.current);
  };

  const act = useCallback(async (row: VisibilityRow) => {
    if (!row.personId || !row.action || busy) return;
    setBusy(row.key);
    setRowError(null);
    try {
      await (setHidden ?? setTeamMemberHidden)(organiserId, row.personId, row.action === 'hide');
    } catch (err) {
      setRowError({ key: row.key, text: hideErrorMessage(err) });
    } finally {
      // Re-read both, together, whatever the answer: a refusal can mean the state moved under us.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: organiserTeamHiddenKey(organiserId) }),
        queryClient.invalidateQueries({ queryKey: organiserPublicTeamKey(organiserId) }),
      ]);
      setBusy(null);
    }
  }, [busy, organiserId, queryClient, setHidden]);

  let body: JSX.Element;
  if (publicQuery.isError) {
    body = (
      <p role="alert" style={{ margin: '8px 0', fontSize: 14, color: ERROR }} data-testid="eip-vis-team-error">
        {VISIBILITY_COPY.teamReadError}{' '}
        <button type="button" onClick={() => void publicQuery.refetch()} style={{ ...btn, padding: '0 8px', background: 'none', border: 'none', color: GOLD }}>{VISIBILITY_COPY.retry}</button>
      </p>
    );
  } else if (hiddenQuery.isError) {
    body = (
      <p role="alert" style={{ margin: '8px 0', fontSize: 14, color: ERROR }} data-testid="eip-vis-hidden-error">
        {VISIBILITY_COPY.hiddenReadError}{' '}
        <button type="button" onClick={() => void hiddenQuery.refetch()} style={{ ...btn, padding: '0 8px', background: 'none', border: 'none', color: GOLD }}>{VISIBILITY_COPY.retry}</button>
      </p>
    );
  } else if (!rows) {
    body = <p style={{ margin: '8px 0', fontSize: 14, color: MUTED }} aria-live="polite">{VISIBILITY_COPY.loading}</p>;
  } else if (rows.length === 0) {
    body = <p style={{ margin: '8px 0', fontSize: 14, color: MUTED }}>{VISIBILITY_COPY.empty}</p>;
  } else {
    body = (
      <ul style={{ listStyle: 'none', margin: 0, padding: 0 }} data-testid="eip-vis-list">
        {rows.map((row) => (
          <li key={row.key} data-testid="eip-vis-row" data-person={row.personId ?? ''} style={{ borderTop: '1px solid rgba(246,241,234,0.08)', padding: '6px 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {row.name}{row.isSelf ? ' (you)' : ''}
                </div>
                <div style={{ fontSize: 13, color: row.hidden ? GOLD : MUTED }} data-testid="eip-vis-status">{row.status}</div>
              </div>
              {row.action && (
                <button
                  type="button"
                  onClick={() => void act(row)}
                  disabled={busy !== null}
                  aria-label={actionAriaLabel(row)}
                  aria-busy={busy === row.key || undefined}
                  data-testid="eip-vis-action"
                  style={{ ...btn, flexShrink: 0, background: 'none', border: `1px solid ${GOLD}`, color: GOLD, opacity: busy !== null && busy !== row.key ? 0.5 : 1 }}
                >
                  {row.action === 'hide' ? VISIBILITY_COPY.hide : VISIBILITY_COPY.show}
                </button>
              )}
            </div>
            {rowError?.key === row.key && <p role="alert" style={{ margin: '2px 0 0', fontSize: 13, color: ERROR }} data-testid="eip-vis-row-error">{rowError.text}</p>}
          </li>
        ))}
      </ul>
    );
  }

  return inBody(
    <>
      <div aria-hidden="true" data-testid="eip-sheet-overlay" onClick={() => { if (!busy) onClose(); }} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(0,0,0,0.55)' }} />
      <div ref={sheetRef} role="dialog" aria-modal="true" aria-labelledby={titleId} onKeyDown={onKeyDown} style={sheetFrame(inset, height)} data-testid="eip-vis-sheet">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 44 }}>
          <h2 id={titleId} style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{VISIBILITY_COPY.title}</h2>
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy !== null} style={{ ...btn, padding: '0 12px', background: 'none', border: 'none', color: MUTED }}>{VISIBILITY_COPY.close}</button>
        </div>
        {body}
      </div>
    </>,
  );
}
