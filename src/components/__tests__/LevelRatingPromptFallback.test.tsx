// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/hooks/useSeriesLevelRating', () => ({
  LEVEL_OPTIONS: [],
  useSeriesLevelRating: () => ({ summary: null, canRate: false, rate: vi.fn(), isRating: false }),
}));

import { LevelRatingPrompt } from '@/components/LevelRatingPrompt';

describe('LevelRatingPrompt fallback', () => {
  it('renders the fallback when there is no summary', () => {
    render(
      <MemoryRouter>
        <LevelRatingPrompt seriesId="s1" fallback={<span>fallback-badge</span>} />
      </MemoryRouter>,
    );
    expect(screen.getByText('fallback-badge')).toBeTruthy();
  });
  it('renders nothing without a fallback', () => {
    const { container } = render(
      <MemoryRouter>
        <LevelRatingPrompt seriesId="s1" />
      </MemoryRouter>,
    );
    expect(container.textContent).toBe('');
  });
});
