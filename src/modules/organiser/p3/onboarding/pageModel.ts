// P3 W4b build 2, slices 2+3: the organiser/page screens 1-9, Review and Live of the approved
// onboarding prototype (docs/design/onboarding-prototype.md, section 2). Pure: no React, no network.
// ONE place for the page order, the FULL-path progress (review r1 S6: page screens + person screens +
// Review, so the bar never reads 100% with Review still ahead), the words, why Continue is off, the
// command each Continue sends (null = nothing changed, nothing sent) and the Review rows.
import { CATEGORY_OPTIONS, checkFacebook, checkInstagram, checkWebsite } from '../../edit-in-place/fieldRules';
import { normalizePhoneE164, stripPhonePunct } from '@/lib/phoneRules';
import { thingsLeft } from './graceModel';
import type { PersonStep } from './personModel';

export { thingsLeft };

export type PageStep = 'welcome' | 'find' | 'create-name' | 'create-city' | 'contact' | 'contact-phone' | 'whatsapp' | 'cat' | 'link' | 'logo';
export type FlowStep = PageStep | PersonStep | 'review';

/** How the person arrived: with a page already (an invite or a claim at sign-in), or with none (find / create). */
export type Arrival = 'has-page' | 'no-page';

/**
 * The facts the path depends on. `waPhone`: the page's phone after the contact step is a real E.164
 * number, so WhatsApp can link to it; with no number (or a legacy one) WhatsApp is not on the path.
 */
export type PathFacts = { arrival: Arrival; waPhone: boolean };

/**
 * The full path as progress groups (prototype STEPS): alternatives are ONE step (find / create name /
 * create city = one; held number / phone = one). Find is not on the path when a page came with the
 * person. Every person step is one group, then Review. Welcome is before the path (0%).
 */
export function fullPath(f: PathFacts, person: readonly PersonStep[]): FlowStep[][] {
  const g: FlowStep[][] = [];
  if (f.arrival === 'no-page') g.push(['find', 'create-name', 'create-city']);
  g.push(['contact', 'contact-phone']);
  if (f.waPhone) g.push(['whatsapp']);
  g.push(['cat'], ['link'], ['logo']);
  for (const s of person) g.push([s]);
  g.push(['review']);
  return g;
}

/** Owner change 2: round(group n / N * 100) over the FULL path; 0 off the path (Welcome). aria-valuenow = this. */
export const flowPercent = (step: FlowStep, groups: readonly (readonly FlowStep[])[]): number => {
  const i = groups.findIndex((g) => g.includes(step));
  if (i < 0 || groups.length === 0) return 0;
  return Math.round(((i + 1) / groups.length) * 100);
};

/** Five cards, stored Title Case, shown sentence case (prototype fix 9, catLabel). */
export const CATEGORIES = CATEGORY_OPTIONS.map((value) => ({
  value,
  label: value.charAt(0) + value.slice(1).toLowerCase(),
  help: ({ 'Dance School': 'Classes and courses', 'Event Brand': 'Parties and socials', 'Community Group': 'By dancers, for dancers', Promoter: 'Nights and tours', 'Festival Brand': 'Weekenders and festivals' } as Record<string, string>)[value],
}));
export const catLabel = (v: string | null | undefined): string => CATEGORIES.find((c) => c.value === v)?.label ?? (v ?? '');

/** What the server holds about the page, as the page screens need it. Missing reads are empty, never invented. */
export type PageHeld = {
  name: string;
  city: string;
  /** contact_phone as stored ('' none). Legacy rows may not be E.164 (5 of 49 on prod, 2026-10-29). */
  phone: string;
  /** organiser_onboarding_progress.contact_confirmed_at is set (status: no contact_confirm code). */
  contactConfirmed: boolean;
  /** socials as stored (whole-object write: a socials patch re-sends every key). */
  socials: Record<string, string | null>;
  website: string;
  instagram: string;
  category: string;
  logo: string;
};

export const EMPTY_PAGE: PageHeld = { name: '', city: '', phone: '', contactConfirmed: false, socials: {}, website: '', instagram: '', category: '', logo: '' };

const str = (v: unknown): string => (typeof v === 'string' ? v : '');

