import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { INSTAGRAM_URL } from '@/lib/contactLinks';
import { ACCOUNT_CONTACT_EMAIL as CONTACT_EMAIL } from '@/lib/accountDeletionCopy';

type Props = { routeId: 'privacy' | 'terms'; title: string; updated: string; children: ReactNode };

/** Shared frame for /privacy and /terms: compact, one column, readable at 390px. */
export const LegalShell = ({ routeId, title, updated, children }: Props) => (
  <GlobalLayout breadcrumbs={buildBreadcrumbs(routeId)}>
    <article className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-24 pt-3 text-sm text-foreground" data-testid={`legal-${routeId}`}>
      <header className="space-y-1">
        <h1 className="text-lg font-bold">{title}</h1>
        <p className="text-xs text-muted-foreground">Last updated {updated}</p>
      </header>
      {children}
      <Contact />
      <p className="text-xs text-muted-foreground">
        <Link to="/privacy" className="underline">Privacy</Link> &middot; <Link to="/terms" className="underline">Terms</Link>
      </p>
    </article>
  </GlobalLayout>
);

export const Section = ({ title, children }: { title: string; children: ReactNode }) => (
  <section className="space-y-2">
    <h2 className="text-base font-semibold">{title}</h2>
    {children}
  </section>
);


/** Who runs the site. The e-mail is the contact route; Instagram is an optional second channel. */
const Contact = () => (
  <Section title="Who we are and how to reach us">
    <p>This site is operated by Bachata Calendar.</p>
    <p>
      Questions, data requests or complaints:{' '}
      <a href={`mailto:${CONTACT_EMAIL}`} className="underline">{CONTACT_EMAIL}</a>. You can also message us on{' '}
      <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="underline">Instagram</a>.
    </p>
  </Section>
);
