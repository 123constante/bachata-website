import { useEffect, useRef, useState } from 'react';
import { Input } from '@/components/ui/input';
import { normaliseSocial, type SocialPreview } from './selfSignupApi';

const BTN = 'inline-flex w-full min-h-[48px] items-center justify-center rounded-xl bg-primary px-4 text-[15px] font-semibold text-primary-foreground disabled:opacity-50';
const GHOST = 'inline-flex w-full min-h-[44px] items-center justify-center rounded-xl border border-border px-4 text-[14px] font-medium';
const PREVIEW_MS = 400;

interface Props {
  initial: string;
  onContinue: (text: string) => void;
  onSkip: () => void;
  onBack: (text: string) => void;
}

/** One Instagram-or-website field, any format. The server tidies it; the line below only says what we understood. */
export default function SocialStep({ initial, onContinue, onSkip, onBack }: Props) {
  const [text, setText] = useState(initial);
  const [preview, setPreview] = useState<SocialPreview | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const seq = useRef(0);

  useEffect(() => {
    const mine = ++seq.current;
    setPreview(null);
    if (!text.trim()) return;
    const t = setTimeout(() => {
      void normaliseSocial(text).then((p) => { if (mine === seq.current) setPreview(p); });
    }, PREVIEW_MS);
    return () => clearTimeout(t);
  }, [text]);

  const change = () => { inputRef.current?.focus(); inputRef.current?.select(); };

  return (
    <>
      <h1 className="text-[22px] font-bold leading-tight">Instagram or website</h1>
      <p className="text-[14px] text-muted-foreground">Paste a link, a handle or a web address. Any format works.</p>
      <Input ref={inputRef} value={text} onChange={(e) => setText(e.target.value)} autoCapitalize="none" autoCorrect="off" className="min-h-[48px] text-[16px]" aria-label="Instagram or website" data-testid="signup-social-input" />
      {preview && preview.kind !== 'unknown' && (
        <p className="flex items-center justify-between gap-2 text-[14px] font-medium text-[#2f7d4f]" data-testid="signup-social-line">
          <span className="break-all">{preview.kind === 'instagram' ? `Instagram: @${preview.value}` : `Website: ${preview.value.replace(/^https?:\/\//i, '')}`}</span>
          <button type="button" className="shrink-0 underline" onClick={change} data-testid="signup-social-change">Change</button>
        </p>
      )}
      {preview && preview.kind === 'unknown' && (
        <p className="text-[14px] text-muted-foreground" data-testid="signup-social-unknown">We could not read that. Check it, or skip.</p>
      )}
      <button type="button" className={BTN} onClick={() => onContinue(text)} data-testid="signup-social-continue">Continue</button>
      <button type="button" className={GHOST} onClick={onSkip} data-testid="signup-social-skip">Skip for now</button>
      <button type="button" className={GHOST} onClick={() => onBack(text)} data-testid="signup-social-back">Back</button>
    </>
  );
}
