import { Switch } from '@/components/ui/switch';

/** Why the switch cannot be used right now, or null when it can. One mapping for the screen and the tests. */
export const hideSurnameDisabledReason = (s: {
  isSaving: boolean;
  firstName: string;
  cityId: string;
  switchReadable: boolean;
}): string | null => {
  if (s.isSaving) return 'Saving your profile…';
  if (!s.firstName.trim() || !s.cityId.trim()) return 'Add your first name and city first, then you can choose.';
  if (!s.switchReadable) return 'We could not load this setting. Try again in a moment.';
  return null;
};

export const HIDE_SURNAME_LABEL = 'Hide my surname from the public';
export const hideSurnameHelper = (hidden: boolean): string =>
  hidden
    ? 'Anyone viewing your profile or a line-up sees only your first name.'
    : 'Anyone viewing your profile or a line-up sees your first name and surname.';

export const HideSurnameSwitch = ({
  checked,
  onChange,
  disabledReason,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabledReason: string | null;
}) => (
  <div className="rounded-md border border-border p-3" data-testid="hide-surname-switch">
    <div className="flex min-h-[44px] items-center justify-between gap-3">
      <label htmlFor="hide-surname-publicly" className="text-sm font-medium">
        {HIDE_SURNAME_LABEL}
      </label>
      <Switch
        id="hide-surname-publicly"
        checked={checked}
        // 44px tall: a phone tap target (the dancer-home e2e fails any control under 43.5px).
        className="h-[44px] w-[72px] [&>span]:h-[38px] [&>span]:w-[38px] data-[state=checked]:[&>span]:translate-x-[30px]"
        disabled={disabledReason !== null}
        onCheckedChange={onChange}
        aria-describedby="hide-surname-help"
      />
    </div>
    <p id="hide-surname-help" className="text-xs text-muted-foreground">
      {hideSurnameHelper(checked)}
    </p>
    {disabledReason && <p className="mt-1 text-xs text-muted-foreground">{disabledReason}</p>}
  </div>
);
