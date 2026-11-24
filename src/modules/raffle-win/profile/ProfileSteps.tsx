import { useEffect, useState } from 'react';
import { rpcLoose } from '@/integrations/supabase/rpcLoose';
import { introLineFor, orderMissing, stepCount, type ProfileField } from '../profileFields';
import type { ProfileChrome } from './ProfileStep';
import { PhotoStep } from './PhotoStep';
import { NameStep } from './NameStep';
import { RoleStep } from './RoleStep';
import { CityStep } from './CityStep';
import { NationalityStep } from './NationalityStep';
import { LanguagesStep } from './LanguagesStep';

// Raffle winner journey, W2b: the profile steps flow. Shows ONLY the missing fields, saves each step with
// save_my_dancer_profile_v2, calls onDone after the last. Unrouted until W4b.

export type ProfileValues = { avatar_url: string; first_name: string; dance_role: string; based_city_id: string; nationality: string; languages: string[] };
export type SaveProfile = (payload: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;

const defaultSave: SaveProfile = (payload) => rpcLoose('save_my_dancer_profile_v2', { p_payload: payload });

const EMPTY: ProfileValues = { avatar_url: '', first_name: '', dance_role: '', based_city_id: '', nationality: '', languages: [] };

type Props = {
  /** Fields the profile lacks (any order; known names are kept, deduped, in step order). */
  missing: readonly ProfileField[];
  isNewAccount: boolean;
  night: { date: string; title: string } | null;
  userId: string;
  initial?: Partial<ProfileValues>;
  onDone: () => void;
  onBackToPick: () => void;
  save?: SaveProfile;
};

export function ProfileSteps({ missing, isNewAccount, night, userId, initial, onDone, onBackToPick, save = defaultSave }: Props) {
  const [steps] = useState(() => orderMissing(missing));
  const [index, setIndex] = useState(0);
  const [values, setValues] = useState<ProfileValues>({ ...EMPTY, ...initial });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { if (steps.length === 0) onDone(); }, [steps.length, onDone]);
  if (steps.length === 0) return null;

  const field = steps[index];
  const chrome: ProfileChrome = {
    index,
    total: stepCount(steps),
    intro: introLineFor({ isNewAccount, missing: steps }),
    night,
    onBack: () => { setError(null); setIndex((i) => Math.max(0, i - 1)); },
    onBackToPick,
  };
  const set = <K extends ProfileField>(k: K, v: ProfileValues[K]) => setValues((p) => ({ ...p, [k]: v }));

  const next = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await save({ [field]: values[field] });
      if (err) throw new Error(err.message);
    } catch {
      setError('Could not save. Please try again.');
      setBusy(false);
      return;
    }
    setBusy(false);
    if (index + 1 >= steps.length) onDone();
    else setIndex(index + 1);
  };

  const common = { onContinue: () => { void next(); }, chrome };
  return (
    <div className="flex min-h-full flex-col">
      {error && <p role="alert" className="bg-[#150a1c] px-[20px] pt-[12px] text-[14px] font-semibold text-[#ff5470]">{error}</p>}
      {field === 'avatar_url' && <PhotoStep key={field} value={values.avatar_url} onChange={(v) => set('avatar_url', v)} userId={userId} name={values.first_name || null} {...common} />}
      {field === 'first_name' && <NameStep key={field} value={values.first_name} onChange={(v) => set('first_name', v)} {...common} />}
      {field === 'dance_role' && <RoleStep key={field} value={values.dance_role} onChange={(v) => set('dance_role', v)} {...common} />}
      {field === 'based_city_id' && <CityStep key={field} value={values.based_city_id} onChange={(v) => set('based_city_id', v)} {...common} />}
      {field === 'nationality' && <NationalityStep key={field} value={values.nationality} onChange={(v) => set('nationality', v)} {...common} />}
      {field === 'languages' && <LanguagesStep key={field} value={values.languages} onChange={(v) => set('languages', v)} {...common} />}
    </div>
  );
}
