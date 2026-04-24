import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

type CollisionCardProps = {
  existingName: string;
  onClose: () => void;
  closing?: boolean;
};

/**
 * Variant B "meet the other Maria" card — slides down above the input
 * when the submitter's chosen first name collides with an existing entry.
 *
 * Styling matches the Variant B mockup in
 * tmp_guest_list_collision_mockups.html: translucent gold-tinted surface,
 * mini-pill clone of the existing entry (inherits the .gl-pill sweep from
 * the section's scoped stylesheet), headline + advice copy, close button.
 *
 * Entry/exit animation is driven by the `.gl-collision-card` keyframes in
 * src/index.css; `closing` toggles to the exit keyframe.
 */
export const CollisionCard = ({
  existingName,
  onClose,
  closing,
}: CollisionCardProps) => {
  return (
    <div
      className={cn('gl-collision-card', closing && 'is-closing')}
      role="status"
      aria-live="polite"
      style={{
        position: 'relative',
        maxWidth: 360,
        margin: '0 auto 10px',
        padding: '10px 34px 10px 12px',
        background: 'rgba(245, 213, 99, 0.06)',
        border: '0.5px solid rgba(245, 213, 99, 0.35)',
        borderRadius: 12,
        display: 'flex',
        gap: 10,
        alignItems: 'center',
        textAlign: 'left',
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.3)',
      }}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss"
        className="transition-opacity hover:opacity-100"
        style={{
          position: 'absolute',
          top: 6,
          right: 8,
          background: 'transparent',
          border: 0,
          color: 'rgba(240, 230, 233, 0.6)',
          cursor: 'pointer',
          padding: 0,
          lineHeight: 1,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <X className="h-3.5 w-3.5" />
      </button>

      {/* Mini-clone of the existing pill (inherits .gl-pill styles including
          sweep) so the user sees the exact pill they're colliding with. */}
      <span className="gl-pill shrink-0 rounded-full px-2.5 py-[3px] text-xs font-medium">
        <span className="relative z-10">{existingName}</span>
      </span>

      <div
        className="flex-1"
        style={{
          fontSize: 11,
          lineHeight: 1.4,
          color: 'rgba(255, 224, 160, 0.85)',
        }}
      >
        <span
          className="block"
          style={{ fontSize: 12, color: '#f5d563', fontWeight: 600, marginBottom: 2 }}
        >
          Meet the other {existingName} 👋
        </span>
        Add a letter to stand out — e.g. {existingName} S.
      </div>
    </div>
  );
};
