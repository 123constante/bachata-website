import { Instagram, Facebook, MessageCircle } from 'lucide-react';
import type { EventPageModel } from '@/modules/event-page/types';

type Props = {
  actions: EventPageModel['actions'];
};

const btnClass =
  'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[0.5px] border-white/20 bg-transparent text-white/55 transition-colors hover:text-white hover:border-white/40';

export const EventSocialIcons = ({ actions }: Props) => {
  const hasWebsite = Boolean(actions.websiteUrl);
  const hasInstagram = Boolean(actions.instagramUrl);
  const hasFacebook = Boolean(actions.facebookUrl);
  const hasWhatsapp = Boolean(actions.whatsappLink);

  if (!hasWebsite && !hasInstagram && !hasFacebook && !hasWhatsapp) return null;

  const open = (url: string) => window.open(url, '_blank', 'noopener,noreferrer');

  return (
    <div className="mt-3 flex items-center justify-center gap-2">
      {hasWebsite && (
        <button
          type="button"
          onClick={() => open(actions.websiteUrl!)}
          className={btnClass}
          aria-label="Website"
        >
          <span className="text-[13px] leading-none" aria-hidden>🌐</span>
        </button>
      )}
      {hasInstagram && (
        <button
          type="button"
          onClick={() => open(actions.instagramUrl!)}
          className={btnClass}
          aria-label="Instagram"
        >
          <Instagram className="h-3.5 w-3.5" />
        </button>
      )}
      {hasFacebook && (
        <button
          type="button"
          onClick={() => open(actions.facebookUrl!)}
          className={btnClass}
          aria-label="Facebook"
        >
          <Facebook className="h-3.5 w-3.5" />
        </button>
      )}
      {hasWhatsapp && (
        <button
          type="button"
          onClick={() => open(actions.whatsappLink!)}
          className={btnClass}
          aria-label="WhatsApp"
        >
          <MessageCircle className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
};
