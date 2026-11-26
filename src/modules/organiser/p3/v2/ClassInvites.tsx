import { useEffect, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { shareHref } from '@/modules/admin-organisers/invitePersonModel';
import { Avatar } from './PeoplePickerScreen';
import { V2Sheet } from './V2Sheet';

type Rpc = (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>;
const rpc: Rpc = (fn, args) => (supabase.rpc as unknown as Rpc)(fn, args);
const must = (r: { data: unknown; error: { message: string } | null }) => { if (r.error) throw new Error(r.error.message); return r.data; };

export interface ClassInvite {
  invite_id: string; display_name: string; program_item_id: string | null; added_session_id: string | null;
  forward: boolean; made_on_date: string | null; last_sent_at: string | null; expires_at: string | null; status: 'open' | 'expired' | 'claimed';
}
export interface InviteLink { invite_id: string; token: string; expires_at: string | null }

/** One row of organiser_class_invites_waiting_v1 (admin#2436): open or expired invites the organiser still waits on. */
export interface WaitingInvite {
  invite_id: string; display_name: string; series_id: string; event_name: string; class_title: string;
  next_date: string; last_sent_at: string | null; status: 'open' | 'expired';
}

/** One row of organiser_classes_without_teachers_v1 (admin#2449): a class in the next 7 days with no teachers. */
export interface NoTeacherClass {
  series_id: string; event_name: string; occurrence_id: string; date: string; session_id: string | null;
  added_only: boolean; class_title: string; start_time: string | null;
}
export const noTeachersKey = (organiserId: string) => ['classes-without-teachers', organiserId] as const;
/** One row of organiser_class_teachers_week_v1: a class this week with its teachers. */
export interface WeekClass extends NoTeacherClass { teachers: string[]; invite_pending: boolean }
export const classTeachersWeekKey = (pageId: string) => ['class-teachers-week', pageId] as const;

export const classInvitesKey = (occurrenceId: string) => ['class-invites', occurrenceId] as const;
export const waitingInvitesKey = (organiserId: string) => ['class-invites-waiting', organiserId] as const;
export const MAX_NAME = 80;
export const CAP_COPY = 'You have 20 invites waiting. Remove one first.';
export const FAIL_COPY = "Couldn't make the link. Try again.";

export async function listClassInvites(occurrenceId: string): Promise<ClassInvite[]> {
  const d = must(await rpc('organiser_class_invite_list_v1', { p_occurrence_id: occurrenceId }));
  return Array.isArray(d) ? (d as ClassInvite[]) : [];
}
export async function fetchWaitingInvites(organiserId: string): Promise<WaitingInvite[]> {
  const d = must(await rpc('organiser_class_invites_waiting_v1', { p_organiser_id: organiserId }));
  return Array.isArray(d) ? (d as WaitingInvite[]) : [];
}
/** organiser_classes_without_teachers_v1 may not be on prod yet: ANY error or non-array is "no rows". */
export async function classesWithoutTeachers(organiserId: string): Promise<NoTeacherClass[]> {
  try {
    const r = await rpc('organiser_classes_without_teachers_v1', { p_organiser_id: organiserId });
    return !r.error && Array.isArray(r.data) ? (r.data as NoTeacherClass[]) : [];
  } catch { return []; }
}
/** organiser_class_teachers_week_v1 may not be on prod yet: ANY error or non-array is "no rows". */
export async function classTeachersWeek(organiserId: string): Promise<WeekClass[]> {
  try {
    const r = await rpc('organiser_class_teachers_week_v1', { p_organiser_id: organiserId });
    return !r.error && Array.isArray(r.data) ? (r.data as WeekClass[]) : [];
  } catch { return []; }
}
export async function createClassInvite(a: { occurrenceId: string; itemId: string | null; addedId: string | null; name: string; forward: boolean }): Promise<InviteLink> {
  return must(await rpc('organiser_class_invite_create_v1', {
    p_occurrence_id: a.occurrenceId, p_program_item_id: a.itemId, p_added_session_id: a.addedId, p_name: a.name, p_forward: a.forward,
  })) as InviteLink;
}
export async function resendClassInvite(inviteId: string): Promise<InviteLink> {
  return must(await rpc('organiser_class_invite_resend_v1', { p_invite_id: inviteId })) as InviteLink;
}
export async function revokeClassInvite(inviteId: string): Promise<void> {
  must(await rpc('organiser_class_invite_revoke_v1', { p_invite_id: inviteId }));
}

/** Open and expired invites for this class only; claimed ones are hidden. */
export function invitesForClass(list: ClassInvite[], c: { itemId: string | null; addedId: string | null }): ClassInvite[] {
  return list.filter((i) => (i.status === 'open' || i.status === 'expired')
    && ((c.itemId !== null && i.program_item_id === c.itemId) || (c.addedId !== null && i.added_session_id === c.addedId)));
}

export const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? '';
export const joinLink = (token: string) => `${window.location.origin}/join/class/${token}`;

export function inviteMessage(i: { name: string; classTitle: string; eventName: string; dateLabel: string; link: string }): string {
  return `Hi ${firstName(i.name)}, you're teaching ${i.classTitle} at ${i.eventName} on ${i.dateLabel}. Tap this link to join Bachata Calendar and you'll show on the class: ${i.link}`;
}
/** One row of organiser_unclaimed_teachers_v1 (admin#2441): a saved teacher whose profile nobody has claimed yet. */
export interface UnclaimedTeacher { profile_id: string; link_sent_at: string | null }
export interface TeacherClaimLink { link_id: string; token: string; expires_at: string | null; display_name: string }
export const unclaimedKey = (occurrenceId: string, ids: string[]) => ['unclaimed-teachers', occurrenceId, ...[...ids].sort()] as const;
export async function fetchUnclaimedTeachers(occurrenceId: string, profileIds: string[]): Promise<UnclaimedTeacher[]> {
  if (profileIds.length === 0) return [];
  const d = must(await rpc('organiser_unclaimed_teachers_v1', { p_occurrence_id: occurrenceId, p_profile_ids: profileIds }));
  return Array.isArray(d) ? (d as UnclaimedTeacher[]) : [];
}
export async function createTeacherClaimLink(occurrenceId: string, profileId: string): Promise<TeacherClaimLink> {
  return must(await rpc('organiser_teacher_claim_link_v1', { p_occurrence_id: occurrenceId, p_profile_id: profileId })) as TeacherClaimLink;
}
export const claimLink = (token: string) => `${window.location.origin}/claim/teacher/${token}`;
export function claimMessage(i: { name: string; classTitle: string; eventName: string; dateLabel: string; link: string }): string {
  return `Hi ${firstName(i.name)}, you're teaching ${i.classTitle} at ${i.eventName} on ${i.dateLabel}. Tap to claim your teacher profile on Bachata Calendar: ${i.link}`;
}
export const errorLine = (e: unknown) => (/20|cap|too many/i.test(e instanceof Error ? e.message : '') ? CAP_COPY : FAIL_COPY);

export interface ClassInvitesProps {
  occurrenceId: string; itemId: string | null; addedId: string | null;
  classTitle: string; eventName: string; dateLabel: string; canForward: boolean;
  /** From the picker's invite row: opens the invite sheet with this name filled (n changes on every tap). */
  prefill?: { name: string; n: number } | null;
}

const ROW = { minHeight: 44, display: 'inline-flex', alignItems: 'center' } as const;

/** "Send this to X": the message to copy or send on WhatsApp. Shared by the class screen and Home's waiting list. */
export function InviteReadySheet({ ready, onClose }: { ready: { name: string; message: string }; onClose: () => void }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => { try { await navigator.clipboard.writeText(ready.message); setCopied(true); } catch { setCopied(false); } };
  const close = () => { setCopied(false); onClose(); };
  return (
    <V2Sheet open title={`Send this to ${firstName(ready.name)}`} onClose={close}>
      <textarea readOnly rows={7} className="fld" value={ready.message} aria-label="Invite message" data-testid="class-invite-message" onFocus={(e) => e.currentTarget.select()} />
      <button type="button" className="btn sec" style={{ minHeight: 48 }} onClick={() => void copy()}>{copied ? 'Copied' : 'Copy'}</button>
      <a className="btn sec" style={{ minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }} href={shareHref(ready.message)} target="_blank" rel="noopener noreferrer" data-testid="class-invite-whatsapp">WhatsApp</a>
      <button type="button" className="btn pri" style={{ minHeight: 48 }} data-testid="class-invite-done" onClick={close}>Done</button>
    </V2Sheet>
  );
}

/** Under a class's Teachers group: pending invites and "Invite a teacher who isn't on the site". */
export function ClassInvites(p: ClassInvitesProps) {
  const qc = useQueryClient();
  const q = useQuery({ queryKey: classInvitesKey(p.occurrenceId), queryFn: () => listClassInvites(p.occurrenceId) });
  const [asking, setAsking] = useState(false);
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState<{ name: string; message: string } | null>(null);
  useEffect(() => {
    if (!p.prefill) return;
    setName(p.prefill.name.slice(0, MAX_NAME)); setError(null); setAsking(true);
  }, [p.prefill]);
  const refresh = () => qc.invalidateQueries({ queryKey: classInvitesKey(p.occurrenceId) });
  const show = (n: string, l: InviteLink) => setReady({ name: n, message: inviteMessage({ name: n, classTitle: p.classTitle, eventName: p.eventName, dateLabel: p.dateLabel, link: joinLink(l.token) }) });

  const create = useMutation({
    mutationFn: (forward: boolean) => createClassInvite({ occurrenceId: p.occurrenceId, itemId: p.itemId, addedId: p.itemId ? null : p.addedId, name: name.trim(), forward }),
    onSuccess: (l) => { const n = name.trim(); setAsking(false); setName(''); setError(null); show(n, l); void refresh(); },
    onError: (e) => setError(errorLine(e)),
  });
  const resend = useMutation({
    mutationFn: (i: ClassInvite) => resendClassInvite(i.invite_id).then((l) => ({ i, l })),
    onSuccess: ({ i, l }) => { setError(null); show(i.display_name, l); void refresh(); },
    onError: (e) => setError(errorLine(e)),
  });
  const revoke = useMutation({
    mutationFn: (i: ClassInvite) => revokeClassInvite(i.invite_id),
    onSuccess: () => { setError(null); void refresh(); },
    onError: (e) => setError(errorLine(e)),
  });

  const pending = invitesForClass(q.data ?? [], p);
  const trimmed = name.trim();

  return (
    <div className="grp" data-testid="class-invites">
      {pending.map((i) => (
        <div key={i.invite_id} data-testid="class-invite-chip" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Avatar id={i.invite_id} name={i.display_name} url={null} size={36} />
          <span style={{ flex: 1, minWidth: 0 }}>
            <b>{i.display_name}</b>
            <span className="hint" style={{ display: 'block', margin: 0 }}>{i.status === 'expired' ? 'Link expired' : 'Invited, not joined yet'}</span>
          </span>
          <button type="button" className="btn sec" style={{ ...ROW, width: 'auto', padding: '0 12px' }} disabled={resend.isPending} onClick={() => resend.mutate(i)}>Resend</button>
          <button type="button" className="btn sec" style={{ ...ROW, width: 'auto', padding: '0 12px' }} disabled={revoke.isPending} onClick={() => revoke.mutate(i)}>Remove</button>
        </div>
      ))}
      {error && !asking && <p className="err" role="alert" data-testid="class-invite-error">{error}</p>}
      <button type="button" className="btn sec" style={{ minHeight: 48, width: '100%' }} onClick={() => { setError(null); setAsking(true); }}>+ Invite a teacher who isn&rsquo;t on the site</button>
      {asking && (
        <V2Sheet open title="Invite a teacher" onClose={() => { setAsking(false); setError(null); }}>
          <label className="flab" htmlFor="ci-name">Their name</label>
          {/* eslint-disable-next-line jsx-a11y/no-autofocus */}
          <input id="ci-name" className="fld" type="text" autoFocus required maxLength={MAX_NAME} value={name} onChange={(e) => setName(e.target.value)} />
          {error && <p className="err" role="alert" data-testid="class-invite-error">{error}</p>}
          {p.canForward ? (
            <>
              <button type="button" className="btn pri" style={{ minHeight: 48 }} disabled={!trimmed || create.isPending} onClick={() => create.mutate(true)}>{create.isPending ? 'Making the link...' : 'This date and all later dates'}</button>
              <button type="button" className="btn sec" style={{ minHeight: 48 }} disabled={!trimmed || create.isPending} onClick={() => create.mutate(false)}>Just this date</button>
            </>
          ) : (
            <button type="button" className="btn pri" style={{ minHeight: 48 }} disabled={!trimmed || create.isPending} onClick={() => create.mutate(false)}>{create.isPending ? 'Making the link...' : 'Invite on WhatsApp'}</button>
          )}
        </V2Sheet>
      )}
      {ready && <InviteReadySheet ready={ready} onClose={() => setReady(null)} />}
    </div>
  );
}
