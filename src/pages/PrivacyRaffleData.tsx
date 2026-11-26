import GlobalLayout from '@/components/layout/GlobalLayout';
import { buildBreadcrumbs } from '@/lib/breadcrumbs';
import { useSeo } from '@/lib/seo';
import { flags } from '@/lib/featureFlags';
import { ACCOUNT_CONTACT_EMAIL } from '@/lib/accountDeletionCopy';
import NotFound from '@/pages/NotFound';

const MAILTO = `mailto:${ACCOUNT_CONTACT_EMAIL}?subject=${encodeURIComponent('Raffle data request')}`;

const PrivacyRaffleData = () => {
  useSeo({ title: 'Raffle data request', description: 'Ask us to erase or send you a copy of your raffle data.', noindex: true });
  if (!flags.rafflePrivacyLine) return <NotFound />;
  return (
    <GlobalLayout breadcrumbs={buildBreadcrumbs('privacy')}>
      <article className="mx-auto w-full max-w-2xl space-y-4 px-4 pb-24 pt-3 text-sm text-foreground" data-testid="privacy-raffle-data">
        <h1 className="text-lg font-bold">Your raffle data</h1>
        <p>Send us the phone number you entered the raffle with.</p>
        <p>Say &ldquo;erase&rdquo; or &ldquo;copy&rdquo;, and we will reply within 30 days.</p>
        <a
          href={MAILTO}
          className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground"
        >
          Email us
        </a>
      </article>
    </GlobalLayout>
  );
};

export default PrivacyRaffleData;
