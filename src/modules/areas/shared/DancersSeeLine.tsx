import { flags } from '@/lib/featureFlags';
import { resolvePublicName } from '@/lib/publicName';
import { nameFor } from '@/modules/person-page/badges';
import type { Details } from './roleModel';

/** What DJ slots show for this person: the typed DJ name when not blank, else their own public name (the existing nameFor rule). */
export function dancersSee(details: Details, typedDjName: unknown): { shown: string | null; ownName: string | null } {
  const ownName = resolvePublicName({ ...(details as Record<string, string | null>), dj_name: null });
  const typed = typeof typedDjName === 'string' ? typedDjName.trim() : '';
  const shown = ownName === null && !typed ? null : nameFor('dj', { name: ownName ?? '', djName: typed || null }) || null;
  return { shown, ownName };
}

/** Under the DJ name input (VITE_ENABLE_NAME_FIXES): the live "Dancers see ..." box. */
export function DancersSeeLine({ details, typedDjName }: { details: Details; typedDjName: unknown }) {
  if (!flags.nameFixes) return null;
  const { shown, ownName } = dancersSee(details, typedDjName);
  if (!shown) return null;
  return (
    <div data-testid="dancers-see" className="mt-[8px] rounded-[10px] bg-[var(--soft,rgba(0,0,0,0.04))] px-[12px] py-[8px]">
      <p className="text-[14px]">Dancers see <b>{shown}</b> &middot; DJ</p>
      <p className="text-[13px] text-[var(--mut)]">
        On every line-up you are on. Leave it empty to use your own name{ownName ? <>, {ownName}</> : null}.
      </p>
    </div>
  );
}
