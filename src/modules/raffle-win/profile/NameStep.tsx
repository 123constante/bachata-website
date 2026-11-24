import { ProfileStep, type StepProps } from './ProfileStep';

export function NameStep({ value, onChange, onContinue, chrome }: StepProps<string>) {
  return (
    <ProfileStep chrome={chrome} heading="What is your first name?" canContinue={value.trim() !== ''} onContinue={onContinue}>
      <input
        type="text"
        autoComplete="given-name"
        placeholder="First name"
        aria-label="First name"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-[60px] w-full flex-none rounded-[18px] border-[1.5px] border-[rgba(247,236,217,.16)] bg-[rgba(247,236,217,.08)] px-[18px] text-[22px] font-bold text-[#f7ecd9] outline-none focus:border-[#ff5470]"
      />
    </ProfileStep>
  );
}
