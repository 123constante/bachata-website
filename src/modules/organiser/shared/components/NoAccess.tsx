import { ErrorState } from '@/modules/organiser/ui';

/**
 * admin_event_workspace_p5 refused this login (not an owner or manager of the
 * event's page: a removed member, a forwarded link). A retry cannot help and
 * "check your connection" would mislead, so this has NO retry button.
 * The one copy every screen that reads the event workspace shows; each screen
 * branches on selfServeErrors.isAccessRefusal (the one detector).
 */
export const NO_ACCESS_TITLE = 'You do not have access to this event';
export const NO_ACCESS_BODY = 'Only the owners and managers of this page can edit it. Ask one of them to add you to the team.';
export const NO_ACCESS_TESTID = 'org-no-access';

export function NoAccess() {
  return <ErrorState title={NO_ACCESS_TITLE} body={NO_ACCESS_BODY} testId={NO_ACCESS_TESTID} />;
}
