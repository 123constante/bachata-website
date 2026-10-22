import { CHIP, SIZE, type WallRole } from './tokens';

/** One role chip. The label is the ONE vocabulary (ROLE_LABEL via roleTagsFor); colour is the role's accent. */
export function RoleChip({ role, label }: { role: WallRole; label: string }) {
  const c = CHIP[role];
  return (
    <span
      data-testid="role-chip"
      data-role={role}
      style={{
        background: c.bg, color: c.text, border: `1.5px solid ${c.border}`,
        fontSize: SIZE.chip, fontWeight: 700, lineHeight: `${SIZE.chipLine}px`, padding: '0 5px', borderRadius: 999,
      }}
    >
      <span className="sr-only">, </span>
      {label}
    </span>
  );
}
