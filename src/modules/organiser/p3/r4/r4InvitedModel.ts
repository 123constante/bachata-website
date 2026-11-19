/*
 * Board R4Team, screens 13-15 (flag organiserR4): the "Invited" rows under the role groups.
 * Pure, client-free. Read: list_organiser_invites_sent_v1(p_organiser_id) -> { ok, rows[] }, owners and
 * managers only (anyone else gets ok:false, not_authorised, and the section stays hidden).
 *
 * Rows are pending team invites and open door-seat invites. invitee_label is the SERVER's choice:
 * a team row carries the invitee's email only for a platform admin or an invite issued by a current
 * owner/manager of the page, otherwise the prefilled first name, or NULL. A door row's label is always
 * NULL. A NULL label shows "Invited person" -- never a made-up name, never the email from anywhere else.
 * No revoke: the repo has no revoke command for either invite kind, so the rows are read-only.
 */
import { ROLE_LABEL, type TeamRole } from '@/modules/organiser/shared/teamModel';
import { accessEndsWord } from '../door/join/doorJoinModel';

export type InviteKind = 'team' | 'door_seat';

export interface SentInvite {
  id: string;
  kind: InviteKind;
  /** owner | manager | contributor on a team row; 'door' on a door row. */
  role: string;
  label: string | null;
  sentAt: string | null;
  expiresAt: string | null;
}

export interface R4InvitedRow { key: string; label: string; role: string; when: string | null; kind: InviteKind }

export interface R4InvitedModel {
  /** hidden: nothing to show (no rows, not an editor, not allowed, still loading). */
  state: 'hidden' | 'error' | 'rows';
  rows: R4InvitedRow[];
}

export const R4_INVITED_COPY = {
  title: 'Invited',
  nullLabel: 'Invited person',
  door: 'Door, one night',
  error: 'We could not load who you have invited. Nothing was changed.',
  retry: 'Try again',
} as const;

const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() !== '' ? v.trim() : null);

/** Parse the read. Throws on a shape we do not know, so a bad answer is an error, never an empty list. */
export function parseInvitesSent(raw: unknown): { ok: boolean; rows: SentInvite[] } {
  if (!raw || typeof raw !== 'object') throw new Error('invites_sent_bad_shape');
  const o = raw as { ok?: unknown; rows?: unknown };
  if (o.ok !== true) return { ok: false, rows: [] };
  if (!Array.isArray(o.rows)) throw new Error('invites_sent_bad_shape');
  const rows: SentInvite[] = [];
  for (const r of o.rows as Record<string, unknown>[]) {
    const id = str(r?.invite_id);
    const kind = r?.kind === 'team' || r?.kind === 'door_seat' ? r.kind : null;
    if (!id || !kind) continue;
    rows.push({ id, kind, role: str(r.role) ?? '', label: kind === 'door_seat' ? null : str(r.invitee_label), sentAt: str(r.sent_at), expiresAt: str(r.expires_at) });
  }
  return { ok: true, rows };
}

/** "just now", "5 minutes ago", "3 hours ago", "2 days ago". */
export function agoWord(iso: string | null, now: Date): string | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  const mins = Math.max(0, Math.floor((now.getTime() - t) / 60000));
  if (mins < 1) return 'just now';
  const unit = (n: number, w: string) => `${n} ${w}${n === 1 ? '' : 's'} ago`;
  if (mins < 60) return unit(mins, 'minute');
  const hours = Math.floor(mins / 60);
  if (hours < 24) return unit(hours, 'hour');
  return unit(Math.floor(hours / 24), 'day');
}

const roleWord = (i: SentInvite): string => {
  if (i.kind === 'door_seat') return R4_INVITED_COPY.door;
  return ROLE_LABEL[i.role as TeamRole] ?? 'Teammate';
};

const whenWord = (i: SentInvite, now: Date): string | null => {
  if (i.kind === 'door_seat') { const e = accessEndsWord(i.expiresAt); return e ? `Ends ${e}` : null; }
  const a = agoWord(i.sentAt, now);
  return a ? `Sent ${a}` : null;
};

export interface R4InvitedInput {
  /** Owner or manager: the only callers the read answers. */
  editor: boolean;
  read: 'loading' | 'error' | 'ready';
  data?: { ok: boolean; rows: readonly SentInvite[] } | null;
  now: Date;
}

export function buildR4Invited(i: R4InvitedInput): R4InvitedModel {
  if (!i.editor || i.read === 'loading') return { state: 'hidden', rows: [] };
  if (i.read === 'error') return { state: 'error', rows: [] };
  if (!i.data?.ok || i.data.rows.length === 0) return { state: 'hidden', rows: [] };
  return {
    state: 'rows',
    rows: i.data.rows.map((r) => ({ key: r.id, kind: r.kind, label: r.label ?? R4_INVITED_COPY.nullLabel, role: roleWord(r), when: whenWord(r, i.now) })),
  };
}
