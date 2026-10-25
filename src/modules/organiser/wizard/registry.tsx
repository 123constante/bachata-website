// The wizard's step components keyed by `area:field` (the server's keys). A
// server step whose key is not here is skipped (the fields no self-serve writer
// takes: dancer gallery / partner_search, organiser contact_email / address /
// maps_link / gallery). Teacher and DJ steps are B-WEB1's own components
// (areas/teacher|dj/wizardSteps), plugged in as they are (C15).
//
// Writers: a dancer answer goes to save_my_dancer_profile_v2 with its ONE key
// (toPatch). An organiser answer is a draft of the SAME edit-in-place field keys
// My page uses, so it goes through draftModel's ONE save (saveDrafts), never a
// second mapping. A teacher / DJ answer goes through B-WEB1's submitRoleWizardStep
// (save_my_role_v1 with its ONE key, or set_my_role_declined_v1 for "Do you...?").
import { Link } from 'react-router-dom';
import { searchCities } from '@/modules/organiser/home/onboarding/citySearch';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { WizardStepDef } from '@/modules/areas/wizardStep';
import { doYouDjStep, djWizardSteps } from '@/modules/areas/dj/wizardSteps';
import { doYouTeachStep, teacherWizardSteps } from '@/modules/areas/teacher/wizardSteps';
import { DECLINED_FIELD } from '@/modules/areas/shared/roleWizard';
import type { Details } from '@/modules/areas/shared/roleModel';
import { storedInPatchTerms, type EditBase } from '../edit-in-place/draftModel';
import { CATEGORY_OPTIONS, FIELD_LABEL, checkField, type FieldKey } from '../edit-in-place/fieldRules';
import { PHOTO_ACCEPT } from '../edit-in-place/organiserPhotoModel';
import { countryNameFor, matchCountries, wizardCountries } from './wizardCountries';
import { DANCE_ROLE_VALUES, type WizardDancer } from './dancerApi';
import { makeInstagramStep, makePhoneStep } from './contactSteps';
import { makeChoiceStep, makeElsewhereStep, makeListStep, makePickStep, makeTextStep, makeUploadStep, textOf, type PickResult } from './stepKinds';

export interface WizardSources {
  dancer: WizardDancer | null;
  /** The organiser's stored row plus its private contact (null until loaded). */
  organiser: EditBase | null;
  /** Teacher / DJ details as my_role_details_v1 holds them (absent until loaded). */
  roleDetails?: Partial<Record<'teacher' | 'dj', Details | null>>;
  /** The roles the person said No to (my_profile_progress_v1 `declined`). */
  declined?: readonly string[];
}

export interface WizardEntry extends WizardStepDef {
  /** The stored answer this step starts from. */
  read(src: WizardSources): unknown;
  /** Organiser steps: the edit-in-place field the answer is a draft of. */
  organiserField?: FieldKey;
}

const DANCER_PHOTO_PATH = '/app/me/photo';

const nowYear = () => new Date().getFullYear();

function checkYear(raw: string): string | null {
  const t = raw.trim();
  const y = Number(t);
  if (!/^\d{4}$/.test(t) || y < 1950 || y > nowYear()) return `Enter a year from 1950 to ${nowYear()}.`;
  return null;
}

async function searchCountries(q: string): Promise<PickResult[]> {
  return matchCountries(await wizardCountries(), q).slice(0, 12).map((c) => ({ id: c.code, label: c.name }));
}

/**
 * W2 walk fix 6: show_phone_publicly defaults TRUE (guard-pinned), so the number
 * shows unless the organiser hides it; the help says so, and where to hide it.
 */
export const ORG_PHONE_HELP = (
  <>It shows on your page so dancers can reach you. You can hide it in <Link to={ORG_PATHS.page} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--gold)] underline underline-offset-4">My page</Link>.</>
);

const countryName = (v: unknown): string | null => {
  if (typeof v !== 'string' || !v) return null;
  return countryNameFor(v);
};