export function socialsFrom(raw: unknown): Record<string, string | null> {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const out: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) out[k] = typeof v === 'string' ? v : null;
  return out;
}

export function pageHeldFrom(reads: { page: Record<string, unknown> | null; phone: string | null; missing: readonly string[] | null }): PageHeld {
  const p = reads.page ?? {};
  return {
    name: str(p.name),
    city: str(p.city),
    phone: (reads.phone ?? '').trim(),
    contactConfirmed: reads.missing ? !reads.missing.includes('contact_confirm') : false,
    socials: socialsFrom(p.socials),
    website: str(p.website).trim(),
    instagram: str(p.instagram).trim(),
    category: str(p.organisation_category).trim(),
    logo: str(p.avatar_url).trim(),
  };
}

/** The E.164 form of a stored phone, or null (legacy / none). */
export const e164Of = (phone: string): string | null => {
  const r = normalizePhoneE164(phone);
  return r.ok && r.value ? r.value : null;
};

/**
 * The phone screen's rule: the shared stored-phone rule (normalizePhoneE164 = the server's
 * normalize_phone_e164_v1), plus the one convenience the prototype copy promises: a UK number typed
 * with its trunk 0 ("07700 900123") is +44. Anything else needs its + and country code.
 */
export function phoneE164(raw: string): string | null {
  const t = stripPhonePunct(raw.trim());
  if (!t) return null;
  const uk = /^0\d{10}$/.test(t) ? `+44${t.slice(1)}` : t;
  return e164Of(uk);
}

/** wa.me link for an E.164 phone: the stored form _whatsapp_link_p5 produces, so a re-send is a no-op. */
export const waLink = (e164: string): string => `https://wa.me/${e164.replace(/\D/g, '')}`;

/** What the one link field holds and where it is stored (prototype: "Stored in the matching column by shape (@handle = Instagram)"). */
export type LinkKind = 'instagram' | 'facebook' | 'website';
export type LinkCheck = { kind: LinkKind; save: string | null; error: string | null };

