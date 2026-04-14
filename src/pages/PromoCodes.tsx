import { useState } from 'react';
import { Tag, Copy, Check, ExternalLink, Loader2 } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { usePublicPromoCodes, type PublicPromoCode } from '@/hooks/usePublicPromoCodes';

const PromoCodeCard = ({ promo }: { promo: PublicPromoCode }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(promo.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for browsers without clipboard API
      const el = document.createElement('textarea');
      el.value = promo.code;
      el.style.position = 'fixed';
      el.style.opacity = '0';
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* Title */}
        <div className="space-y-1">
          <p className="font-semibold text-base leading-tight">{promo.title}</p>
          {promo.owner_display_name && (
            <p className="text-xs text-muted-foreground">by {promo.owner_display_name}</p>
          )}
        </div>

        {/* Description */}
        {promo.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">{promo.description}</p>
        )}

        {/* Code — tap to copy */}
        <button
          onClick={handleCopy}
          className="w-full flex items-center justify-between gap-3 rounded-lg border-2 border-dashed border-primary/40 bg-primary/5 px-4 py-3 hover:bg-primary/10 active:scale-[0.98] transition-all cursor-pointer"
        >
          <span className="font-mono font-bold text-lg tracking-widest text-primary">{promo.code}</span>
          <span className="flex items-center gap-1 text-xs font-medium text-muted-foreground shrink-0">
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-green-600" />
                <span className="text-green-600">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </span>
        </button>

        {/* External link */}
        {promo.external_url && (
          <Button asChild variant="outline" className="w-full gap-2">
            <a href={promo.external_url} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4" />
              Use this code
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
};

const PromoCodes = () => {
  const { data: promoCodes, isLoading, isError } = usePublicPromoCodes();

  return (
    <div className="min-h-screen pt-[85px] pb-24 px-4">
      <div className="max-w-lg mx-auto space-y-6 pt-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-2">
            <Tag className="w-6 h-6 text-primary" />
          </div>
          <h1 className="text-3xl font-bold tracking-tight">Promo Codes</h1>
          <p className="text-muted-foreground text-sm">
            Tap a code to copy it, then use it at checkout.
          </p>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="flex justify-center py-14">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        )}

        {/* Error */}
        {isError && (
          <Card className="border-destructive/30">
            <CardContent className="py-10 text-center text-sm text-muted-foreground">
              Could not load promo codes. Please try again later.
            </CardContent>
          </Card>
        )}

        {/* Promo code list */}
        {!isLoading && !isError && promoCodes && promoCodes.length > 0 && (
          <div className="space-y-4">
            {promoCodes.map((promo) => (
              <PromoCodeCard key={promo.id} promo={promo} />
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && promoCodes && promoCodes.length === 0 && (
          <Card className="border-dashed border-2 border-primary/20">
            <CardContent className="py-14 flex flex-col items-center gap-3 text-center">
              <Tag className="w-8 h-8 text-muted-foreground/40" />
              <p className="font-medium text-muted-foreground">No promo codes available right now</p>
              <p className="text-sm text-muted-foreground/60">
                Featured offers and partner discounts will appear here.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default PromoCodes;
