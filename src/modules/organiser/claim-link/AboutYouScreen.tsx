import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Input } from '@/components/ui/input';
import { AvatarUpload } from '@/components/profile/AvatarUpload';
import { ORGANISER_HOME_PATH } from '@/lib/accountRouting';
import { saveAboutYou } from './claimLinkApi';
import {
  ABOUT_YOU_FAILED_MESSAGE, ABOUT_YOU_MESSAGES, buildAboutYouArgs, validateAboutYou,
  type AboutYouField,
} from './aboutYouModel';

const BTN = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-50';
const GHOST = 'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-4 text-[14px] font-medium';

interface Props {
  userId: string;
  signInEmail: string | null;
  onSaved: () => void;
  onSkip: () => void;
  onBack: () => void;
}

/** ONE About-you screen after a claim. Skip goes to the done screen; the server decides what is missing. */
export default function AboutYouScreen({ userId, signInEmail, onSaved, onSkip, onBack }: Props) {
  const [firstName, setFirstName] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [showContact, setShowContact] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fieldError, setFieldError] = useState<{ field: AboutYouField; message: string } | null>(null);
  const [failed, setFailed] = useState(false);

  const save = async () => {
    const form = { firstName, avatarUrl, phone, email, showContact };
    const local = validateAboutYou(form);
    if (local) { setFieldError(local); return; }
    setFieldError(null);
    setSaving(true);
    const res = await saveAboutYou(buildAboutYouArgs(form));
    setSaving(false);
    if (res.kind === 'saved') { onSaved(); return; }
    if (res.kind === 'refused') {
      const m = ABOUT_YOU_MESSAGES[res.reason];
      if (m.field) { setFieldError({ field: m.field, message: m.message }); return; }
    }
    setFailed(true);
  };

  if (failed) {
    return (
      <div data-testid="about-you-failed">
        <h1 className="text-[22px] font-bold leading-tight">Something went wrong</h1>
        <p className="mt-2 text-[14px] text-muted-foreground">{ABOUT_YOU_FAILED_MESSAGE}</p>
        <button type="button" className={`${BTN} mt-3`} onClick={() => setFailed(false)} data-testid="about-you-try-again">Try again</button>
      </div>
    );
  }

  const err = (field: AboutYouField) => (fieldError?.field === field
    ? <p className="text-[13px] text-destructive" role="alert" data-testid={`about-you-error-${field}`}>{fieldError.message}</p>
    : null);

  return (
    <div className="flex flex-col gap-3" data-testid="about-you">
      <h1 className="text-[22px] font-bold leading-tight">About you</h1>
      <label className="text-[14px] font-medium" htmlFor="about-you-name">First name</label>
      <Input id="about-you-name" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" className="min-h-[48px] text-[16px]" data-testid="about-you-name" />
      {err('name')}
      <p className="text-[14px] font-medium">Your photo</p>
      <AvatarUpload value={avatarUrl || null} onChange={setAvatarUrl} userId={userId} name={firstName || null} />
      {err('photo')}
      <label className="text-[14px] font-medium" htmlFor="about-you-phone">Phone number</label>
      <Input id="about-you-phone" type="tel" inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-[48px] text-[16px]" data-testid="about-you-phone" />
      <label className="text-[14px] font-medium" htmlFor="about-you-email">Or email</label>
      <Input id="about-you-email" type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="min-h-[48px] text-[16px]" data-testid="about-you-email" />
      {signInEmail && (
        <button type="button" className={GHOST} onClick={() => setEmail(signInEmail)} data-testid="about-you-use-email">Use {signInEmail}</button>
      )}
      {err('email')}
      {err('contact')}
      <label className="flex min-h-[44px] items-center gap-3 text-[14px]">
        <input type="checkbox" className="h-5 w-5" checked={showContact} onChange={(e) => setShowContact(e.target.checked)} data-testid="about-you-show-contact" />
        Show my contact on my page
      </label>
      <button type="button" className={BTN} disabled={saving} onClick={() => void save()} data-testid="about-you-save">{saving ? <>Saving&hellip;</> : 'Save'}</button>
      <button type="button" className={GHOST} onClick={onBack} data-testid="about-you-back">Back</button>
      <button type="button" className={GHOST} onClick={onSkip} data-testid="about-you-skip">Skip</button>
      <Link to={ORGANISER_HOME_PATH} className={GHOST} data-testid="about-you-later">Save and finish later</Link>
    </div>
  );
}