export function checkLink(raw: string): LinkCheck {
  const t = raw.trim();
  if (!t) return { kind: 'website', save: null, error: null };
  const host = t.replace(/^https?:\/\//i, '').toLowerCase();
  const kind: LinkKind =
    t.startsWith('@') || /^(www\.)?instagram\.com\//.test(host) || /^[A-Za-z0-9._]{1,30}$/.test(t) && !/\.[a-z]{2,}$/i.test(t)
      ? 'instagram'
      : /^((www|m)\.)?(facebook|fb)\.com\//.test(host)
        ? 'facebook'
        : 'website';
  const c = kind === 'instagram' ? checkInstagram(t) : kind === 'facebook' ? checkFacebook(t) : checkWebsite(t);
  return { kind, save: c.ok ? c.willSave : null, error: c.ok ? null : c.error };
}

/** The held link shown in the field: Instagram first (47 of 49 live pages have one), then website, then Facebook. */
export const heldLinkText = (h: PageHeld): string =>
  h.instagram ? (h.instagram.startsWith('@') || /^https?:/i.test(h.instagram) ? h.instagram : `@${h.instagram}`) : h.website || (h.socials.facebook ?? '') || '';

export type WhatsApp = 'yes' | 'no' | null;

/** Every answer on the page screens, as the screens hold it. */
export type PageDraft = {
  name: string;
  cityId: string;
  cityLabel: string;
  phone: string;
  whatsapp: WhatsApp;
  category: string;
  link: string;
  logo: string;
};

/** WhatsApp's held answer: yes when the stored link is the phone's own link; otherwise unanswered (a pick is needed). */
export function heldWhatsApp(h: PageHeld): WhatsApp {
  const e = e164Of(h.phone);
  const wa = (h.socials.whatsapp ?? '').trim();
  if (!wa) return null;
  return e && wa === waLink(e) ? 'yes' : null;
}

export const draftFrom = (h: PageHeld): PageDraft => ({
  name: h.name,
  cityId: '',
  cityLabel: h.city,
  phone: h.phone,
  whatsapp: heldWhatsApp(h),
  category: h.category,
  link: heldLinkText(h),
  logo: h.logo,
});

/**
 * The create answers (name, city) kept across the Finish-profile detour (create_organiser_profile_v1 refuses
 * `profile_incomplete` for a person with no dancer profile yet). They ride in the return URL, like `o` and
 * `at`; the flow drops them from the URL once the page is created.
 */
export const KEPT_PARAMS = ['name', 'city', 'cityLabel'] as const;

export function keptCreateHref(start: string, d: PageDraft): string {
  const q = new URLSearchParams({ at: 'create-name', name: d.name, city: d.cityId, cityLabel: d.cityLabel });
  return `${start}?${q.toString()}`;
}

export function keptCreateDraft(params: URLSearchParams): PageDraft | null {
  const [name, cityId, cityLabel] = KEPT_PARAMS.map((k) => params.get(k) ?? '');
  if (!name && !cityId) return null;
  return { ...draftFrom(EMPTY_PAGE), name, cityId, cityLabel: cityId ? cityLabel : '' };
}

export type PageCopy = { title: string; helper: string | null; reason: string | null };

export const PAGE_COPY: Record<PageStep, PageCopy> = {
  welcome: { title: 'Welcome', helper: null, reason: null },
  find: { title: 'Find your page', helper: 'Your organiser, school or party.', reason: null },
  'create-name': { title: 'Name your page', helper: 'The name dancers see on the calendar.', reason: 'Type a name to continue.' },
  'create-city': { title: 'Which city?', helper: null, reason: 'Pick a city to continue.' },
  contact: { title: 'Is this the best number?', helper: null, reason: null },
  'contact-phone': { title: 'Phone number', helper: 'Shown on your page. UK mobiles start 07; add +44 for anything else.', reason: 'Type a phone number to continue.' },
  whatsapp: { title: 'Show on WhatsApp too?', helper: 'Same number, one-tap chat.', reason: 'Pick one to continue.' },
  cat: { title: 'What kind of page?', helper: null, reason: 'Pick one to continue.' },
  link: { title: 'One link', helper: 'Website, Instagram or Facebook.', reason: 'Add one link to continue.' },
  logo: { title: 'Your logo', helper: 'Square works best.', reason: 'Add a logo to continue.' },
};

export const PHONE_BAD = 'Type a UK number starting 07, or + and the country code.';
export const NAME_MAX = 80;

/** Why Continue is off on this step, or null when it is on. Never a disabled control without a reason. */
export function pageBlocked(step: PageStep, d: PageDraft): string | null {
  const r = PAGE_COPY[step].reason;
  switch (step) {
    case 'create-name': return d.name.trim() ? (Array.from(d.name.trim()).length > NAME_MAX ? `Keep the name under ${NAME_MAX} characters.` : null) : r;
    case 'create-city': return d.cityId ? null : r;
    case 'contact-phone': return !d.phone.trim() ? r : phoneE164(d.phone) ? null : PHONE_BAD;
    case 'whatsapp': return d.whatsapp ? null : r;
    case 'cat': return d.category ? null : r;
    case 'link': { if (!d.link.trim()) return r; const c = checkLink(d.link); return c.error; }
    case 'logo': return d.logo.trim() ? null : r;
    default: return null;
  }
}

/** What one Continue sends. Each kind is one existing RPC (pageApi.ts). */
export type PageCommand =
  | { kind: 'confirm'; phone: string | null }
  | { kind: 'patch'; patch: Record<string, unknown> };

/** The command for Continue on this step, diff-first against what the server holds (null = send nothing). */
export function pageCommandFor(step: PageStep, d: PageDraft, h: PageHeld): PageCommand | null {
  switch (step) {
    case 'contact':
      // "Yes, that's right": ONE tap confirms the held number; already confirmed = nothing to send.
      return h.contactConfirmed ? null : { kind: 'confirm', phone: null };
    case 'contact-phone': {
      const e = phoneE164(d.phone);
      if (!e) return null;
      return e === e164Of(h.phone) && h.contactConfirmed ? null : { kind: 'confirm', phone: e === e164Of(h.phone) ? null : e };
    }
    case 'whatsapp': {
      const e = e164Of(d.phone) ?? phoneE164(d.phone);
      const want = d.whatsapp === 'yes' && e ? waLink(e) : null;
      const have = (h.socials.whatsapp ?? '').trim() || null;
      if (d.whatsapp === null || want === have) return null;
      return { kind: 'patch', patch: { socials: { ...h.socials, whatsapp: want } } };
    }
    case 'cat':
      return d.category && d.category !== h.category ? { kind: 'patch', patch: { organisation_category: d.category } } : null;
    case 'link': {
      if (d.link.trim() === heldLinkText(h).trim()) return null;
      const c = checkLink(d.link);
      if (!c.save) return null;
      if (c.kind === 'instagram') return c.save === h.instagram ? null : { kind: 'patch', patch: { instagram: c.save } };
      if (c.kind === 'facebook') return c.save === h.socials.facebook ? null : { kind: 'patch', patch: { socials: { ...h.socials, facebook: c.save } } };
      return c.save === h.website ? null : { kind: 'patch', patch: { website: c.save } };
    }
    case 'logo':
      return d.logo && d.logo !== h.logo ? { kind: 'patch', patch: { avatar_url: d.logo } } : null;
    default:
      return null;
  }
}

/** What the server holds after this step's command landed: the next Continue on it sends nothing. */
export function pageHeldAfter(step: PageStep, h: PageHeld, d: PageDraft): PageHeld {
  switch (step) {
    case 'contact': return { ...h, contactConfirmed: true };
    case 'contact-phone': return { ...h, contactConfirmed: true, phone: phoneE164(d.phone) ?? h.phone };
    case 'whatsapp': { const e = e164Of(d.phone) ?? phoneE164(d.phone); return { ...h, socials: { ...h.socials, whatsapp: d.whatsapp === 'yes' && e ? waLink(e) : null } }; }
    case 'cat': return { ...h, category: d.category };
    case 'link': {
      const c = checkLink(d.link);
      if (!c.save) return h;
      return c.kind === 'instagram' ? { ...h, instagram: c.save } : c.kind === 'facebook' ? { ...h, socials: { ...h.socials, facebook: c.save } } : { ...h, website: c.save };
    }
    case 'logo': return { ...h, logo: d.logo };
    default: return h;
  }
}

/** The step the contact group opens on: one tap when a number is held, else the phone field. */
export const contactEntry = (h: PageHeld): PageStep => (h.phone ? 'contact' : 'contact-phone');

/** The page steps after the contact group, given the phone the person ended with. */
export const afterContact = (phone: string): PageStep => (e164Of(phone) ?? phoneE164(phone) ? 'whatsapp' : 'cat');

// ---- Review (screen 21): organiser_onboarding_status_v1().missing[] -------------------------------------

/**
 * One row per code _onboarding_missing_v1 can return (read on prod 2026-10-29). `step` = the screen in this
 * flow that answers it; codes with no screen here (based city, Instagram, the DJ question: prototype
 * assumption 6, not drawn) open the dancer profile editor instead.
 */
export type Elsewhere = 'dancer' | 'page';
export type ReviewRow = { code: string; label: string; step: FlowStep | null; elsewhere: Elsewhere | null };

const row = (label: string, step: FlowStep | null, elsewhere: Elsewhere | null = null) => ({ label, step, elsewhere });

export const REVIEW_ROWS: Record<string, Omit<ReviewRow, 'code'>> = {
  first_name: row('Your first name', 'name'),
  city: row('Your city', null, 'dancer'),
  dance_role: row('How you dance', 'role'),
  photo: row('Your photo', 'photo'),
  nationality: row('Nationality', 'nat'),
  languages: row('Languages', 'langs'),
  instagram: row('Your Instagram', null, 'dancer'),
  teach_answer: row('Do you teach?', 'teach'),
  teach_styles: row('Styles you teach', 'styles'),
  teach_years: row('Years teaching', 'years'),
  teach_levels: row('Levels you teach', 'levels'),
  dj_answer: row('Do you DJ?', null, 'dancer'),
  dj_genres: row('Music you play', null, 'dancer'),
  org_logo: row('Page logo', 'logo'),
  org_link: row('Page link', 'link'),
  org_city: row('Page city', null, 'page'),
  org_category: row('Kind of page', 'cat'),
  contact_confirm: row('Contact number', 'contact'),
};

/** An unknown code (a later compulsory item, the status RPC's own promise) still shows, never dropped; it opens the dancer editor. */
export const reviewRow = (code: string): ReviewRow => ({ code, ...(REVIEW_ROWS[code] ?? row(code.replace(/_/g, ' '), null, 'dancer')) });

/** The status read, as Review needs it, for ONE page. */
export type ReviewStatus = {
  missing: string[];
  isAdmin: boolean;
  lifecycle: string;
  about: { done: boolean; skipped: boolean };
};

export function reviewStatusFrom(raw: unknown, organiserId: string): ReviewStatus | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as { is_admin?: unknown; person?: { missing?: unknown }; organisers?: unknown };
  const org = Array.isArray(r.organisers) ? (r.organisers as Record<string, unknown>[]).find((o) => o.id === organiserId) : undefined;
  if (!org) return null;
  const list = (v: unknown) => (Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []);
  const about = (org.about ?? {}) as { done?: unknown; skipped?: unknown };
  return {
    missing: [...list(r.person?.missing), ...list(org.missing)],
    isAdmin: r.is_admin === true,
    lifecycle: typeof org.lifecycle === 'string' ? org.lifecycle : '',
    about: { done: about.done === true, skipped: about.skipped === true },
  };
}


