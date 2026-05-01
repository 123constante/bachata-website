import { Instagram, Facebook, MessageCircle } from 'lucide-react';
import type { EventPageModel } from '@/modules/event-page/types';
import { recordEventLinkClick, type EventLinkType } from '@/lib/eventLinkClicks';

type Props = {
  actions: EventPageModel['actions'];
  /** Bundle E.2 — passed to record_event_link_click_v1. Null is a no-op. */
  eventId: string | null;
};

const btnClass =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[0.5px] border-white/20 bg-transparent text-white/55 transition-colors hover:text-white hover:border-white/40';

export const EventSocialIcons = ({ actions, eventId }: Props) => {
  const hasWebsite = Boolean(actions.websiteUrl);
  const hasInstagram = Boolean(actions.instagramUrl);
  const hasFacebook = Boolean(actions.facebookUrl);
  const hasWhatsapp = Boolean(actions.whatsappLink);

  if (!hasWebsite && !hasInstagram && !hasFacebook && !hasWhatsapp) return null;

  const open = (url: string, linkType: EventLinkType) => {
    recordEventLinkClick({
      eventId,
      linkType,
      targetUrl: url,
      source: 'classic_social_icons',
    });
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      {hasWebsite && (
        <button
          type="button"
          onClick={() => open(actions.websiteUrl!, 'other')}
          className={btnClass}
          aria-label="Website"
        >
          <span className="text-[13px] leading-none" aria-hidden>🌐</span>
        </button>
      )}
      {hasInstagram && (
        <button
          type="button"
          onClick={() => open(actions.instagramUrl!, 'instagram')}
          className={btnClass}
          aria-label="Instagram"
        >
          <Instagram className="h-3.5 w-3.5" />
        </button>
      )}
      {hasFacebook && (
        <button
          type="button"
          onClick={() => open(actions.facebookUrl!, 'other')}
          className={btnClass}
          aria-label="Facebook"
        >
          <Facebook className="h-3.5 w-3.5" />
        </button>
      )}
      {hasWhatsapp && (
        <button
          type="button"
          onClick={() => open(actions.whatsappLink!, 'whatsapp')}
          className={btnClass}
          aria-label="WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