function dancer(field: string, title: string, saveKey: string, Component: WizardStepDef['Component'], extra: Partial<WizardEntry> = {}): WizardEntry {
  return {
    area: 'dancer',
    field,
    title,
    Component,
    labelIsQuestion: true,
    toPatch: (value) => ({ [saveKey]: value }),
    read: (src) => (src.dancer ? src.dancer[saveKey] ?? null : null),
    ...extra,
  };
}

function organiser(field: string, title: string, key: FieldKey, Component: WizardStepDef['Component'], extra: Partial<WizardEntry> = {}): WizardEntry {
  return {
    area: 'organiser',
    field,
    title,
    Component,
    labelIsQuestion: true,
    organiserField: key,
    toPatch: (value) => ({ [key]: textOf(value).trim() }),
    read: (src) => (src.organiser ? storedInPatchTerms(src.organiser, key) ?? null : null),
    ...extra,
  };
}

/** Our own check for an organiser field: the same rule My page's sheet runs. */
const orgCheck = (key: FieldKey) => (raw: string) => {
  const r = checkField(key, raw);
  return r.ok ? null : r.error;
};
const orgText = (key: FieldKey) => (raw: string) => raw.trim();

/** A B-WEB1 step as it is. "Do you...?" reads No once declined, else unanswered; a field reads the stored value. */
function roleEntry(def: WizardStepDef): WizardEntry {
  const role = def.area as 'teacher' | 'dj';
  return {
    ...def,
    read: (src) => (def.field === DECLINED_FIELD
      ? (src.declined?.includes(role) ? false : null)
      : src.roleDetails?.[role]?.[def.field] ?? null),
  };
}

const ROLE_OPTIONS = DANCE_ROLE_VALUES.map((r) => ({ value: r, label: r }));
const CATEGORY = CATEGORY_OPTIONS.map((c) => ({ value: c, label: c }));

