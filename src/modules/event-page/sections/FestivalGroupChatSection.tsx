import { type CSSProperties } from 'react';
import { detectChatPlatform, type ChatPlatform } from '@/lib/groupChat';

/**
 * "Join the group chat" band for the festival page.
 *
 * Renders a single full-width invite (one <a>, not a card grid) below the
 * Venue / Organiser block. The link can point at any platform; detectChatPlatform
 * picks the glyph + accent from the URL, while the band stays festival-orange for
 * page cohesion. Renders nothing when there is no link.
 *
 * Self-contained styles (scoped under .fgc-*) so it drops into FestivalDetail.tsx
 * with a single import, matching the page's cinematic language (Bebas Neue /
 * JetBrains Mono / black / #fb923c).
 */

const hexToRgba = (hex: string, alpha: number): string => {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!m) return `rgba(251,146,60,${alpha})`; // festival orange fallback
  const r = parseInt(m[1], 16);
  const g = parseInt(m[2], 16);
  const b = parseInt(m[3], 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const Glyph = ({ platform }: { platform: ChatPlatform }) => {
  switch (platform) {
    case 'whatsapp':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M.057 24l1.687-6.163a11.867 11.867 0 01-1.587-5.946C.16 5.335 5.495 0 12.05 0a11.817 11.817 0 018.413 3.488 11.824 11.824 0 013.48 8.414c-.003 6.557-5.338 11.892-11.893 11.892a11.9 11.9 0 01-5.688-1.448L.057 24zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884a9.86 9.86 0 001.51 5.26l-.999 3.648 3.488-.967zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z" />
        </svg>
      );
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
    case 'discord':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    default:
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
        </svg>
      );
  }
};

