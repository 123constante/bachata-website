import type { AddField, AddResult } from './frontDoorApi';

/** One mapping for the Add organiser screen: state -> words and controls. No JSX here. */

export const RUN_BY_US_WHY =
  'We run this page for them, so no invite is prepared and no email is kept. Switch off to add their email and prepare an invite.';
export const RUN_BY_US_OFF_WHY =
  'Add their email to prepare an invite; nothing is sent until you tap Send invite on the list. Without an email no invite is prepared.';
/** The hint under the Run by us switch always describes the state the switch is in now. */
export const runByUsHint = (on: boolean) => (on ? RUN_BY_US_WHY : RUN_BY_US_OFF_WHY);
export const RUN_BY_US_LABEL = 'Run by us (no email)';

export interface AddForm {
  organiserName: string;
  contactName: string;
  contactEmail: string;
  cityId: string;
  runByUs: boolean;
}
export const EMPTY_FORM: AddForm = { organiserName: '', contactName: '', contactEmail: '', cityId: '', runByUs: false };

/** An untouched form sends nothing: submit is allowed only once a required field has a value. */
export const formTouched = (f: AddForm) =>
  !!(f.organiserName.trim() || f.contactName.trim() || f.contactEmail.trim() || f.cityId);

export function submitBlockedReason(f: AddForm): string | null {
  if (!formTouched(f)) return 'Fill in the organiser name, a contact person and a city to add one.';
  if (!f.organiserName.trim()) return 'Add the organiser name to continue.';
  if (!f.contactName.trim()) return 'Add the contact person to continue.';
  if (!f.cityId) return 'Pick a city to continue.';
  return null;
}

export const ADD_ERROR_TEXT: Record<string, { field: AddField; text: string }> = {
  ORGANISER_NAME_REQUIRED: { field: 'organiser_name', text: 'Add the organiser name.' },
  CONTACT_NAME_REQUIRED: { field: 'contact_name', text: 'Add the name of the contact person.' },
  EMAIL_INVALID: { field: 'contact_email', text: 'That email does not look right. Check it, or switch on Run by us to add none.' },
  CITY_REQUIRED: { field: 'city_id', text: 'Pick a city from the list.' },
  PERMISSION_DENIED: { field: null, text: 'Only admins can add an organiser. Sign in with an admin account.' },
  INVALID_PAYLOAD: { field: null, text: 'Something in the form was not understood. Check each box and try again.' },
};
export const ADD_ERROR_FALLBACK = 'The organiser was not added. Check your connection, then try again.';

export function errorFor(code: string, serverField: AddField) {
  const known = ADD_ERROR_TEXT[code];
  return known ?? { field: serverField, text: ADD_ERROR_FALLBACK };
}

export interface AddOutcome {
  tone: 'success' | 'info';
  title: string;
  lines: string[];
  /** The organiser to link to, when one exists. */
  organiserId: string | null;
}

export function outcomeFor(r: Exclude<AddResult, { kind: 'error' }>): AddOutcome {
  if (r.kind === 'already_exists') {
    return {
      tone: 'info',
      title: 'This organiser is already added',
      lines: ['Nothing was changed. You can open the existing page below.'],
      organiserId: r.organiserId,
    };
  }
  const lines: string[] = [];
  if (r.inviteQueued) lines.push('Page is live. An invite is ready; nothing is sent until you tap Send invite.');
  else if (r.runByUs) lines.push('Page is live and run by us. No invite was prepared.');
  else lines.push('Page is live.');
  if (r.personReused) lines.push('An existing person with this email was used as the contact, so no duplicate was made.');
  if (r.warnings.includes('email_has_login')) lines.push('This email already has a login; it will be linked the next time they sign in.');
  return { tone: 'success', title: 'Organiser added', lines, organiserId: r.organiserId };
}

/** Where the invite is sent from: the Send button lives on the organisers list. */
export const SEND_HINT = 'Open the organisers list and tap Send invite on this organiser when you are ready.';
