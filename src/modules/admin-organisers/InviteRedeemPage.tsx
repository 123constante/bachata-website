import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { useNoindexMeta } from '@/hooks/useNoindexMeta';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { TOKEN_RE } from './inviteModel';
import JoinPage, { type PreviewState } from './join/JoinPage';
import { fetchJoinPreview, joinPreviewQueryKey } from './join/joinApi';

/**
 * /invite/:token -- the organiser-invite landing, Option B "never leave the invite page" (PLAN.md
 * section 4, W1). This file only looks the link up (organiser_invite_preview_v1, anon-safe, masked
 * hint) and hands the answer to join/JoinPage, which derives the step from server truth. No
 * DancerProfileGate here: the dancer questions are asked inline, and the gate never redirects /invite.
 */
export default function InviteRedeemPage() {
  useNoindexMeta(true);
  // Never leak the token in a Referer header to anything this page links or loads (also while the preview loads).
  useEffect(() => {
    const meta = document.createElement('meta');
    meta.name = 'referrer';
    meta.content = 'no-referrer';
    document.head.appendChild(meta);
    return () => { meta.remove(); };
  }, []);
  const { token = '' } = useParams<{ token: string }>();
  const valid = TOKEN_RE.test(token);
  const preview = useQuery({ queryKey: joinPreviewQueryKey(token), queryFn: () => fetchJoinPreview(token), enabled: valid, retry: false, staleTime: 60_000 });
  // A malformed token can never work: the server is not asked, and the page says so for everyone.
  const state: PreviewState = !valid ? null : preview.isPending ? 'loading' : preview.isError ? 'failed' : (preview.data ?? null);
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('invite.redeem')}>
      <JoinPage token={token} preview={state} refetchPreview={() => preview.refetch()} />
    </GlobalLayout>
  );
}
