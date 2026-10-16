import { Link } from 'react-router-dom';
import { useSeo } from '@/lib/seo';
import { PRIVACY_VERSION } from '@/lib/legalVersions';
import { ACCOUNT_SETTINGS_PATH } from '@/lib/accountRouting';
import { LegalShell, Section } from '@/pages/legal/LegalShell';
import { ACCOUNT_SETTINGS_LABEL, HIDDEN_STATE_WORD } from '@/modules/dancer-app/copy/sharedCopy';

const Privacy = () => {
  useSeo({
    title: 'Privacy',
    description: 'What Bachata Calendar stores about you, what is public, and how to download or delete your data.',
    noindex: false,
  });
  return (
    <LegalShell routeId="privacy" title="Privacy" updated={PRIVACY_VERSION}>
      <p>
        Short version: we keep what you give us to run your account, we show only the parts you choose to show, and you
        can download your data or delete your account yourself.
      </p>

      <Section title="What an account stores">
        <ul className="list-disc space-y-1 pl-5">
          <li>Your e-mail address (to sign you in). It is never shown on your profile.</li>
          <li>
            Your dancer profile: display name, first name, surname, city, dance role, nationality, languages, short bio,
            years dancing, favourite styles and songs, achievements, Instagram, Facebook and website links.
          </li>
          <li>Your profile photo.</li>
          <li>A WhatsApp number, only if you add one, and only for people who also teach, DJ or organise.</li>
        </ul>
      </Section>

      <Section title="What is public and what is private">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Public on your profile page: display name, first name, surname (unless you switch on &ldquo;hide surname&rdquo;),
            city, role, photo, bio and the links you added.
          </li>
          <li>WhatsApp is shown publicly only if you switch &ldquo;show WhatsApp publicly&rdquo; on. Your e-mail is never shown.</li>
          <li>Your nights (going or interested) are private to you. Only anonymous totals per event are shown to others.</li>
          <li>
            You can hide your whole profile at any time, and show it again whenever you like. While it is {HIDDEN_STATE_WORD},
            only you can see it.
          </li>
        </ul>
      </Section>

      <Section title="Other things we record">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Profile views: when someone opens a profile we count a view (profile, a random per-visit id, the page it
            came from and the browser name). It is used for simple totals.
          </li>
          <li>Nights: which events you marked as going or interested, and any party-level ratings you give.</li>
          <li>
            Feedback messages you send us, and sign-ups you make to be told about new features, with the e-mail of your account.
          </li>
          <li>Photo flags: if someone reports a photo, we keep the report so we can review it.</li>
          <li>
            Consent records: the date and version of the Terms and Privacy text you accepted.
          </li>
          <li>
            Rate-limit records: a short log of recent actions (for example saving your profile) so nobody can flood the
            site. These are kept for 30 days.
          </li>
          <li>
            Error reports: when the site breaks, an anonymous message (error name, first line, page path) is sent so we
            can fix it. No names, e-mails or form contents are included.
          </li>
        </ul>
      </Section>

      <Section title="Cookies and analytics">
        <p>
          We do not use advertising or tracking cookies, and we do not load third-party analytics scripts. Your browser
          local storage keeps: your sign-in session, the city you picked, your last sign-in e-mail (to save typing) and
          where to send you after signing in. These are needed for the site to work. Simple usage events stay
          within our own site; none are sent to an analytics company.
        </p>
        <p>
          The site is hosted on Vercel, and accounts and data are held with Supabase. They process data for us under their own terms.
        </p>
      </Section>

      <Section title="Download or delete your data">
        <p>
          Go to <Link to={ACCOUNT_SETTINGS_PATH} className="underline">{ACCOUNT_SETTINGS_LABEL}</Link> (also under Options in the
          dancer area). There you can download everything we hold about you, hide your profile, or delete your account.
        </p>
        <p>
          When you delete your account, it is hidden from everyone at once: your profile, name and photo are no longer
          shown anywhere public. If you sign in again within 30 days, your account is restored.
        </p>
        <p>
          After 30 days your account stays hidden and we keep your data. We do not erase it automatically.
        </p>
        <p>
          If you want your data permanently erased, you can ask us to erase your data permanently at the contact address
          below (your right to erasure under UK GDPR and GDPR Art. 17). We erase it by hand and confirm to you when it is done.
        </p>
      </Section>

      <Section title="Your rights">
        <p>
          You can ask us to see, correct or erase your data, or object to how we use it. Use the settings above or contact us below. You can
          also complain to the Information Commissioner&rsquo;s Office (ico.org.uk).
        </p>
      </Section>

      <Section title="How long we keep things">
        <p>
          Account data (your profile, photo, nights and ratings) is kept until you ask us to erase it, including after
          you delete your account. Rate-limit records are kept for 30 days, as listed above.
        </p>
      </Section>

      <p className="text-xs text-muted-foreground">
        See also our <Link to="/terms" className="underline">Terms of use</Link>. We will update the date above when this page changes.
      </p>
    </LegalShell>
  );
};

export default Privacy;
