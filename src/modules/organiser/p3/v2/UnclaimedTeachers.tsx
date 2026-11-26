import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { claimLink, claimMessage, createTeacherClaimLink, FAIL_COPY, fetchUnclaimedTeachers, InviteReadySheet, unclaimedKey } from './ClassInvites';

export interface UnclaimedTeachersProps {
  occurrenceId: string;
  /** Teaching chips that were already saved when the sheet opened. */
  people: { id: string; name: string }[];
  classTitle: string; eventName: string; dateLabel: string;
}

const BTN = { minHeight: 44, display: 'inline-flex', alignItems: 'center', width: 'auto', padding: '0 12px' } as const;

/** Under the teacher chips: "<Name> hasn't claimed their profile yet" + a claim link to send on WhatsApp. */
export function UnclaimedTeachers(p: UnclaimedTeachersProps) {
  const qc = useQueryClient();
  const ids = p.people.map((x) => x.id);
  const key = unclaimedKey(p.occurrenceId, ids);
  const q = useQuery({ queryKey: key, queryFn: () => fetchUnclaimedTeachers(p.occurrenceId, ids), enabled: ids.length > 0 });
  const [ready, setReady] = useState<{ name: string; message: string } | null>(null);
  const [error, setError] = useState<{ id: string } | null>(null);
  const make = useMutation({
    mutationFn: (x: { id: string; name: string }) => createTeacherClaimLink(p.occurrenceId, x.id).then((l) => ({ x, l })),
    onSuccess: ({ x, l }) => {
      setError(null);
      setReady({ name: x.name, message: claimMessage({ name: x.name, classTitle: p.classTitle, eventName: p.eventName, dateLabel: p.dateLabel, link: claimLink(l.token) }) });
      void qc.invalidateQueries({ queryKey: key });
    },
    onError: (_e, x) => setError({ id: x.id }),
  });
  if (q.isError || !q.data || q.data.length === 0) return null;
  const sent = new Map(q.data.map((r) => [r.profile_id, r.link_sent_at]));
  const rows = p.people.filter((x) => sent.has(x.id));
  if (rows.length === 0) return null;
  return (
    <div data-testid="unclaimed-teachers">
      {rows.map((x) => (
        <div key={x.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <span className="hint" style={{ flex: 1, minWidth: 0, margin: 0 }}>{x.name} hasn&rsquo;t claimed their profile yet</span>
            <button type="button" className="btn sec" style={BTN} disabled={make.isPending} onClick={() => make.mutate(x)}>
              {sent.get(x.id) ? 'Send again' : 'Invite on WhatsApp'}
            </button>
          </div>
          {error?.id === x.id && <p className="r4-err" role="alert">{FAIL_COPY}</p>}
        </div>
      ))}
      {ready && <InviteReadySheet ready={ready} onClose={() => setReady(null)} />}
    </div>
  );
}
