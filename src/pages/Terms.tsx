import { Link } from 'react-router-dom';
import { useSeo } from '@/lib/seo';
import { TERMS_VERSION } from '@/lib/legalVersions';
import { LegalShell, Section } from '@/pages/legal/LegalShell';

const Terms = () => {
  useSeo({
    title: 'Terms of use',
    description: 'The rules for using Bachata Calendar, the UK bachata community calendar.',
    noindex: false,
  });
  return (
    <LegalShell routeId="terms" title="Terms of use" updated={TERMS_VERSION}>
      <Section title="What this site is">
        <p>
          Bachata Calendar is a community calendar for bachata parties, classes and festivals in the UK. We list events
          and let dancers make a simple profile. We do not run the events.
        </p>
      </Section>

      <Section title="Accounts">
        <ul className="list-disc space-y-1 pl-5">
          <li>One person, one account. Do not share your sign-in.</li>
          <li>Keep your details accurate and up to date.</li>
          <li>Your profile photo must be a photo of you.</li>
        </ul>
      </Section>

      <Section title="Acceptable use">
        <ul className="list-disc space-y-1 pl-5">
          <li>No harassment, hate or threats.</li>
          <li>No pretending to be someone else.</li>
          <li>No spam, adverts or links in places meant for people.</li>
          <li>No uploading anything you do not have the right to share.</li>
        </ul>
      </Section>

      <Section title="Events and organisers">
        <p>
          Organisers are responsible for their own events and for the details they list. We cannot guarantee that an
          event happens as listed (time, place, price or line-up can change). Check with the organiser before you travel.
        </p>
      </Section>

      <Section title="Removing content and accounts">
        <p>
          We can remove content, hide a profile or close an account that breaks these rules. You can delete your own
          account any time in Account settings.
        </p>
      </Section>

      <Section title="Changes">
        <p>
          We may change these terms. The date above shows the latest version. If a change matters, we will ask you to
          accept it again. How we handle your data is in the <Link to="/privacy" className="underline">Privacy page</Link>.
        </p>
      </Section>
    </LegalShell>
  );
};

export default Terms;
