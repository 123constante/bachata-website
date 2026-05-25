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
  const origin =
    typeof window !== 'undefined' && window.location
      ? window.location.origin
      : '';
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
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3, delay: 0 }}
            className="contents"
          >
            <BreadcrumbItem>
              <BreadcrumbLink asChild>
                <Link
                  to="/"
                  className={`flex items-center gap-1 ${linkCls}`}
                >
                  <Home className="w-3.5 h-3.5" />
                  <span>Home</span>
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
          </motion.div>

          {items.map((item, index) => {
            const isLast = index === items.length - 1;
            const staggerDelay = (index + 1) * 0.08;

            return (
              <motion.div
                key={item.label}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: staggerDelay }}
                className="contents"
              >
                <BreadcrumbSeparator>
                  <ChevronRight className={`w-3.5 h-3.5 ${sepCls}`} />
                </BreadcrumbSeparator>

                <BreadcrumbItem>
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
                </BreadcrumbItem>
              </motion.div>
            );
          })}
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
};

export default PageBreadcrumb;