const FGC_CSS = `
.fgc { padding: 40px 24px; background: #000; position: relative; }
.fgc-wrap { max-width: 1100px; margin: 0 auto; }
.fgc-head { margin-bottom: 14px; text-align: left; }
.fgc-head .lab { font-family: 'Bebas Neue', sans-serif; font-size: 16px; letter-spacing: 4px; color: #fb923c; }

.fgc-band {
  display: grid;
  grid-template-columns: auto 1fr auto;
  align-items: center;
  gap: clamp(16px, 3vw, 30px);
  padding: clamp(18px, 2.4vw, 26px) clamp(18px, 2.4vw, 28px);
  background: #0a0a0a;
  border: 2px solid #fb923c;
  text-decoration: none;
  color: inherit;
  position: relative;
  overflow: hidden;
  cursor: pointer;
  box-shadow: 0 8px 32px rgba(251,146,60,0.10), 0 2px 0 #c2410c;
  animation: fgc-pulse 3s ease-in-out infinite;
  transition: transform .2s ease, box-shadow .2s ease, background .2s ease;
}
.fgc-band::before {
  content: '';
  position: absolute; inset: 0;
  background: radial-gradient(120% 140% at 0% 50%, var(--accent-wash) 0%, transparent 52%);
  pointer-events: none;
}
@keyframes fgc-pulse {
  0%,100% { box-shadow: 0 8px 32px rgba(251,146,60,0.10), 0 2px 0 #c2410c; }
  50%     { box-shadow: 0 8px 48px rgba(251,146,60,0.28), 0 2px 0 #c2410c; }
}
.fgc-band:hover {
  background: #0f0a05;
  transform: translateY(-4px);
  box-shadow: 0 20px 60px rgba(251,146,60,0.40), 0 4px 0 #c2410c;
  animation: none;
}
.fgc-band:active { transform: translateY(-1px); }
.fgc-band:focus-visible { outline: 3px solid #fff; outline-offset: 3px; }

.fgc-glyph {
  position: relative;
  width: clamp(56px, 8vw, 72px);
  height: clamp(56px, 8vw, 72px);
  border-radius: 50%;
  display: grid; place-items: center;
  background: var(--accent-fill);
  border: 2px solid var(--accent);
  box-shadow: 0 0 0 6px var(--accent-ring), 0 0 26px var(--accent-glow);
  flex-shrink: 0;
}
.fgc-glyph svg { width: 56%; height: 56%; color: var(--accent); display: block; }

.fgc-body { min-width: 0; }
.fgc-eyebrow {
  display: inline-flex; align-items: center; gap: 8px;
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px; font-weight: 700; letter-spacing: 0.22em;
  text-transform: uppercase; color: var(--accent);
  margin-bottom: 8px;
}
.fgc-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--accent);
  box-shadow: 0 0 0 0 var(--accent-glow);
  animation: fgc-live 2.2s ease-out infinite;
  flex-shrink: 0;
}
@keyframes fgc-live {
  0%   { box-shadow: 0 0 0 0 var(--accent-glow); }
  70%  { box-shadow: 0 0 0 7px rgba(0,0,0,0); }
  100% { box-shadow: 0 0 0 0 rgba(0,0,0,0); }
}
.fgc-title {
  font-family: 'Bebas Neue', sans-serif;
  font-size: clamp(1.9rem, 1.2rem + 2.6vw, 2.9rem);
  line-height: 0.98; letter-spacing: 0.01em;
  margin: 0 0 6px; color: #fff;
}
.fgc-sub {
  margin: 0; max-width: 56ch;
  color: rgba(255,255,255,0.78);
  font-size: clamp(13.5px, 0.8rem + 0.2vw, 15px); line-height: 1.5;
}

.fgc-cta {
  flex-shrink: 0;
  display: inline-flex; align-items: center; gap: 10px;
  padding: 14px 26px;
  background: #fb923c; color: #000;
  font-family: 'Bebas Neue', sans-serif;
  font-size: 17px; letter-spacing: 2px; text-transform: uppercase;
  white-space: nowrap;
  transition: background .2s ease;
}
.fgc-cta .arr { font-size: 20px; transition: transform .2s ease; }
.fgc-band:hover .fgc-cta { background: #fff; }
.fgc-band:hover .fgc-cta .arr { transform: translateX(6px); }

@media (max-width: 680px) {
  .fgc-band { grid-template-columns: 1fr; justify-items: center; text-align: center; gap: 14px; padding: 22px 18px; }
  .fgc-eyebrow { justify-content: center; }
  .fgc-sub { margin-inline: auto; }
  .fgc-cta { width: 100%; justify-content: center; }
}

@media (prefers-reduced-motion: reduce) {
  .fgc-band { animation: none; transition: background .2s ease; }
  .fgc-band:hover { transform: none; }
  .fgc-dot { animation: none; }
  .fgc-cta .arr, .fgc-band:hover .fgc-cta .arr { transition: none; transform: none; }
}
`;

export function FestivalGroupChatSection({ url }: { url: string | null | undefined }) {
  if (!url) return null;

  const meta = detectChatPlatform(url);
  const platformName = meta.platform === 'generic' ? 'Group chat' : `${meta.label} group`;

  const bandStyle = {
    '--accent': meta.accent,
    '--accent-glow': hexToRgba(meta.accent, 0.45),
    '--accent-ring': hexToRgba(meta.accent, 0.12),
    '--accent-wash': hexToRgba(meta.accent, 0.16),
    '--accent-fill': hexToRgba(meta.accent, 0.14),
  } as CSSProperties;

  return (
    <section className="fgc">
      <style dangerouslySetInnerHTML={{ __html: FGC_CSS }} />
      <div className="fgc-wrap">
        <div className="fgc-head">
          <div className="lab">&mdash; THE COMMUNITY &mdash;</div>
        </div>
        <a
          className="fgc-band"
          style={bandStyle}
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Join the festival group chat${meta.ariaPlatform} (opens in a new tab)`}
        >
          <span className="fgc-glyph">
            <Glyph platform={meta.platform} />
          </span>
          <span className="fgc-body">
            <span className="fgc-eyebrow">
              <span className="fgc-dot" />
              {platformName} &middot; members chatting now
            </span>
            <h3 className="fgc-title">Join the group chat</h3>
            <p className="fgc-sub">
              Find a dance partner, ask the organisers anything, and get last-minute updates before you arrive.
            </p>
          </span>
          <span className="fgc-cta">
            Join the chat <span className="arr">&rarr;</span>
          </span>
        </a>
      </div>
    </section>
  );
}

export default FestivalGroupChatSection;
