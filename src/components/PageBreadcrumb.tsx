import { Link } from 'react-router-dom';
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

export interface BreadcrumbItemType {
  label: string;
  path?: string;
}

interface PageBreadcrumbProps {
  items: BreadcrumbItemType[];
}

const PageBreadcrumb = ({ items }: PageBreadcrumbProps) => {
  return (
    <div className="px-4 py-1.5 md:py-3 max-w-7xl mx-auto">
      <Breadcrumb>
        <BreadcrumbList>
          {/* Home */}
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
                  className="flex items-center gap-1 text-muted-foreground hover:text-primary transition-colors"
                >
                  <Home className="w-3.5 h-3.5" />
                  <span className="sr-only md:not-sr-only">Home</span>
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
                  <ChevronRight className="w-3.5 h-3.5 text-primary/50" />
                </BreadcrumbSeparator>

                <BreadcrumbItem>
                  {isLast || !item.path ? (
                    <BreadcrumbPage className="text-foreground font-medium truncate max-w-[150px] md:max-w-none">
                      {item.label}
                    </BreadcrumbPage>
                  ) : (
                    <BreadcrumbLink asChild>
                      <Link
                        to={item.path}
                        className="text-muted-foreground hover:text-primary transition-colors truncate max-w-[100px] md:max-w-none"
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
