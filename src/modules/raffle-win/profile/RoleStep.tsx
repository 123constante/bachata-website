import { Check } from 'lucide-react';
import { DANCE_ROLE_OPTIONS } from '@/lib/auth-otp-routing';
import { ProfileStep, type StepProps } from './ProfileStep';

/** value is the STORED spelling ('Leader' | 'Follower' | 'Lead and Follow'); '' means none yet. */
export function RoleStep({ value, onChange, onContinue, chrome }: StepProps<string>) {
  return (
    <ProfileStep chrome={chrome} heading="Which role do you dance?" canContinue={value !== ''} onContinue={onContinue}>
      <div className="flex flex-col gap-[8px]">
        {DANCE_ROLE_OPTIONS.map((o) => {
          const on = value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(o.value)}
              className={`flex min-h-[74px] items-center justify-between gap-[8px] rounded-[16px] border-[1.5px] px-[16px] text-left text-[20px] font-bold ${on ? 'border-[#3ddbb4] bg-[rgba(61,219,180,.12)]' : 'border-[rgba(247,236,217,.16)]'}`}
            >
              {o.label}
              <Check aria-hidden="true" className={`h-[20px] w-[20px] text-[#3ddbb4] ${on ? 'visible' : 'invisible'}`} />
            </button>
          );
        })}
      </div>
    </ProfileStep>
  );
}
