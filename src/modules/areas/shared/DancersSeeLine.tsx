import { flags } from '@/lib/featureFlags';
import { NO_NAME_YET } from '@/modules/dancer-app/api/publicName';

/** What DJ slots show for this person: the typed DJ name when not blank, else their own public name (from ownPublicName). */
export function dancersSee(ownName: string | null | undefined, typedDjName: unknown): string | null {
  const typed = typeof typedDjName === 'string' ? typedDjName.trim() : '';
  const own = ownName && ownName !== NO_NAME_YET ? ownName : null;
  return typed || own || null;
}

/** Under the DJ name input (VITE_ENABLE_NAME_FIXES): the live "Dancers see ..." box. */
export function DancersSeeLine({ ownName, typedDjName }: { ownName?: string | null; typedDjName: unknown }) {
  if (!flags.nameFixes) return null;
  const shown = dancersSee(ownName, typedDjName);
  if (!shown) return null;
  return (
    <div data-testid="dancers-see" className="mt-[8px] rounded-[10px] bg-[var(--soft,rgba(0,0,0,0.04))] px-[12px] py-[8px]">
      <p className="text-[14px]">Dancers see <b>{shown}</b>. On every line-up where you DJ.</p>
      <p className="text-[13px] text-[var(--mut)]">Leave it empty to use your own name.</p>
    </div>
  );
}
