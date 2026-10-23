// The role bar over the public dancer page (flags.personHub ON); the model, the fades and the
// gating live in roleBarModel.ts.
import { cn } from '@/lib/utils';
import { RoleSwitchView } from '@/modules/person-page/RoleSwitchBar';
import type { RoleSwitch } from '@/modules/person-page/roleSwitch';
import { DANCER_BAR_FADE, DANCER_BAR_FILL, DANCER_BAR_SIDES } from './roleBarModel';

/** The bar over the teal page: its warm ground sits in a layer behind it and fades out on three sides. */
export function DancerRoleBar({ model, className }: { model: RoleSwitch; className?: string }) {
  return (
    <div
      className={cn('relative isolate', className)}
      style={{ paddingTop: DANCER_BAR_FADE.top, paddingBottom: DANCER_BAR_FADE.bottom }}
      data-testid="dancer-role-bar"
    >
      <div
        aria-hidden="true"
        data-testid="dancer-role-bar-ground"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{ maskImage: DANCER_BAR_SIDES, WebkitMaskImage: DANCER_BAR_SIDES }}
      >
        <div className="h-full w-full" style={{ background: DANCER_BAR_FILL }} />
      </div>
      <RoleSwitchView model={model} fade={false} />
    </div>
  );
}
