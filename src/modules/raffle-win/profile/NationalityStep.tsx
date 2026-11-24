import { NationalityPicker } from '@/components/ui/nationality-picker';
// Seam file (scripts/dancer-area-isolation-allowlist.json): the one place besides LanguagesStep allowed to import dancer-app.
import { nationalityCodeForPick } from '@/modules/dancer-app/screens/edit/editModel';
import { ProfileStep, type StepProps } from './ProfileStep';

/** value is the stored country code ('' = none yet). Single select from the real searchable list. */
export function NationalityStep({ value, onChange, onContinue, chrome }: StepProps<string>) {
  return (
    <ProfileStep chrome={chrome} heading="What is your nationality?" canContinue={value !== ''} onContinue={onContinue}>
      <NationalityPicker
        value={value || undefined}
        onChange={(pick) => onChange(nationalityCodeForPick(pick))}
        aria-label="Nationality"
        className="min-h-[56px] w-full"
      />
    </ProfileStep>
  );
}
