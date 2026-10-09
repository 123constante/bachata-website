import { describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { DerivedLevelBadge } from '@/modules/event-page/bento/blocks/DerivedLevelBadge';

// The label map comes from the rating hook module, which imports the supabase client.
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/hooks/useAuth', () => ({ useAuth: () => ({ user: null }) }));

describe('DerivedLevelBadge', () => {
  it('renders nothing when derivedLevel is null', () => {
    expect(renderToStaticMarkup(<DerivedLevelBadge derivedLevel={null} levelVoteCount={3} />)).toBe('');
  });

  it('shows the level label with an accessible rating count', () => {
    const html = renderToStaticMarkup(<DerivedLevelBadge derivedLevel="open_level" levelVoteCount={12} />);
    expect(html).toContain('</span> Open level<span');
    expect(html).toContain('title="Rated by dancers (12 ratings)"');
    expect(html).toContain('<span class="sr-only">. Rated by dancers (12 ratings)</span>');
  });

  it('names its source with a "Dancers rate:" label', () => {
    const html = renderToStaticMarkup(<DerivedLevelBadge derivedLevel="intermediate" levelVoteCount={1} />);
    expect(html).toContain('>Dancers rate:</span> Intermediate');
    expect(html).toContain('title="Rated by dancers (1 rating)"');
  });
});
