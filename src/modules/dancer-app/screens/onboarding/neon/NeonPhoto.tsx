import { useId } from 'react';

/** Neon Night (D1) palette: [pink, violet, amber, deep]. Copied from the v8 mockup. */
const C = ['#ff2d95', '#7a1fff', '#ffa600', '#12072a'] as const;

/**
 * Photo background for every neon step screen. Stand-in stick figures, ALWAYS drawn
 * (owner rule); SVG path data is verbatim from the mockup `photo(d,id)`.
 */
export function NeonPhoto() {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <div className="neon-photo" aria-hidden="true" data-testid="neon-photo">
      <svg viewBox="0 0 390 844" preserveAspectRatio="xMidYMid slice">
        <defs>
          <radialGradient id={`g${id}`} cx="50%" cy="30%" r="80%">
            <stop offset="0" stopColor={C[2]} stopOpacity=".9" />
            <stop offset=".45" stopColor={C[1]} />
            <stop offset="1" stopColor={C[3]} />
          </radialGradient>
          <filter id={`b${id}`}>
            <feGaussianBlur stdDeviation="6" />
          </filter>
        </defs>
        <rect width="390" height="844" fill={`url(#g${id})`} />
        <g filter={`url(#b${id})`} opacity=".75">
          <circle cx="60" cy="90" r="34" fill={C[2]} />
          <circle cx="330" cy="60" r="22" fill={C[0]} />
          <circle cx="300" cy="200" r="40" fill={C[0]} />
          <circle cx="90" cy="230" r="18" fill="#fff" />
          <circle cx="200" cy="40" r="14" fill="#fff" />
        </g>
        <g fill="#0c0612" opacity=".92">
          <circle cx="165" cy="150" r="19" />
          <path d="M148 172h34l20 70-14 100h-18l-4-70-6 70h-16l-4-100z" />
          <circle cx="232" cy="140" r="17" />
          <path d="M216 160h32l24 60-30 12-4 110h-16l-6-80-8 80h-14l2-110-20-30z" />
          <path d="M180 205l40-12" stroke="#0c0612" strokeWidth="9" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
