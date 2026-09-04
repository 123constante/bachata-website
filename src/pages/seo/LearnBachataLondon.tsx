/**
 * LearnBachataLondon.tsx  ->  /learn-bachata-london
 *
 * Beginner pillar (SEO plan 2.4). Targets "bachata london for beginners",
 * "learn bachata london", "is bachata hard". Modelled on the weekday/guide
 * pattern: evergreen how-to prose + a live "Beginner classes this month"
 * section pulled from the calendar (classesOnly), so the page carries
 * freshness without hardcoding prices or dates. FAQPage JSON-LD covers the
 * beginner People-Also-Ask cluster (kept for AI Overview / on-page text;
 * FAQ rich results were retired by Google in 2026).
 */

import { Link } from "react-router-dom";
import GlobalLayout from "@/components/layout/GlobalLayout";
import { SITE_ORIGIN, type SeoInput } from "@/lib/seo";
import { buildOrganizationJsonLd } from "@/lib/buildOrganizationJsonLd";
import LiveEventsSection from "@/components/seo/LiveEventsSection";
import { SEO_LANDING_WINDOWS } from "@/lib/seoLandingEvents";

const CANONICAL = `${SITE_ORIGIN}/learn-bachata-london`;
const LAST_UPDATED_ISO = "2026-06-17";
const LAST_UPDATED_LABEL = "June 2026";

// Beginner-focused Q&A -> rendered on-page AND emitted as FAQPage JSON-LD.
const FAQS: { q: string; a: string }[] = [
  {
    q: "Is bachata hard to learn for a total beginner?",
    a: "No. Bachata is one of the easiest partner dances to start. The basic step is a simple side-to-side weight shift on counts one, two, three, tap. Most London schools run dedicated beginner classes that assume zero experience, and you can pick up the basic in your first hour.",
  },
  {
    q: "Do I need a partner to learn bachata in London?",
    a: "No. Almost every beginner class in London rotates partners every couple of minutes, so turning up alone is completely normal. You will dance with most of the room across the hour and never need to bring anyone.",
  },
  {
    q: "How many classes until I can social dance?",
    a: "Most beginners feel comfortable on a social floor after four to eight weeks of weekly classes. A short progressive course is usually enough to be confident at a beginner-friendly social, and staying for the social after class is the fastest way to improve.",
  },
  {
    q: "How much do beginner bachata classes cost in London?",
    a: "Drop-in classes are typically 10 to 18 pounds. Block courses of four to six weeks usually work out cheaper per class, and many schools include free entry to that night's social with a class ticket.",
  },
  {
    q: "What should I wear and bring to my first class?",
    a: "Comfortable clothes you can move in, plus shoes with a smooth sole that lets you turn. London's studios run wood or sprung floors, so grippy trainers can fight you. Bring water; you will warm up quickly.",
  },
];

const FaqJsonLd = () => {
  const payload = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: FAQS.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
};

const ArticleJsonLd = () => {
  const org = buildOrganizationJsonLd();
  const payload = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: "Learn Bachata in London - The Beginner's Guide",
    description:
      "How to start bachata in London as a complete beginner: what the first class is like, what to wear, what it costs, and where to find beginner classes.",
    inLanguage: "en-GB",
    mainEntityOfPage: { "@type": "WebPage", "@id": CANONICAL },
    url: CANONICAL,
    dateModified: LAST_UPDATED_ISO,
    author: {
      "@type": "Organization",
      name: "Bachata Community UK",
      url: SITE_ORIGIN,
    },
    publisher: org,
    image: `${SITE_ORIGIN}/og-image.jpg`,
  };
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(payload) }}
    />
  );
};

// The head input for this page. Its sole consumer is the framework route's meta()
// (app/routes/learn-bachata-london.tsx); it was shared with a client useSeo() call
// here too until arc W22 deleted that call as inert.
export const SEO_INPUT: SeoInput = {
  title: "Learn Bachata in London - The Beginner's Guide",
  description:
    "How to start bachata in London as a complete beginner: what the first class is like, what to wear, what it costs, and where to find beginner classes near you.",
  canonical: CANONICAL,
  ogType: "article",
};

/**
 * `serverTodayKey` is the London date key the route loader rendered on. Load-
 * bearing: the live-events window -- and so the query key of the dehydrated
 * list -- derives from it, and this document is edge-cached for an hour and
 * served stale for a day. See LiveEventsSectionProps.serverTodayKey.
 */
