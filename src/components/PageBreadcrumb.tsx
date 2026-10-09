import { Fragment } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, ChevronRight } from 'lucide-react';
import { motion } from 'framer-motion';
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { renderBreadcrumbListJsonLd } from '@/lib/breadcrumbs';
import { SITE_ORIGIN } from '@/lib/seo';

// The fade-in sits on the <li> elements themselves: a wrapper <div> between
// the <ol> and its <li>s (even display:contents) is broken list markup that
// axe reports as list/listitem on every page with a breadcrumb.
const MotionItem = motion.create(BreadcrumbItem);
const MotionSeparator = motion.create(BreadcrumbSeparator);
const enter = (delay: number) => ({
  initial: { opacity: 0, x: -10 },
  animate: { opacity: 1, x: 0 },
  transition: { duration: 0.3, delay },
});

export interface BreadcrumbItemType {
  label: string;
  path?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItemType[]; tone?: 'default' | 'onDark';
}

const PageBreadcrumb = ({ items, tone = 'default' }: PageBreadcrumbProps) => {
  const location = useLocation(); const onDark = tone === 'onDark'; const linkCls = onDark ? 'text-[#f5c518] hover:text-white transition-colors' : 'text-muted-foreground hover:text-primary transition-colors'; const sepCls = onDark ? 'text-[#ff5a1f]' : 'text-primary/50'; const curCls = onDark ? 'text-[#fbf8f1]' : 'text-foreground';

  // Schema.org BreadcrumbList — search engines render breadcrumb-style
  // result links from this. Origin is read at render time so SSR / static
  // hosting environments resolve correctly. The current URL is used for the
  // last crumb's `item` field (the visible breadcrumb omits path on the
  // current page, but search engines still want an absolute URL there).
  // Canonical production origin — never the localhost prerender host. This JSON-LD
  // is baked into build-time snapshots, so window.location.origin would ship
  // "http://localhost:4173" to Google (see R3). SITE_ORIGIN is the www host.
  const origin = SITE_ORIGIN;
  const currentUrl = origin + location.pathname + (location.search || '');
  const jsonLd = renderBreadcrumbListJsonLd({
    crumbs: items,
    origin,
    currentUrl,
  });

  return (
    <div className="px-4 py-1.5 md:py-3 max-w-7xl mx-auto">
      {/*
        Schema.org BreadcrumbList for SEO. Renders as a hidden <script> so
        Google can read the breadcrumb without affecting layout. See
        https://developers.google.com/search/docs/appearance/structured-data/breadcrumb
      */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: jsonLd }}
      />
      <Breadcrumb>
        <BreadcrumbList>
          {/* Home — icon + label, both visible on every screen size. */}
          <MotionItem {...enter(0)}>
            <BreadcrumbLink asChild>
              <Link
                to="/"
                className={`flex items-center gap-1 ${linkCls}`}
              >
                <Home className="w-3.5 h-3.5" />
                <span>Home</span>
              </Link>
            </BreadcrumbLink>
          </MotionItem>

          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const staggerDelay = (index + 1) * 0.08;

            return (
              <Fragment key={item.label}>
                <MotionSeparator {...enter(staggerDelay)}>
                  <ChevronRight className={`w-3.5 h-3.5 ${sepCls}`} />
                </MotionSeparator>

                <MotionItem {...enter(staggerDelay)}>
                  {isLast || !item.path ? (
                    <BreadcrumbPage className={`${curCls} font-medium truncate max-w-[150px] md:max-w-none`}>
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        to={item.path}
                        className={`${linkCls} truncate max-w-[100px] md:max-w-none`}
                      >
                        {item.label}
                      </Link>
                    </BreadcrumbLink>
                  )}
                </MotionItem>
              </Fragment>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default PageBreadcrumb;
