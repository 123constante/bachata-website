import { Link } from 'react-router-dom';
import { useEmbeddedProfile } from '@/lib/embeddedProfile';
import { CHIP_LABEL, otherRoles, peoplePath, type PersonRole } from './personRoles';
import { usePersonRoles } from './usePersonRoles';

type Props = { current: PersonRole; id: string | undefined; slug?: string | null };

/** "Also: DJ . Dancer" on an old role page, pointing at that person's tab on /people/:id. */
export function AlsoRoles({ current, id, slug }: Props) {
  const embedded = useEmbeddedProfile();
  const roles = usePersonRoles(embedded ? undefined : id);
  const others = otherRoles(roles, current);
  if (embedded || !id || others.length === 0) return null;
  return (
    <nav aria-label="Other roles" className="flex flex-wrap items-center gap-x-2 px-1 pb-3 text-sm text-muted-foreground">
      <span>Also:</span>
      {others.map((r, i) => (
        <span key={r} className="flex items-center gap-x-2">
          {i > 0 ? <span aria-hidden="true">&middot;</span> : null}
          <Link
            to={peoplePath(slug || id, r)}
            className="inline-flex min-h-[44px] items-center font-medium text-primary underline-offset-2 hover:underline"
          >
            {CHIP_LABEL[r]}
          </Link>
        </span>
      ))}
    </nav>
  );
}
