import { useEffect, useState } from 'react';
import { Check } from 'lucide-react';
import { ProfileStep, type StepProps } from './ProfileStep';

// Seam file (scripts/dancer-area-isolation-allowlist.json). The list is the real ISO list in dancer-app's
// languages.ts, imported lazily so it stays out of the first-load chunk.
type Lib = typeof import('@/modules/dancer-app/screens/edit/languages');

/** value is the chosen language names (multi select); at least one to continue. */
export function LanguagesStep({ value, onChange, onContinue, chrome }: StepProps<string[]>) {
  const [lib, setLib] = useState<Lib | null>(null);
  const [query, setQuery] = useState('');
  useEffect(() => {
    let live = true;
    void import('@/modules/dancer-app/screens/edit/languages').then((m) => { if (live) setLib(m); });
    return () => { live = false; };
  }, []);

  const names = lib ? lib.filterLanguages(query) : [];
  const toggle = (n: string) => onChange(value.includes(n) ? value.filter((x) => x !== n) : [...value, n]);
  return (
    <ProfileStep chrome={chrome} heading="Which languages do you speak?" canContinue={value.length > 0} onContinue={onContinue}>
      <p className="text-[13.5px] text-[rgba(247,236,217,.68)]">Pick every one that applies.</p>
      <input
        type="search"
        aria-label="Search languages"
        placeholder="Search languages"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="h-[52px] w-full flex-none rounded-[16px] border-[1.5px] border-[rgba(247,236,217,.16)] bg-[rgba(247,236,217,.08)] px-[16px] text-[17px] text-[#f7ecd9] outline-none focus:border-[#ff5470]"
      />
      <div className="flex max-h-[44vh] flex-col gap-[6px] overflow-y-auto">
        {names.map((n) => {
          const on = value.includes(n);
          return (
            <button
              key={n}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(n)}
              className={`flex min-h-[48px] flex-none items-center justify-between rounded-[14px] border-[1.5px] px-[14px] text-left text-[16px] font-semibold ${on ? 'border-[#3ddbb4] bg-[rgba(61,219,180,.12)]' : 'border-[rgba(247,236,217,.16)]'}`}
            >
              {n}
              <Check aria-hidden="true" className={`h-[18px] w-[18px] text-[#3ddbb4] ${on ? 'visible' : 'invisible'}`} />
            </button>
          );
        })}
      </div>
    </ProfileStep>
  );
}
