import { useEffect, useLayoutEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const useIsoLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect;

export interface TitleInputProps {
  value: string;
  onChange: (value: string) => void;
  'aria-label': string;
  placeholder?: string;
  maxLength?: number;
  onBlur?: () => void;
  testId?: string;
  className?: string;
}

/**
 * Borderless big title (30px/700) that grows with its text. One line of
 * meaning: Enter does not insert a newline and pasted newlines become spaces.
 */
export function TitleInput({ value, onChange, placeholder, maxLength, onBlur, testId, className, ...aria }: TitleInputProps) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      rows={1}
      value={value}
      aria-label={aria['aria-label']}
      placeholder={placeholder}
      maxLength={maxLength}
      data-testid={testId}
      enterKeyHint="done"
      onBlur={onBlur}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.preventDefault();
      }}
      onChange={(e) => onChange(e.target.value.replace(/[\r\n]+/g, ' '))}
      className={cn(
        'block min-h-[44px] w-full resize-none overflow-hidden border-0 bg-transparent p-0 text-[30px] font-bold leading-[1.15] text-[var(--fg)] outline-none',
        className,
      )}
    />
  );
}
