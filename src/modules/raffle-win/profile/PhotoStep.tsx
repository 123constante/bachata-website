import { useRef, useState, type ChangeEvent } from 'react';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { uploadToR2 } from '@/lib/uploadToR2';
import { uploadErrorMessage, validateImageFile } from '@/lib/upload-validation';
import { ProfileStep, type StepProps } from './ProfileStep';

// Same upload path AvatarUpload uses (validateImageFile + uploadToR2 'avatars' bucket);
// AvatarUpload itself has one "Upload Photo" button, so it cannot carry the two
// prototype buttons. value is the photo URL ('' = none). The upload is the only
// side effect; saving the profile is W2b.
export function PhotoStep({ value, onChange, onContinue, chrome, userId, name = null }: StepProps<string> & { userId: string; name?: string | null }) {
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const has = value !== '';

  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const check = validateImageFile(file);
      if (check.ok === false) throw new Error(check.message);
      const ext = file.name.split('.').pop();
      onChange(await uploadToR2(file, 'avatars', `${userId}-${Math.random()}.${ext}`));
    } catch (err: unknown) {
      setError(uploadErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const btn = 'min-h-[52px] flex-1 rounded-[16px] border-[1.5px] border-[rgba(247,236,217,.16)] text-[15px] font-bold disabled:opacity-50';
  const accept = 'image/jpeg,image/png,image/webp,image/gif,image/avif';
  return (
    <ProfileStep chrome={chrome} heading="Add a photo of you" canContinue={has && !busy} onContinue={onContinue}>
      <div className="flex justify-center">
        <PersonAvatar photoUrl={value || null} name={name} size={190} loading="eager" />
      </div>
      <div className="flex gap-[10px]">
        <button type="button" className={btn} disabled={busy} onClick={() => camera.current?.click()}>
          {has ? 'Retake photo' : 'Take a photo'}
        </button>
        <button type="button" className={btn} disabled={busy} onClick={() => library.current?.click()}>
          {has ? 'Choose another' : 'Choose from library'}
        </button>
      </div>
      <input ref={camera} type="file" accept={accept} capture="user" hidden data-testid="photo-camera" onChange={pick} />
      <input ref={library} type="file" accept={accept} hidden data-testid="photo-library" onChange={pick} />
      {error && <p role="alert" className="text-[14px] font-semibold text-[#ff5470]">{error}</p>}
    </ProfileStep>
  );
}
