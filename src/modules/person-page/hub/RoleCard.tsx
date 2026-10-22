import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';
import { emitProfileView } from '@/lib/profileViewEmit';
import { CHIP, FOCUS_RING, HUB, TILE, WALL } from '../wall/tokens';
import type { RoleCardModel } from './model';

/** The whole card is ONE link to that role's own page; it is only ever built with a real href. */
export function RoleCard({ card, personId }: { card: RoleCardModel; personId: string }) {
  const chip = CHIP[card.role];
  const edge = TILE[card.role].edge;
  return (
    <Link
      to={card.href}
      data-testid="hub-role-card"
      data-role={card.role}
      className={`flex items-center gap-3 ${FOCUS_RING}`}
      onClick={() => emitProfileView({ personId, profileType: card.role, context: 'person-hub' })}
      style={{
        minHeight: HUB.cardMinHeight, borderRadius: HUB.cardRadius, background: WALL.card, color: WALL.text,
        border: `1.5px solid ${edge}`, borderLeft: `${HUB.cardEdge}px solid ${edge}`, padding: '12px 12px 12px 14px',
      }}
    >
      <span className="min-w-0 flex-1">
        <span
          className="inline-block"
          style={{ background: chip.bg, color: chip.text, fontSize: HUB.cardChip, fontWeight: 800, padding: '2px 12px', borderRadius: 999 }}
        >
          {card.label}
        </span>
        <span className="mt-1 block break-words" style={{ fontSize: HUB.body, color: WALL.text }}>{card.line}</span>
      </span>
      <ChevronRight className="h-6 w-6 shrink-0" style={{ color: edge }} aria-hidden="true" />
    </Link>
  );
}
