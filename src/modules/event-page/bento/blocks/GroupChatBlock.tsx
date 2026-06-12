import { MessageCircle } from 'lucide-react';
import { detectChatPlatform, type ChatPlatform } from '@/lib/groupChat';
import { recordEventLinkClick } from '@/lib/eventLinkClicks';
import { WhatsAppIcon } from '@/components/icons/WhatsAppIcon';

/**
 * "Join the group chat" row for the regular (bento) event page.
 *
 * A full-width CTA strip rendered below the bento grid (sibling to
 * MusicStylesRow), styled in the velvet bento idiom — NOT the cinematic
 * festival band (FestivalGroupChatSection), which belongs to the festival
 * page's black/orange language and would clash inside this narrow tinted
 * column.
 *
 * The link can point at any platform; detectChatPlatform picks the brand
 * glyph + accent from the URL (hostname-based, spoof-safe). Renders nothing
 * when there is no link. The URL is expected to be pre-sanitised by
 * safeExternalHref upstream (useEventPageQuery), so href is safe to render.
 */

const Glyph = ({ platform }: { platform: ChatPlatform }) => {
  switch (platform) {
    case 'whatsapp':
      return <WhatsAppIcon className="h-[18px] w-[18px]" />;
    case 'telegram':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
          <path d="M11.944 0A12 12 0 000 12a12 12 0 0012 12 12 12 0 0012-12A12 12 0 0012 0a12 12 0 00-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 01.171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" />
        </svg>
      );
    case 'discord':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
          <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
        </svg>
      );
    case 'facebook':
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="h-[18px] w-[18px]">
          <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
        </svg>
      );
    default:
      return <MessageCircle aria-hidden="true" className="h-[18px] w-[18px]" />;
  }
};

type GroupChatBlockProps = {
  /** Pre-sanitised group-chat invite URL (meta_data.whatsapp_link). */
  url: string | null;
  /** Source event id — for record_event_link_click_v1. Null is a no-op. */
  eventId: string | null;
};

export const GroupChatBlock = ({ url, eventId }: GroupChatBlockProps) => {
  if (!url) return null;

  const meta = detectChatPlatform(url);
  const platformName = meta.platform === 'generic' ? 'Community chat' : `${meta.label} group`;

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() =>
        recordEventLinkClick({
          eventId,
          linkType: 'whatsapp',
          targetUrl: url,
          source: 'bento_group_chat',
        })
      }
      aria-label={`Join the group chat${meta.ariaPlatform} (opens in a new tab)`}
      className="group mt-3 flex items-center gap-3 rounded-[18px] border px-3 py-3 transition hover:brightness-110"
      style={{
        background: 'hsl(var(--bento-surface-raised))',
        borderColor: 'var(--bento-hairline)',
      }}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
        style={{
          color: meta.accent,
          background: `${meta.accent}1f`,
          boxShadow: `inset 0 0 0 1px ${meta.accent}3d`,
        }}
      >
        <Glyph platform={meta.platform} />
      </span>

      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-[14px] font-extrabold leading-tight tracking-[-0.01em]">
          Join the group chat
        </span>
        <span
          className="truncate text-[11px] leading-tight"
          style={{ color: 'hsl(var(--bento-fg-muted))' }}
        >
          {platformName} · ask the organisers anything &amp; find a partner
        </span>
      </span>

      <span
        className="shrink-0 text-[15px] transition-transform group-hover:translate-x-[2px]"
        style={{ color: 'hsl(var(--bento-accent))' }}
        aria-hidden="true"
      >
        →
      </span>
    </a>
  );
};
