import { ownPublicName, NO_NAME_YET } from '../../api/publicName';
import type { MyDancerEdit } from '../../api/types';
import { HIDDEN_STATE_LINE, SHOW_AGAIN_LABEL, ACCOUNT_SETTINGS_LABEL } from '../../copy/sharedCopy';
import { shareUrlFor } from '../options/optionsModel';

/**
 * What /app/page decides, as plain data (the screen only renders it; the table test reads
 * the same model). "Public" mirrors the server: a paused profile has no public page, and
 * one that is not complete yet (name, city, role, photo) is not ready to show.
 */
export type PageModel = {
  /** Plain-words description of how the public page looks right now. */
  lookLines: string[];
  /** The page address, or null when there is no page to open. */
  url: string | null;
  /** Present exactly when "View my page" and Share are disabled. */
  disabledReason: string | null;
  /** Pointer to the fix, shown under the reason; only names controls that are on this screen. */
  fixHint: 'edit' | 'account-settings' | null;
};

export const NOT_READY_REASON = 'Your page is not public yet. Finish your name, city, dance role and photo first.';
export const PAUSED_REASON = `${HIDDEN_STATE_LINE} Show it again in ${ACCOUNT_SETTINGS_LABEL} (${SHOW_AGAIN_LABEL}).`;

// Stored dance_role -> verb phrase ("It says you follow"); an unknown value says nothing.
const ROLE_PHRASE: Record<string, string> = { Leader: 'you lead', Follower: 'you follow', 'Lead and Follow': 'you lead and follow' };

export const pageModel = (p: MyDancerEdit): PageModel => {
  const name = ownPublicName(p);
  const lines: string[] = [];
  lines.push(name === NO_NAME_YET ? 'It has no name yet, so people cannot find it by name.' : `It shows your name: ${name}.`);
  lines.push(p.avatar_url ? 'It shows your photo.' : 'It has no photo yet. Add one so people recognise you.');
  lines.push(p.city_name || p.dance_role ? `It says ${[p.dance_role ? ROLE_PHRASE[p.dance_role] ?? null : null, p.city_name ? `you dance in ${p.city_name}` : null].filter(Boolean).join(' and ')}.` : 'It does not say your city or dance role yet.');
  lines.push(p.bio ? 'It shows your bio.' : 'It has no bio yet.');
  const url = p.is_active && p.complete ? shareUrlFor(p.profile_id) : null;
  if (!p.is_active) return { lookLines: lines, url: null, disabledReason: PAUSED_REASON, fixHint: 'account-settings' };
  if (!p.complete) return { lookLines: lines, url: null, disabledReason: NOT_READY_REASON, fixHint: 'edit' };
  return { lookLines: lines, url, disabledReason: null, fixHint: null };
};
