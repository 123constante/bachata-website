import { useState, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ChevronRight, CircleHelp, FileText, LogOut, Mail, MessageCircle, Plus, Settings, Shield, UserRoundCog } from 'lucide-react';
import { ORGANISER_HOME_KEY, removeOrganiserMember } from '@/modules/organiser/shared/selfServeApi';
import { teamErrorMessage } from '@/modules/organiser/shared/selfServeErrors';
import { supportLinks } from '@/modules/organiser/shared/support';
import { goDone } from '../flows/doneState';
import { useOwnPage } from '../page/useOwnPage';
import { OrganiserShell } from '../shell';
import { ORG_PATHS } from '../shell/paths';
import { Card, ErrorState, GhostButton, PrimaryButton, SheetView, SkeletonRows } from '../ui';
import { SignOutSheet } from './SignOutSheet';

/** The owner's reason for no Leave: the sole-owner refusal (4.8), pointing at the control that exists. */
export const HAND_OVER_FIRST = 'Hand over first';

const ROW = 'flex min-h-[52px] w-full items-center gap-[12px] px-[16px] py-[14px] text-left text-[15px] text-[var(--fg)]';
const ICON = 'h-[16px] w-[16px] shrink-0 text-[var(--mut)]';

function LinkRow({ to, icon, label, testId, external }: { to: string; icon: ReactNode; label: string; testId: string; external?: boolean }) {
  const inner = (
    <>
      {icon}
      <span className="flex-1">{label}</span>
      <ChevronRight aria-hidden="true" className="h-[18px] w-[18px] shrink-0 text-[var(--mut)]" />
    </>
  );
  return external ? (
    <a href={to} className={ROW} data-testid={testId} {...(to.startsWith('http') ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>{inner}</a>
  ) : (
    <Link to={to} className={ROW} data-testid={testId}>{inner}</Link>
  );
}

/**
 * /account/o/more (C29). The two contact switches (the existing ContactSheet
 * wiring, through the edit layer's Contact card), Add a page, Hand over (owner
 * only), Leave this page, support, Help, account links and Sign out. Every row
 * names a control that exists; a control that cannot work says why.
 */
export default function MorePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user, home, selected, bridge, layer } = useOwnPage();
  const [confirmLeave, setConfirmLeave] = useState(false);
  const [signOut, setSignOut] = useState(false);
  const support = supportLinks();
  const isOwner = selected?.role === 'owner';

  const leave = useMutation({
    mutationFn: () => removeOrganiserMember(selected!.id, user!.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ORGANISER_HOME_KEY });
      setConfirmLeave(false);
      goDone(navigate, { title: 'Leave this page', message: `You left ${selected!.name}`, seriesId: null });
    },
  });

  if (home.isPending) {
    return <OrganiserShell title="More" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-page-more"><SkeletonRows count={4} label="Loading" testId="more-loading" /></OrganiserShell>;
  }
  if (home.isError && !home.data) {
    return <OrganiserShell title="More" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-page-more"><ErrorState title="This did not load" onRetry={() => void home.refetch()} retrying={home.isFetching} testId="more-load-error" /></OrganiserShell>;
  }

  return (
    <OrganiserShell title="More" back={{ to: ORG_PATHS.home, label: 'Home' }} testId="org-page-more">
      <div className="space-y-[12px]">
        {selected && bridge && <div className="overflow-hidden rounded-[12px] bg-[#0C0A0D]" data-testid="more-contact">{bridge.slot('contact')}</div>}

        <Card testId="more-page-rows">
          <LinkRow to={`${ORG_PATHS.home}?add=1`} icon={<Plus aria-hidden="true" className={ICON} />} label="Add a page" testId="more-add-page" />
          {selected && isOwner && (
            <LinkRow to={ORG_PATHS.handover} icon={<UserRoundCog aria-hidden="true" className={ICON} />} label="Hand over" testId="more-hand-over" />
          )}
          {selected && (
            <div>
              <button
                type="button"
                className={`${ROW} ${isOwner ? 'cursor-not-allowed opacity-60' : ''}`}
                aria-disabled={isOwner ? true : undefined}
                aria-describedby={isOwner ? 'more-leave-reason' : undefined}
                onClick={() => { if (!isOwner) setConfirmLeave(true); }}
                data-testid="more-leave"
              >
                <LogOut aria-hidden="true" className={ICON} />
                <span className="flex-1">Leave this page</span>
              </button>
              {isOwner && <p id="more-leave-reason" className="px-[16px] pb-[12px] text-[13px] text-[var(--mut)]" data-testid="more-leave-reason">{HAND_OVER_FIRST}</p>}
            </div>
          )}
        </Card>

        <Card testId="more-help-rows">
          {support.whatsapp && <LinkRow to={support.whatsapp} external icon={<MessageCircle aria-hidden="true" className={ICON} />} label="WhatsApp us" testId="more-support-whatsapp" />}
          {support.email && <LinkRow to={`mailto:${support.email}`} external icon={<Mail aria-hidden="true" className={ICON} />} label="Email us" testId="more-support-email" />}
          <LinkRow to={ORG_PATHS.help} icon={<CircleHelp aria-hidden="true" className={ICON} />} label="Help" testId="more-help" />
        </Card>

        <Card testId="more-account-rows">
          <LinkRow to="/account/settings" icon={<Settings aria-hidden="true" className={ICON} />} label="Account settings" testId="more-account-settings" />
          <LinkRow to="/privacy" icon={<Shield aria-hidden="true" className={ICON} />} label="Privacy" testId="more-privacy" />
          <LinkRow to="/terms" icon={<FileText aria-hidden="true" className={ICON} />} label="Terms" testId="more-terms" />
          <button type="button" className={ROW} onClick={() => setSignOut(true)} data-testid="more-signout">
            <LogOut aria-hidden="true" className={ICON} />
            <span className="flex-1">Sign out</span>
          </button>
        </Card>
      </div>

      <SheetView open={confirmLeave} onOpenChange={(o) => { if (!o) setConfirmLeave(false); }} title="Leave this page" testId="more-leave-sheet">
        <div className="space-y-[12px] p-[16px]">
          <p className="text-[15px] text-[var(--fg)]">Leave {selected?.name}? You can ask to join again later.</p>
          {leave.isError && <p role="alert" className="text-[14px] text-[var(--danger)]" data-testid="more-leave-error">{teamErrorMessage(leave.error)}</p>}
          <GhostButton onClick={() => setConfirmLeave(false)} disabled={leave.isPending} testId="more-leave-no">No, stay</GhostButton>
          <PrimaryButton onClick={() => leave.mutate()} loading={leave.isPending} loadingLabel="Leaving" testId="more-leave-yes">Yes, leave</PrimaryButton>
        </div>
      </SheetView>
      <SignOutSheet open={signOut} onClose={() => setSignOut(false)} />
      {layer}
    </OrganiserShell>
  );
}