export type GoLiveState = 'blocked' | 'ready' | 'not-yet' | 'live' | 'in-review' | 'closed';

/**
 * Review's one primary button, from the status read. The ONE mapping Review, Live and the server answers agree with
 * (lifecycle values = organiser_profiles_lifecycle_chk: draft, pending_review, live, rejected, archived; read on prod
 * 2026-10-29). `goLiveDeployed` = complete_organiser_onboarding_v1 is wired in; with the stub a ready page's button
 * is disabled with the reason, never a fake success. A live or in-review page has nothing to send; it goes Home.
 * Archived is refused by the RPC (invalid_state), so it is closed here too. Draft and rejected can go live.
 */
export function goLiveState(s: ReviewStatus, goLiveDeployed: boolean): GoLiveState {
  if (s.lifecycle === 'live') return 'live';
  if (s.lifecycle === 'pending_review') return 'in-review';
  if (s.lifecycle === 'archived') return 'closed';
  if (s.missing.length > 0) return 'blocked';
  return goLiveDeployed ? 'ready' : 'not-yet';
}

export const GO_LIVE_NOT_YET = 'Going live opens soon. Everything you added is saved.';
export const IN_REVIEW_SUB = 'Your page is with your city\u2019s team. It goes on the calendar once they have checked it, and we will let you know.';
export const CLOSED_SUB = 'This page is archived, so it can\u2019t go live from here. Ask the Bachata Calendar team to bring it back.';