const LearnBachataLondon = ({ serverTodayKey }: { serverTodayKey?: string }) => {
  // No useSeo() here: this page renders only under app/routes/learn-bachata-london.tsx,
  // which wraps in InitialVisiblePageTransition and so sets RouteOwnsHeadContext --
  // useSeo returns before touching the head. That route's meta() owns it, from
  // SEO_INPUT above. Which useSeo calls are inert and which are live is a census,
  // not a rule of thumb -- see BentoPage.tsx before deleting another (arc W22).

  return (
    <GlobalLayout showSubheader={false}>
      <ArticleJsonLd />
      <FaqJsonLd />
      <article className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        <header className="space-y-3">
          <h1 className="text-3xl sm:text-5xl font-black tracking-tight leading-[1.05]">
            Learn Bachata in London &mdash; The Beginner&rsquo;s Guide
          </h1>
          <p className="text-base text-muted-foreground">
            Never danced before? Bachata is one of the easiest partner dances to start, and London has a beginner class running almost every night of the week. Here&rsquo;s exactly how to begin.
          </p>
          <p className="text-xs text-muted-foreground">
            Written and kept up to date by the Bachata Community UK team. Last updated: {LAST_UPDATED_LABEL}.
          </p>
        </header>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Why bachata is a good first dance</h2>
          <p className="leading-relaxed">
            Bachata starts simpler than almost any other partner dance. The foundation is a side-to-side step over four counts &mdash; one, two, three, and a small tap or hip on four &mdash; and you can be doing it to music inside your first class. There&rsquo;s no need to memorise a routine, no need for a partner, and no dress code beyond shoes you can turn in. Because the basic is so forgiving, beginners get to the fun part &mdash; actually dancing with another person to a song &mdash; far faster than in salsa or ballroom. London makes it easy too: there are beginner-friendly classes on most nights, spread across the city, so there&rsquo;s almost always one near you this week.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">What your first class is actually like</h2>
          <p className="leading-relaxed">
            A typical London beginner class runs for an hour. You arrive a few minutes early, pay at the door, and join two facing lines &mdash; leaders on one side, followers on the other. The teacher walks everyone through the footwork first, then adds a simple turn or two, then puts it to music. Almost every school rotates partners every couple of minutes, so you are never stuck with one person and you meet most of the room inside the hour. That rotation is exactly what makes it easy for nervous beginners: everyone is learning together, nobody expects you to be good yet, and you get a fresh start every couple of minutes.
          </p>
          <p className="leading-relaxed">
            Many beginner classes are followed by a social &mdash; the floor opens up, a DJ takes over, and people dance freely for the rest of the night. You are never obliged to stay, but staying for even half an hour is the fastest way to turn what you just learned into something that sticks. At some nights, like Rogue Bachata, the class is followed by a free social, so you pay for the lesson and the dancing afterwards costs nothing.
          </p>
        </section>

        <LiveEventsSection
          heading="Beginner classes this month"
          windowDays={SEO_LANDING_WINDOWS.learn}
          serverTodayKey={serverTodayKey}
          classesOnly
          limit={12}
          emptyText={
            <>
              No classes listed in the next few weeks just now &mdash; browse the full{' '}
              <Link to="/classes" className="text-primary underline">Classes page</Link>{' '}or see what&rsquo;s on{' '}
              <Link to="/tonight" className="text-primary underline">tonight</Link>.
            </>
          }
        />
        <p className="text-sm text-muted-foreground -mt-4">
          Classes are pulled live from the calendar. Look for ones marked as beginner or Level 1 &mdash; full details, prices and times are on each event page and the{' '}
          <Link to="/classes" className="text-primary underline">Classes page</Link>.
        </p>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Drop-in or a course block?</h2>
          <p className="leading-relaxed">
            If you&rsquo;ve never danced bachata, a structured course usually beats a one-off drop-in: you build the basic step, the lead-and-follow frame and a little musicality over a few weeks instead of being thrown in cold. London&rsquo;s progressive courses run beginner classes back-to-back with higher levels, so you can move up without changing school. A fixed block &mdash; say five weeks &mdash; also gives you a reason to keep coming back, which is what actually turns a curious first night into a habit.
          </p>
          <p className="leading-relaxed">
            That said, a drop-in is the lowest-commitment way to try it once. If you&rsquo;re not sure bachata is for you, find a beginner-friendly drop-in this week, see how it feels, and commit to a course afterwards if you enjoyed it. Either way, prices are modest &mdash; see the costs question below.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Sensual or Dominican &mdash; which should a beginner pick?</h2>
          <p className="leading-relaxed">
            Bachata splits into two broad styles. <em>Dominican</em> is the original style &mdash; faster footwork, free improvisation, less torso movement. <em>Sensual</em> is the modern European style &mdash; slower, with body waves, dips and choreographed turn patterns. As a beginner you don&rsquo;t have to choose: most London rooms play both, and a general beginners&rsquo; course will expose you to each so you can specialise later. Start with whatever class is nearest and friendliest; you&rsquo;ll quickly work out which one you enjoy. The{' '}
            <Link to="/london-bachata-guide" className="text-primary underline">London bachata guide</Link>{' '}explains the styles and the venues in more depth.
          </p>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Common questions from beginners</h2>
          <dl className="space-y-4">
            {FAQS.map(({ q, a }) => (
              <div key={q}>
                <dt className="font-semibold">{q}</dt>
                <dd className="leading-relaxed text-muted-foreground mt-1">{a}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="space-y-3">
          <h2 className="text-2xl font-bold">Where to go next</h2>
          <p className="leading-relaxed">
            Ready to pick a night? Browse beginner-friendly options on the{' '}
            <Link to="/classes" className="text-primary underline">Classes page</Link>, see what&rsquo;s on this evening on the{' '}
            <Link to="/tonight" className="text-primary underline">Tonight page</Link>, read the full{' '}
            <Link to="/london-bachata-guide" className="text-primary underline">London bachata guide</Link>{' '}for the styles, venues and weekly rhythm, or check the{' '}
            <Link to="/faq" className="text-primary underline">FAQ</Link>{' '}for everything else first-timers ask.
          </p>
        </section>
      </article>
    </GlobalLayout>
  );
};

export default LearnBachataLondon;
