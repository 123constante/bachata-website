import { useState } from 'react';

interface VenueDescriptionCardProps {
  description: string;
}

export default function VenueDescriptionCard({ description }: VenueDescriptionCardProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div
      className="overflow-hidden rounded-[18px] border p-4"
      style={{
        background: 'var(--va-surface)',
        borderColor: 'var(--va-accent-line)',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--va-halo) 10%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--va-halo) 32%, transparent)',
      }}
    >
      <div
        className={expanded ? '' : 'line-clamp-4'}
        style={{
          fontSize: '13.5px',
          lineHeight: '1.55',
          color: 'var(--va-text2)',
          fontFamily: 'var(--va-body)',
        }}
      >
        {description}
      </div>
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="mt-2 cursor-pointer text-[12px] font-bold uppercase tracking-[0.08em]"
        style={{ color: 'var(--va-text)', background: 'none', border: 'none', padding: 0 }}
      >
        {expanded ? 'Show less' : 'Read more'}
      </button>
    </div>
  );
}