export function reviewCopy(s: ReviewStatus, deployed: boolean): { title: string; sub: string; primary: string; reason: string | null } {
  const n = s.missing.length;
  const about = s.about.done ? 'About added.' : s.about.skipped ? 'About skipped.' : 'About not added (optional).';
  const state = goLiveState(s, deployed);
  if (state === 'in-review') return { title: 'Sent for a quick check', sub: `${IN_REVIEW_SUB} ${about}`, primary: 'Go to Home', reason: null };
  if (state === 'closed') return { title: 'Page archived', sub: CLOSED_SUB, primary: 'Go to Home', reason: null };
  if (n > 0) {
    return { title: thingsLeft(n), sub: `${n} to do. ${about}`, primary: state === 'live' ? 'Go to Home' : 'Go live', reason: state === 'live' ? null : `Finish the ${thingsLeft(n).replace(' left', '')} left to go live.` };
  }
  if (state === 'live') return { title: 'All done', sub: `Your page is live. ${about}`, primary: 'Go to Home', reason: null };
  return { title: 'All set', sub: `Nothing left to do. ${about}`, primary: 'Go live', reason: state === 'not-yet' ? GO_LIVE_NOT_YET : null };
}

/** What a successful Go live left the page as (complete_organiser_onboarding_v1 `lifecycle` when ok). */
export type GoLiveOutcome = 'live' | 'pending_review';