const ENTRIES: WizardEntry[] = [
  // ---- dancer -------------------------------------------------------------------------------
  dancer('first_name', 'What is your first name?', 'first_name', makeTextStep('first_name', { label: 'First name', autoComplete: 'given-name', maxLength: 60 })),
  dancer('city', 'Which city do you dance in?', 'based_city_id', makePickStep('city', { label: 'City', placeholder: 'Search for your city', search: searchCities }), { advanceOnAnswer: true }),
  dancer('dance_role', 'Do you lead or follow?', 'dance_role', makeChoiceStep('dance_role', { label: 'Dance role', options: ROLE_OPTIONS }), { advanceOnAnswer: true }),
  dancer('photo', 'Add a photo of you', 'avatar_url', makeElsewhereStep('photo', {
    label: 'Photo',
    cta: 'Add a photo',
    help: 'You crop it on the next screen, then come back here.',
    to: (returnTo) => `${DANCER_PHOTO_PATH}?return=${encodeURIComponent(returnTo)}`,
  })),
  dancer('nationality', 'What is your nationality?', 'nationality', makePickStep('nationality', { label: 'Nationality', placeholder: 'Search for a country', help: 'Type your country or nationality, for example United Kingdom or British, then tap the right one.', search: searchCountries, currentLabel: countryName }), { advanceOnAnswer: true }),
  dancer('languages', 'Which languages do you speak?', 'languages', makeListStep('languages', { label: 'Languages', placeholder: 'English' })),
  dancer('instagram', 'What is your Instagram?', 'instagram', makeInstagramStep('instagram', { label: 'Instagram' })),
  dancer('phone_or_whatsapp', 'What is your WhatsApp number?', 'whatsapp', makePhoneStep('phone_or_whatsapp', { label: 'WhatsApp', help: 'It stays private unless you choose to show it.' })),
  dancer('dance_started_year', 'What year did you start dancing?', 'dance_started_year', makeTextStep('dance_started_year', {
    label: 'Year you started', inputMode: 'numeric', placeholder: '2018', maxLength: 4, check: checkYear, toValue: (raw) => Number(raw.trim()),
  })),
  dancer('surname', 'What is your surname?', 'surname', makeTextStep('surname', { label: 'Surname', autoComplete: 'family-name', maxLength: 60 })),
  dancer('bio', 'Tell dancers about you', 'bio', makeTextStep('bio', { label: 'About you', multiline: true, maxLength: 1000 })),
  dancer('website', 'Do you have a website?', 'website_url', makeTextStep('website', { label: 'Website', inputMode: 'url', placeholder: 'example.com', maxLength: 300 })),
  dancer('favourite_styles', 'Which styles do you love dancing?', 'favorite_styles', makeListStep('favourite_styles', { label: 'Favourite styles', placeholder: 'Sensual' })),
  dancer('achievements', 'Anything you are proud of in dance?', 'achievements', makeListStep('achievements', { label: 'Achievements', placeholder: 'Competition final 2024' })),

  // ---- organiser ----------------------------------------------------------------------------
  organiser('name', 'What is your organisation called?', 'name', makeTextStep('org-name', { label: FIELD_LABEL.name, maxLength: 80, check: orgCheck('name'), toValue: orgText('name') })),
  organiser('city', 'Which city is it based in?', 'city', makePickStep('org-city', { label: FIELD_LABEL.city, placeholder: 'Search for the city', search: searchCities }), { advanceOnAnswer: true }),
  organiser('logo', 'Add your organisation logo', 'avatar_url', makeUploadStep('org-logo', { label: FIELD_LABEL.avatar_url, accept: PHOTO_ACCEPT, upload: (env) => env.uploadLogo })),
  organiser('category', 'What kind of organisation is it?', 'organisation_category', makeChoiceStep('org-category', { label: FIELD_LABEL.organisation_category, options: CATEGORY }), { advanceOnAnswer: true }),
  organiser('founded_year', 'What year did it start?', 'founded_year', makeTextStep('org-founded', {
    label: FIELD_LABEL.founded_year, inputMode: 'numeric', placeholder: '2018', maxLength: 4, check: orgCheck('founded_year'), toValue: orgText('founded_year'),
  })),
  organiser('instagram', 'What is its Instagram?', 'instagram', makeInstagramStep('org-instagram', { label: FIELD_LABEL.instagram })),
  organiser('contact_phone', 'What number can dancers call?', 'contact_phone', makePhoneStep('org-phone', {
    label: FIELD_LABEL.contact_phone,
    // The switch itself is on My page (Edit contact details), so the help links there.
    help: ORG_PHONE_HELP,
  })),
  organiser('bio', 'Tell dancers about your organisation', 'bio', makeTextStep('org-bio', { label: FIELD_LABEL.bio, multiline: true, maxLength: 4000, check: orgCheck('bio'), toValue: orgText('bio') })),
  organiser('website', 'Does it have a website?', 'website', makeTextStep('org-website', { label: FIELD_LABEL.website, inputMode: 'url', placeholder: 'example.com', maxLength: 300, check: orgCheck('website'), toValue: orgText('website') })),
  organiser('facebook', 'Does it have a Facebook page?', 'facebook', makeTextStep('org-facebook', { label: FIELD_LABEL.facebook, inputMode: 'url', placeholder: 'facebook.com/yourpage', maxLength: 300, check: orgCheck('facebook'), toValue: orgText('facebook') })),

  // ---- teacher / DJ (B-WEB1's components) ----------------------------------------------------
  ...[doYouTeachStep, ...teacherWizardSteps, doYouDjStep, ...djWizardSteps].map(roleEntry),
];

export const WIZARD_STEPS: ReadonlyMap<string, WizardEntry> = new Map(ENTRIES.map((e) => [`${e.area}:${e.field}`, e]));
export const isRegistered = (key: string): boolean => WIZARD_STEPS.has(key);
