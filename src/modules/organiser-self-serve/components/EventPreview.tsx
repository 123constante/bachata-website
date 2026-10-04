import { useState } from 'react';
import { EVENT_ROW_POSTER_FALLBACKS } from '@/components/events/EventRow';
import type { PreviewModel } from '../createModel';

/**
 * The public event page as a dancer will see it, drawn with the public theme's
 * tokens (src/pages/OrganiserProfile.tsx: near-black, cream, gold) inside the
 * signed-in screen, updated as the organiser types (mockup 02-A's preview).
 */

const SITE = {
  card: '#17131a',
  line: 'rgba(246,241,234,.12)',
  cream: '#F6F1EA',
  mute: 'rgba(246,241,234,.62)',
  gold: '#E7BE6E',
};

export function EventPreview({ model }: { model: PreviewModel }) {
  const [broken, setBroken] = useState<string | null>(null);
  const image = model.coverImageUrl && model.coverImageUrl !== broken ? model.coverImageUrl : null;

  return (
    <aside className="space-y-1.5 lg:sticky lg:top-28" aria-label="Preview as a dancer" data-testid="create-preview" id="create-preview">
      <div className="rounded-xl overflow-hidden border" style={{ background: SITE.card, borderColor: SITE.line, color: SITE.cream }}>
        <div className="relative h-36 flex items-end p-3" style={{ background: image ? '#0E0F13' : EVENT_ROW_POSTER_FALLBACKS[0] }}>
          {image && (
            <img src={image} alt="" loading="eager" className="absolute inset-0 h-full w-full object-cover" onError={() => setBroken(image)} data-testid="preview-image" />
          )}
          <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg,rgba(0,0,0,0) 35%,rgba(12,10,13,.9))' }} aria-hidden="true" />
          <h3 className="relative text-xl font-semibold leading-tight break-words" data-testid="preview-title">{model.title}</h3>
        </div>
        <div className="p-3 text-sm space-y-1" style={{ color: SITE.mute }}>
          <p className="font-semibold" style={{ color: SITE.cream }} data-testid="preview-when">{model.when}</p>
          <p data-testid="preview-where">{model.where ?? 'Venue to be confirmed'}</p>
          {model.level && <p data-testid="preview-level">{model.level}</p>}
          <p>
            by <span style={{ color: SITE.gold }}>{model.by}</span>
          </p>
          {model.description && (
            <p className="pt-1 whitespace-pre-line break-words" style={{ color: SITE.cream }} data-testid="preview-description">
              {model.description}
            </p>
          )}
        </div>
      </div>
      <p className="text-[11px] text-muted-foreground">
        This is the public page, updated as you type. Dancers won&rsquo;t see it until the team approves it.
      </p>
    </aside>
  );
}