/**
 * Every refusal the RPC gives (live body read 2026-10-29), as Review handles it:
 *   RAISE authentication_required          -> signed-out (sign in again, come back to Review)
 *   RAISE not_found (not owner / no page)  -> not-owner (owner-only, plan D4; a manager reads the same)
 *   { ok:false, reason:'incomplete', missing[] } -> incomplete (the rows, each jumps to its step)
 *   { ok:false, reason:'invalid_state', lifecycle } -> invalid-state (archived)
 *   anything else (network, a new reason)  -> failed (retry; nothing is lost, every step already saved)
 */
export type GoLiveRefusal = 'incomplete' | 'invalid-state' | 'not-owner' | 'signed-out' | 'failed';

export class GoLiveError extends Error {
  constructor(readonly refusal: GoLiveRefusal, readonly missing: string[] = []) {
    super(`go_live_${refusal}`);
    this.name = 'GoLiveError';
  }
}

/** The RPC's raised error message -> a refusal (only the two RAISEs are named; everything else is a failure to retry). */
export function goLiveRefusalOfMessage(message: string): GoLiveRefusal {
  if (/\bauthentication_required\b/.test(message)) return 'signed-out';
  if (/\bnot_found\b/.test(message)) return 'not-owner';
  return 'failed';
}

/** The RPC's jsonb answer -> the outcome; a refusal (or a shape it never sends) throws GoLiveError. */
export function goLiveOutcomeFrom(raw: unknown): GoLiveOutcome {
  const r = (raw && typeof raw === 'object' ? raw : {}) as { ok?: unknown; reason?: unknown; missing?: unknown; lifecycle?: unknown };
  if (r.ok === true && (r.lifecycle === 'live' || r.lifecycle === 'pending_review')) return r.lifecycle;
  if (r.ok === false && r.reason === 'incomplete') {
    const missing = Array.isArray(r.missing) ? r.missing.filter((x): x is string => typeof x === 'string') : [];
    throw new GoLiveError('incomplete', missing);
  }
  if (r.ok === false && r.reason === 'invalid_state') throw new GoLiveError('invalid-state');
  throw new GoLiveError('failed');
}

/** What Review shows for a refusal, and the one next action it offers. */
export function goLiveRefusalCopy(refusal: GoLiveRefusal): { text: string; action: 'rows' | 'home' | 'sign-in' | 'retry' } {
  switch (refusal) {
    case 'incomplete':
      return { text: 'Not quite yet: your page still needs the things below. Tap one to finish it.', action: 'rows' };
    case 'invalid-state':
      return { text: 'This page can\u2019t go live from here. Ask the Bachata Calendar team to help.', action: 'home' };
    case 'not-owner':
      return { text: 'Only the page owner can put this page live. Ask them to finish here.', action: 'home' };
    case 'signed-out':
      return { text: 'You were signed out. Sign in again and come back here to go live. Everything you added is saved.', action: 'sign-in' };
    default:
      return { text: 'Couldn\u2019t go live. Check your connection and try again. Everything you added is saved.', action: 'retry' };
  }
}

export type LiveAction = 'view' | 'share' | 'home';

/**
 * Screen 22 after a real success. `pending_review` is the review variant ("Sent for a quick check": the G3 copy guard bars "for review"; same layout, no
 * confetti): the page is not public yet, so it offers Home only, never View or Share of a page nobody can see.
 * View / Share point at the public page, which exists only while flags.organiserDetail is on; with it off View
 * opens the page in P3 (You > Organiser page) and Share is not offered (it would share a "coming soon" page).
 */
export function liveCopy(outcome: GoLiveOutcome, name: string, organiserDetail: boolean): { title: string; sub: string; celebrate: boolean; actions: LiveAction[]; publicView: boolean } {
  const page = name || 'Your page';
  if (outcome === 'pending_review') {
    return { title: 'Sent for a quick check', sub: `${page} goes on the calendar once your city\u2019s team has checked it. We will let you know.`, celebrate: false, actions: ['home'], publicView: false };
  }
  return { title: 'You\u2019re live', sub: `${page} is on the calendar.`, celebrate: true, actions: organiserDetail ? ['view', 'share', 'home'] : ['view', 'home'], publicView: organiserDetail };
}
