/**
 * Above-the-grid SEO intro paragraph for listing pages.
 *
 * Listings used to be card-grid-only with no descriptive text - which gives
 * Google nothing to anchor topical relevance to. Each listing now passes a
 * short, keyword-led intro through this primitive.
 *
 * Mobile-first: compact text-sm, p-3, no oversized headers.
 */
import type { ReactNode } from 'react';

interface ListingIntroProps {
  children: ReactNode;
}

const ListingIntro = ({ children }: ListingIntroProps) => (
  <section className="mx-auto max-w-3xl px-4 pt-4 pb-2">
    <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
      {children}
    </p>
  </section>
);

export default ListingIntro;
