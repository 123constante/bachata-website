import { CHIP, HUB, SIZE, type WallRole } from './tokens';

/** One role chip. The label is the ONE vocabulary (ROLE_LABEL via roleTagsFor); colour is the role's accent. `big` = the hub's size. */
export function RoleChip({ role, label, big = false }: { role: WallRole; label: string; big?: boolean }) {
  const c = CHIP[role];
  return (
    <span
      data-testid="role-chip"
      data-role={role}
      style={{
        background: c.bg, color: c.text, border: `1.5px solid ${c.border}`,
        fontSize: big ? HUB.small : SIZE.chip, fontWeight: big ? 800 : 700,
        lineHeight: `${big ? HUB.smallLine : SIZE.chipLine}px`, padding: big ? '3px 10px' : '0 5px', borderRadius: 999,
      }}
    >
      <span className="sr-only">, </span>
      {label}
    </span>
  );
}
