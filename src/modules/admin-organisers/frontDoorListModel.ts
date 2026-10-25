import type { Chip, FrontDoorRow, NeedsReason, SendResult, RunByUsResult } from './frontDoorApi';

/** One mapping for the front-door organisers list: chip + invite state -> words and controls. */

export const CHIP_LABEL: Record<Chip, string> = {
  run_by_us: 'Run by us',
  invited: 'Invited',
  joined: 'Joined',
  live: 'Live',
};

export const CHIP_HELP: Record<Chip, string> = {
  run_by_us: 'We run the page; no invite is needed.',
  invited: 'Waiting for the organiser to join.',
  joined: 'The organiser has joined and has no live events yet.',
  live: 'The organiser has joined and has live events.',
};

export interface SendControl {
  show: boolean;
  disabledReason: string | null;
  label: string;
}

export function sendControl(row: FrontDoorRow): SendControl {
  if (row.chip === 'joined' || row.chip === 'live') {
    return { show: true, label: 'Send invite', disabledReason: 'Already joined, so there is nothing to send.' };
  }
  if (row.chip === 'run_by_us' && row.inviteStatus === 'none') {
    return { show: true, label: 'Send invite', disabledReason: 'Run by us. Switch Run by us off first to prepare an invite.' };
  }
  switch (row.inviteStatus) {
    case 'none':
      // Only a row that is NOT run by us gets here, so its switch is already off.
      return { show: true, label: 'Send invite', disabledReason: 'No invite is prepared. Switch Run by us on, then off again, to prepare one; it needs their email.' };
    case 'sent':
      return { show: true, label: 'Invite sent', disabledReason: 'The invite has already been sent.' };
    case 'skipped':
      return {
        show: true, label: 'Send invite',
        disabledReason: `The invite was skipped because the page changed. Switch Run by us ${row.chip === 'run_by_us' ? 'off and on' : 'on, then off'} again, or add a new organiser.`,
      };
    case 'failed':
      return { show: true, label: 'Send invite again', disabledReason: null };
    case 'queued':
      return row.inviteRequested
        ? { show: true, label: 'Send again', disabledReason: null }
        : { show: true, label: 'Send invite', disabledReason: null };
  }
}

export function inviteStateText(row: FrontDoorRow): string | null {
  if (row.chip === 'joined' || row.chip === 'live') return null;
  switch (row.inviteStatus) {
    case 'queued': return row.inviteRequested ? 'Invite will go out.' : 'Invite ready, not sent.';
    case 'sent': return 'Invite sent.';
    case 'failed': return 'The last send failed. You can send it again.';
    case 'skipped': return 'Invite skipped.';
    default: return null;
  }
}

export const SEND_ERROR_TEXT: Record<string, string> = {
  NO_INVITE: 'There is no invite for this organiser yet. Switch Run by us off to prepare one.',
  ALREADY_JOINED: 'This organiser has already joined, so no invite is needed.',
  PERMISSION_DENIED: 'Only admins can send invites. Sign in with an admin account.',
};
export const NETWORK_ERROR_TEXT = 'That did not go through. Check your connection, then try again.';

export function sendMessage(r: SendResult): { ok: boolean; text: string } {
  if (r.kind === 'ok') {
    if (r.alreadySent) return { ok: true, text: 'This invite was already sent.' };
    if (r.retried) return { ok: true, text: 'Invite will go out. The earlier attempt did not finish, so it was queued again.' };
    if (r.alreadyRequested) return { ok: true, text: 'Invite will go out. You already tapped Send for this one.' };
    return { ok: true, text: 'Invite will go out.' };
  }
  return { ok: false, text: SEND_ERROR_TEXT[r.code] ?? NETWORK_ERROR_TEXT };
}

export const RUN_BY_US_ERROR_TEXT: Record<string, string> = {
  PERMISSION_DENIED: 'Only admins can change this. Sign in with an admin account.',
  ORGANISER_NOT_FOUND: 'This organiser no longer exists. Refresh the list.',
  INVALID_PAYLOAD: NETWORK_ERROR_TEXT,
};

export function runByUsMessage(r: RunByUsResult): { ok: boolean; text: string } {
  if (r.kind === 'error') return { ok: false, text: RUN_BY_US_ERROR_TEXT[r.code] ?? NETWORK_ERROR_TEXT };
  return {
    ok: true,
    text: r.runByUs ? 'Now run by us.' : 'No longer run by us. An invite is ready if they have an email; nothing is sent until you tap Send invite.',
  };
}

/** The toggle is off for pages that joined: the organiser runs it. */
export function runByUsControl(row: FrontDoorRow): { on: boolean; disabledReason: string | null } {
  const joined = row.chip === 'joined' || row.chip === 'live';
  return { on: row.chip === 'run_by_us', disabledReason: joined ? 'The organiser has joined and runs this page.' : null };
}

export function chipCounts(rows: readonly FrontDoorRow[]): Record<Chip, number> {
  const c: Record<Chip, number> = { run_by_us: 0, invited: 0, joined: 0, live: 0 };
  for (const r of rows) c[r.chip] += 1;
  return c;
}

export const filterRows = (rows: readonly FrontDoorRow[], chip: Chip | 'all') =>
  chip === 'all' ? [...rows] : rows.filter((r) => r.chip === chip);

export const LIST_EMPTY = {
  all: 'No organisers yet. Add one and it will show here.',
  filtered: 'No organisers in this group. Pick another group, or add an organiser.',
};
export const LIST_LOAD_ERROR = 'The list did not load. Check your connection, then try again.';

// kept here so the Needs you model and this one share the entry-point wording
export type { NeedsReason };
