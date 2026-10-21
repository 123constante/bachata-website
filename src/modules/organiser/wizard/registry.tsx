// The wizard's step components keyed by `area:field` (the server's keys). A
// server step whose key is not here is skipped (teacher/DJ until Release B, and
// the fields no self-serve writer takes: dancer gallery / partner_search,
// organiser contact_email / address / maps_link / gallery).
//
// Writers: a dancer answer goes to save_my_dancer_profile_v2 with its ONE key
// (toPatch). An organiser answer is a draft of the SAME edit-in-place field keys
// My page uses, so it goes through draftModel's ONE save (saveDrafts), never a
// second mapping.
import { Link } from 'react-router-dom';
import { searchCities } from '@/modules/organiser/home/onboarding/citySearch';
import { ORG_PATHS } from '@/modules/organiser/shell/paths';
import type { WizardStepDef } from '@/modules/areas/wizardStep';
import { storedInPatchTerms, type EditBase } from '../edit-in-place/draftModel';
import { CATEGORY_OPTIONS, FIELD_LABEL, checkField, type FieldKey } from '../edit-in-place/fieldRules';
import { PHOTO_ACCEPT } from '../edit-in-place/organiserPhotoModel';
import { countryNameFor, wizardCountries } from './wizardCountries';
import { DANCE_ROLE_VALUES, type WizardDancer } from './dancerApi';
import { makeChoiceStep, makeElsewhereStep, makeListStep, makePickStep, makeTextStep, makeUploadStep, textOf, type PickResult } from './stepKinds';

export interface WizardSources {
  dancer: WizardDancer | null;
  /** The organiser's stored row plus its private contact (null until loaded). */
  organiser: EditBase | null;
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
  const term = q.trim().toLowerCase();
  const all = await wizardCountries();
  return all.filter((c) => c.name.toLowerCase().includes(term)).slice(0, 12).map((c) => ({ id: c.code, label: c.name }));
}

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
  dancer('nationality', 'What is your nationality?', 'nationality', makePickStep('nationality', { label: 'Nationality', placeholder: 'Search for a country', search: searchCountries, currentLabel: countryName }), { advanceOnAnswer: true }),
  dancer('languages', 'Which languages do you speak?', 'languages', makeListStep('languages', { label: 'Languages', placeholder: 'English' })),
  dancer('instagram', 'What is your Instagram?', 'instagram', makeTextStep('instagram', { label: 'Instagram', placeholder: 'your.handle', maxLength: 100, autoComplete: 'off' })),
  dancer('phone_or_whatsapp', 'What is your WhatsApp number?', 'whatsapp', makeTextStep('phone_or_whatsapp', {
    label: 'WhatsApp', inputMode: 'tel', placeholder: '+44 7700 900123', maxLength: 40, autoComplete: 'tel', help: 'With the country code. It stays private unless you choose to show it.',
  })),
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
  organiser('instagram', 'What is its Instagram?', 'instagram', makeTextStep('org-instagram', { label: FIELD_LABEL.instagram, placeholder: 'your.handle', maxLength: 100, check: orgCheck('instagram'), toValue: orgText('instagram') })),
  organiser('contact_phone', 'What number can dancers call?', 'contact_phone', makeTextStep('org-phone', {
    label: FIELD_LABEL.contact_phone, inputMode: 'tel', placeholder: '+44 7700 900123', maxLength: 40, check: orgCheck('contact_phone'), toValue: orgText('contact_phone'),
    // The switch itself is on My page (Edit contact details), so the help links there.
    help: <>It shows on your page only if you switch that on in <Link to={ORG_PATHS.page} className="inline-flex min-h-[44px] items-center font-semibold text-[var(--gold)] underline underline-offset-4">My page</Link>.</>,
  })),
  organiser('bio', 'Tell dancers about your organisation', 'bio', makeTextStep('org-bio', { label: FIELD_LABEL.bio, multiline: true, maxLength: 4000, check: orgCheck('bio'), toValue: orgText('bio') })),
  organiser('website', 'Does it have a website?', 'website', makeTextStep('org-website', { label: FIELD_LABEL.website, inputMode: 'url', placeholder: 'example.com', maxLength: 300, check: orgCheck('website'), toValue: orgText('website') })),
  organiser('facebook', 'Does it have a Facebook page?', 'facebook', makeTextStep('org-facebook', { label: FIELD_LABEL.facebook, inputMode: 'url', placeholder: 'facebook.com/yourpage', maxLength: 300, check: orgCheck('facebook'), toValue: orgText('facebook') })),
];

export const WIZARD_STEPS: ReadonlyMap<string, WizardEntry> = new Map(ENTRIES.map((e) => [`${e.area}:${e.field}`, e]));
export const isRegistered = (key: string): boolean => WIZARD_STEPS.has(key);
