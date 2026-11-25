/** Neon Night (D1) look for Photo and Bio + links. Same props and handlers as PhotoCardV3/BioLinksCardV3 (stepsV3.tsx): look only. */

type Foot = { busy: boolean; error: string | null };

const Err = ({ error }: { error: string | null }) =>
  error ? (
    <p role="alert" className="small" data-testid="onboarding-error">
      {error}
    </p>
  ) : null;

export const PhotoNeon = ({ photoUrl, onPickPhoto, busy, error, onContinue }: Foot & { photoUrl: string | null; onPickPhoto: () => void; onContinue: () => void }) => {
  const has = photoUrl !== null && photoUrl !== '';
  return (
    <>
      <h2 className="q">Show us your face</h2>
      <p className="sub" data-testid="onboarding-sub">
        A photo is required. Partners and organisers need to know who you are.
      </p>
      {/* Owner rule: the circle ALWAYS shows the mockup emoji, even after upload (never the real avatar). Only the tick and label change. */}
      <button type="button" className={has ? 'photoadd on' : 'photoadd'} data-testid="onboarding-photo-tile" onClick={onPickPhoto}>
        <span aria-hidden="true" style={{ fontSize: has ? 60 : 44 }}>
          {has ? '\u{1F9D1}' : '\u{1F4F8}'}
        </span>
        <span>{has ? 'Photo added. Tap to change' : 'Tap to add a photo'}</span>
      </button>
      <Err error={error} />
      {has ? null : (
        <p className="small" data-testid="onboarding-reason">
          Add a photo to continue.
        </p>
      )}
      <button type="button" className="cta" data-testid="onboarding-continue" disabled={!has || busy} onClick={onContinue}>
        {busy ? 'Saving…' : 'Continue'}
      </button>
    </>
  );
};

export const BioNeon = ({
  bio,
  link,
  onBio,
  onLink,
  busy,
  error,
  onContinue,
  onSkip,
  bioOnly = false,
}: Foot & { bio: string; link: string; onBio: (v: string) => void; onLink: (v: string) => void; onContinue: () => void; onSkip: () => void; bioOnly?: boolean }) => {
  const bioPh = bioOnly ? 'A short bio' : 'A short bio (optional)';
  const linkPh = bioOnly ? 'Instagram or other link' : 'Instagram or other link (optional)';
  return (
    <>
      <h2 className="q">Tell us about you</h2>
      <p className="sub" data-testid="onboarding-sub">
        {bioOnly ? 'Add a bio and a link so dancers know you. You can change this any time on Me.' : 'Optional. Skip any time.'}
      </p>
      <textarea className="fld" aria-label={bioPh} placeholder={bioPh} rows={bioOnly ? 4 : 3} value={bio} onChange={(e) => onBio(e.target.value)} data-testid="onboarding-bio-input" />
      <input className="fld" type="text" inputMode="url" autoCapitalize="none" autoCorrect="off" aria-label={linkPh} placeholder={linkPh} value={link} onChange={(e) => onLink(e.target.value)} data-testid="onboarding-link-input" />
      <Err error={error} />
      <button type="button" className="cta" data-testid="onboarding-finish" disabled={busy} onClick={onContinue}>
        {busy ? 'Saving…' : bioOnly ? 'Save' : 'Finish'}
      </button>
      <button type="button" className="lnk" data-testid="onboarding-skip" disabled={busy} onClick={onSkip}>
        {bioOnly ? 'Not now' : 'Skip for now'}
      </button>
      {bioOnly ? null : <p className="small ctr">Next: your real Home, exactly as today.</p>}
    </>
  );
};
