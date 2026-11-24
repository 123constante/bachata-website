import type { ReactNode } from 'react';
import { Gift } from 'lucide-react';

// Raffle winner journey, profile steps (prototype v6). The shell owns chrome only:
// back arrow, "Step n of N", segmented bar, night chip, first-step intro, heading,
// Continue. Steps are controlled and never save (saving is W2b). Unrouted until W4b.

export type ProfileChrome = {
  /** 0-based position among the MISSING fields only. */
  index: number;
  /** N = number of missing fields (profileFields.stepCount). */
  total: number;
  /** introLineFor(...) result; shown on the first step only. */
  intro: string | null;
  night: { date: string; title: string } | null;
  /** Previous step. */
  onBack: () => void;
  /** Called by the back arrow on the first step. */
  onBackToPick: () => void;
};

export type StepProps<T> = { value: T; onChange: (next: T) => void; onContinue: () => void; chrome: ProfileChrome };

type Props = { chrome: ProfileChrome; heading: string; canContinue: boolean; onContinue: () => void; children: ReactNode };

export function ProfileStep({ chrome, heading, canContinue, onContinue, children }: Props) {
  const first = chrome.index === 0;
  return (
    <div className="flex min-h-full flex-col bg-[#150a1c] text-[#f7ecd9]">
      <main className="flex flex-1 flex-col gap-[14px] px-[20px] pb-[12px] pt-[16px]">
        <div className="flex items-center gap-[12px]">
          <button
            type="button"
            aria-label="Back"
            onClick={first ? chrome.onBackToPick : chrome.onBack}
            className="grid h-[40px] w-[40px] flex-none place-items-center rounded-full border-[1.5px] border-[rgba(247,236,217,.16)] text-[24px] leading-none"
          >
            &lsaquo;
          </button>
          <div className="flex flex-1 flex-col gap-[6px]">
            <span className="text-[12.5px] font-semibold text-[rgba(247,236,217,.68)]">
              Step {chrome.index + 1} of {chrome.total}
            </span>
            <div className="flex gap-[4px]" data-testid="profile-segments">
              {Array.from({ length: chrome.total }, (_, i) => (
                <i
                  key={i}
                  data-on={i <= chrome.index ? 'true' : 'false'}
                  className={`h-[5px] flex-1 rounded-[3px] ${i <= chrome.index ? 'bg-[#ff5470]' : 'bg-[#321c3f]'}`}
                />
              ))}
            </div>
          </div>
        </div>
        {chrome.night && (
          <span className="inline-flex max-w-full items-center gap-[8px] self-start rounded-full bg-[rgba(245,185,66,.14)] px-[12px] py-[8px] text-[13.5px] font-semibold text-[#f5b942]">
            <Gift aria-hidden="true" className="h-[16px] w-[16px] flex-none" />
            <span>{chrome.night.date}, {chrome.night.title}</span>
          </span>
        )}
        {first && chrome.intro && <p className="text-[13.5px] leading-[1.3] text-[rgba(247,236,217,.68)]">{chrome.intro}</p>}
        <h2 className="text-[26px] font-extrabold leading-[1.05]">{heading}</h2>
        {children}
      </main>
      <footer className="px-[20px] pb-[22px] pt-[12px]">
        <button
          type="button"
          disabled={!canContinue}
          onClick={onContinue}
          className="h-[56px] w-full rounded-[18px] bg-[#ec3458] text-[17px] font-bold text-white disabled:bg-[#321c3f] disabled:text-[rgba(247,236,217,.4)]"
        >
          Continue
        </button>
      </footer>
    </div>
  );
}
