/**
 * For organisers (site structure S3c-2): one place an organiser lands -
 * list an event, sign in, sell tickets, run a raffle. Server-rendered via
 * app/routes/for-organisers.tsx, which owns the head from SEO_INPUT.
 */
import GlobalLayout from '@/components/layout/GlobalLayout';
import { flags } from '@/lib/featureFlags';
import { SITE_ORIGIN, type SeoInput } from '@/lib/seo';
import { WHATSAPP_GET_LISTED_URL } from '@/lib/contactLinks';
import { buildSignInHref } from '@/lib/authRouting';

export const SEO_INPUT: SeoInput = {
  title: 'For organisers | Bachata Calendar',
  description: 'List your bachata event in London, manage it, sell tickets and run raffles.',
  canonical: `${SITE_ORIGIN}/for-organisers`,
};

// No buildBreadcrumbs route id for this page yet (siteIa.ts is out of scope for
// this slice), so pass the two-item trail directly.
const BREADCRUMBS = [{ label: 'Home', path: '/' }, { label: 'For organisers' }];

const BUTTON_CLASS =
  'flex w-full min-h-[44px] items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground';

interface CardProps {
  emoji: string;
  title: string;
  line: string;
  label: string;
  href: string;
  external?: boolean;
}

const Card = ({ emoji, title, line, label, href, external }: CardProps) => (
  <li className="rounded-lg border bg-card p-3 space-y-2">
    <div>
      <p className="text-sm font-bold">
        <span aria-hidden="true">{emoji}</span> {title}
      </p>
      <p className="text-sm text-muted-foreground">{line}</p>
    </div>
    <a
      href={href}
      className={BUTTON_CLASS}
      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
    >
      {label}
    </a>
  </li>
);

const ForOrganisers = () => {
  const signInHref = buildSignInHref('/account');
  return (
    <GlobalLayout breadcrumbs={BREADCRUMBS}>
      <main className="mx-auto max-w-3xl p-3 space-y-3">
        <header className="space-y-1">
          <h1 className="text-xl font-bold">For organisers</h1>
          <p className="text-sm text-muted-foreground">
            Put your classes, parties and festivals in front of London&rsquo;s bachata dancers.
          </p>
        </header>
        <ul className="space-y-3">
          <Card
            emoji={'\u{1F4C5}'}
            title="List your event"
            line="Send us the details on WhatsApp and we add it to the calendar."
            label="Message us on WhatsApp"
            href={WHATSAPP_GET_LISTED_URL}
            external
          />
          <Card
            emoji={'\u{1F511}'}
            title="Your organiser account"
            line="Sign in to edit your events and see who&rsquo;s going."
            label="Sign in"
            href={signInHref}
          />
          {flags.organiserTicketing && (
            <Card
              emoji={'\u{1F39F}\u{FE0F}'}
              title="Sell tickets"
              line="Sign in, open your event and switch tickets on."
              label="Sign in to sell tickets"
              href={signInHref}
            />
          )}
          {flags.rafflesPage && (
            <Card
              emoji={'\u{1F381}'}
              title="Run a raffle"
              line="Give away a prize at your night and pick the winner on the spot."
              label="See raffles"
              href="/raffles"
            />
          )}
        </ul>
      </main>
    </GlobalLayout>
  );
};

export default ForOrganisers;
