import { cn } from "@/lib/utils";
import { DANCE_ROLE_OPTIONS, type DanceRoleValue } from "@/lib/auth-otp-routing";

type DanceRolePickerProps = {
  value: DanceRoleValue | "";
  onChange: (value: DanceRoleValue) => void;
  /** Id of the visible label; the group is named by it. */
  labelId: string;
  errorId?: string;
  invalid?: boolean;
  className?: string;
};

/**
 * The dance-role control for sign-up and Finish your profile: three 44px pills
 * in the site's badge vocabulary (Leader / Follower / Both), emitting the exact
 * stored value. Selected = primary pill with black text; flat, no shadow.
 */
export const DanceRolePicker = ({ value, onChange, labelId, errorId, invalid, className }: DanceRolePickerProps) => (
  <div
    role="radiogroup"
    aria-labelledby={labelId}
    aria-invalid={invalid || undefined}
    aria-describedby={invalid && errorId ? errorId : undefined}
    className={cn("grid grid-cols-3 gap-2", className)}
  >
    {DANCE_ROLE_OPTIONS.map((option) => {
      const on = value === option.value;
      return (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={on}
          onClick={() => onChange(option.value)}
          className={cn(
            "min-h-[44px] rounded-full border px-3 text-[14px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
            on ? "border-primary bg-primary text-black" : "border-border bg-secondary text-foreground hover:border-primary/60",
          )}
        >
          {option.label}
        </button>
      );
    })}
  </div>
);
