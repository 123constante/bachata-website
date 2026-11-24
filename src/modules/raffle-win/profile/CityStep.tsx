import { CityPicker } from '@/components/ui/city-picker';
import { ProfileStep, type StepProps } from './ProfileStep';

/** value is the based_city_id ('' = none yet). The real searchable CityPicker, not a copy of its list. */
export function CityStep({ value, onChange, onContinue, chrome }: StepProps<string>) {
  return (
    <ProfileStep chrome={chrome} heading="Where are you based?" canContinue={value !== ''} onContinue={onContinue}>
      <CityPicker
        value={value || undefined}
        onChange={(id) => onChange(id)}
        aria-label="Based city"
        placeholder="Search your city"
        className="min-h-[56px] w-full"
      />
    </ProfileStep>
  );
}
