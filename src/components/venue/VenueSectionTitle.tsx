import type { ReactNode } from 'react';

interface VenueSectionTitleProps {
  children: ReactNode;
}

// Centred section heading: gold text with a hairline gold rule above and below.
export default function VenueSectionTitle({ children }: VenueSectionTitleProps) {
  const rule: React.CSSProperties = {
    width: 56,
    height: 2,
    borderRadius: 2,
    background:
      'linear-gradient(90deg, transparent, var(--va-ink-gold), transparent)',
  };

  return (
    <div className="mb-4 flex flex-col items-center gap-3 text-center md:mb-5">
      <span style={rule} />
      <h2
        className="m-0 text-2xl font-bold leading-none tracking-tight md:text-3xl"
        style={{
          fontFamily: 'var(--va-display)',
          color: 'var(--va-ink-gold)',
          letterSpacing: '-0.01em',
        }}
      >
        {children}
      </h2>
      <span style={rule} />
    </div>
  );
}
