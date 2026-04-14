import { Globe, Instagram, Facebook, Ticket, AlertTriangle, MapPin, MessageCircle, Music2, Radio } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { EventPageModel } from '@/modules/event-page/types';

type EventIdentityActionsSectionProps = {
  identity: EventPageModel['identity'];
  actions: EventPageModel['actions'];
  locationLabel?: string | null;
};

const actionButtons = [
  { key: 'ticket', label: 'Tickets', icon: Ticket, field: 'ticketUrl' },
  { key: 'website', label: 'Website', icon: Globe, field: 'websiteUrl' },
  { key: 'instagram', label: 'Instagram', icon: Instagram, field: 'instagramUrl' },
  { key: 'facebook', label: 'Facebook', icon: Facebook, field: 'facebookUrl' },
  { key: 'whatsapp', label: 'WhatsApp', icon: MessageCircle, field: 'whatsappLink' },
  { key: 'tiktok', label: 'TikTok', icon: Music2, field: 'tiktokUrl' },
  { key: 'livestream', label: 'Livestream', icon: Radio, field: 'livestreamUrl' },
] as const;

export const EventIdentityActionsSection = ({ identity, actions, locationLabel }: EventIdentityActionsSectionProps) => {
  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          {identity.statusLabel && (
            <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-1 text-[10px] uppercase tracking-[0.15em] text-amber-300">
              <AlertTriangle className="h-3 w-3" />
              {identity.statusLabel}
            </div>
          )}
          {identity.eventType && !identity.statusLabel && (
            <span className="inline-block rounded-full border border-white/10 bg-white/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.15em] text-white/65">
              {identity.eventType}
            </span>
          )}
          {locationLabel && (
            <p className="inline-flex items-center gap-1 text-[11px] text-white/65">
              <MapPin className="h-3.5 w-3.5" />
              <span>{locationLabel}</span>
            </p>
          )}
        </div>

        {actions.hasAny && (
          <div className="flex flex-wrap items-center gap-2">
            {actionButtons.map(({ key, label, icon: Icon, field }) => {
              const href = actions[field];
              if (!href) return null;
              return (
                <Button
                  key={key}
                  size="sm"
                  className="h-8 rounded-full px-3 text-xs"
                  onClick={() => window.open(href, '_blank', 'noopener,noreferrer')}
                >
                  <Icon className="mr-1 h-3.5 w-3.5" />
                  {label}
                </Button>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
};
