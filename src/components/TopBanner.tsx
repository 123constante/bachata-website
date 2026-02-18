import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TopBannerProps {
  label?: string;
  title: string;
  description?: string;
  primaryCtaText?: string;
  primaryCtaLink?: string;
  secondaryCtaText?: string;
  secondaryCtaLink?: string;
  finePrint?: string;
  onDismiss?: () => void;
}

const TopBanner = ({ 
  label,
  title,
  description,
  primaryCtaText,
  primaryCtaLink,
  secondaryCtaText,
  secondaryCtaLink,
  finePrint,
  onDismiss 
}: TopBannerProps) => {
  const [isVisible, setIsVisible] = useState(true);

  const handleDismiss = () => {
    setIsVisible(false);
    onDismiss?.();
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="mx-3 mt-3 rounded-xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10"
          style={{ 
            background: 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary) / 0.85) 100%)',
          }}
        >
          <div className="px-3 py-2.5">
            {/* Compact header with label and X */}
            <div className="flex items-center justify-between gap-2 mb-1">
              {label && (
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary-foreground/80">
                  {label}
                </span>
              )}
              <button
                onClick={handleDismiss}
                className="p-0.5 -m-0.5 text-primary-foreground/60 hover:text-primary-foreground transition-colors"
                aria-label="Dismiss banner"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Title - compact */}
            <h3 className="text-sm font-bold text-primary-foreground leading-snug mb-1">
              {title}
            </h3>

            {/* Description - compact */}
            {description && (
              <p className="text-xs text-primary-foreground/80 mb-2 leading-tight">
                {description}
              </p>
            )}

            {/* CTA Buttons - inline and compact */}
            {(primaryCtaText || secondaryCtaText) && (
              <div className="flex items-center gap-2 mb-1.5">
                {primaryCtaText && primaryCtaLink && (
                  <Button 
                    asChild
                    size="sm"
                    className="h-7 text-xs bg-primary-foreground text-primary hover:bg-primary-foreground/90 font-bold px-3 rounded-full"
                  >
                    <a href={primaryCtaLink}>{primaryCtaText}</a>
                  </Button>
                )}
                {secondaryCtaText && secondaryCtaLink && (
                  <a 
                    href={secondaryCtaLink}
                    className="text-xs font-semibold text-primary-foreground/90 hover:text-primary-foreground hover:underline"
                  >
                    {secondaryCtaText}
                  </a>
                )}
              </div>
            )}

            {/* Fine print - very small */}
            {finePrint && (
              <p className="text-[9px] text-primary-foreground/60 leading-tight">
                {finePrint}
              </p>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export { TopBanner };
