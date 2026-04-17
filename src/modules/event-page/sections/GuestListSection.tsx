import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useEventGuestList } from '@/modules/event-page/hooks/useEventGuestList';
import { useSubmitGuestListEntry } from '@/modules/event-page/hooks/useSubmitGuestListEntry';

type GuestListSectionProps = {
  eventId: string | null;
};

export const GuestListSection = ({ eventId }: GuestListSectionProps) => {
  const { data } = useEventGuestList(eventId);
  const submit = useSubmitGuestListEntry(eventId);
  const [name, setName] = useState('');
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);

  if (!data || !data.enabled) return null;

  const { count, entries, config, cutoff_passed } = data;

  const hasGuestPrice = typeof config.guest_list_price === 'number';
  const hasRegularPrice = typeof config.regular_price === 'number';
  const showPriceBlock = hasGuestPrice;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed || submit.isPending) return;
    try {
      const result = await submit.mutateAsync(trimmed);
      if (result.ok) {
        setJustAdded(trimmed);
        setDuplicateName(null);
        setName('');
      } else if (result.reason === 'duplicate_name') {
        setDuplicateName(trimmed.toLowerCase());
        setJustAdded(null);
      }
    } catch {
      // Toast already shown by onError
    }
  };

  return (
    <section className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 shadow-[0_10px_35px_rgba(0,0,0,0.28)] backdrop-blur-sm">
      <div className="mb-2 flex items-center gap-2">
        <ClipboardList className="h-3.5 w-3.5 text-white/45" />
        <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">Guest List</p>
      </div>

      {/* Price benefit */}
      {showPriceBlock && (
        <div className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm">
          {config.guest_list_price === 0 ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-emerald-400">Free entry</span>
              {hasRegularPrice && (config.regular_price ?? 0) > 0 && (
                <span className="text-xs text-white/40 line-through">£{config.regular_price}</span>
              )}
            </div>
          ) : hasRegularPrice &&
            (config.regular_price ?? 0) > (config.guest_list_price ?? 0) ? (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-emerald-400">£{config.guest_list_price} entry</span>
              <span className="text-xs text-white/40 line-through">£{config.regular_price}</span>
              <span className="text-[11px] text-emerald-400/80">
                Save £{(config.regular_price ?? 0) - (config.guest_list_price ?? 0)}
              </span>
            </div>
          ) : (
            <span className="font-semibold text-white">£{config.guest_list_price} entry</span>
          )}
          {config.discount_until && (
            <p className="mt-1 text-[11px] text-white/50">Arrive before {config.discount_until}</p>
          )}
        </div>
      )}
      {!showPriceBlock && config.discount_until && (
        <p className="mb-3 text-[11px] text-white/50">Arrive before {config.discount_until}</p>
      )}

      {/* Closed state */}
      {cutoff_passed ? (
        <p className="mb-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-sm text-white/70">
          Guest list is now closed.
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="mb-3 flex flex-col gap-2 sm:flex-row">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your first name"
            disabled={submit.isPending}
            maxLength={60}
            className="bg-white/[0.06] border-white/10 text-white placeholder:text-white/40"
          />
          <Button
            type="submit"
            disabled={!name.trim() || submit.isPending}
            className="shrink-0"
          >
            {submit.isPending ? 'Adding…' : 'Add My Name'}
          </Button>
        </form>
      )}

      {/* Name pills */}
      {entries.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {entries.map((entry, idx) => {
            const lower = entry.first_name.toLowerCase();
            const isJustAdded = justAdded && lower === justAdded.toLowerCase();
            const isDuplicate = duplicateName && lower === duplicateName;
            return (
              <span
                key={`${entry.first_name}-${entry.created_at}-${idx}`}
                className={cn(
                  'rounded-full border px-2.5 py-0.5 text-xs transition-all',
                  isJustAdded &&
                    'border-emerald-400/60 bg-emerald-400/10 text-emerald-200 shadow-[0_0_12px_rgba(52,211,153,0.35)]',
                  isDuplicate &&
                    'border-orange-400/60 bg-orange-400/10 text-orange-200 animate-pulse',
                  !isJustAdded &&
                    !isDuplicate &&
                    'border-white/10 bg-white/[0.04] text-white/70',
                )}
              >
                {entry.first_name}
              </span>
            );
          })}
        </div>
      ) : (
        !cutoff_passed && (
          <p className="text-xs italic text-white/45">Be the first on the list.</p>
        )
      )}

      {count > 0 && (
        <p className="mt-2 text-[10px] text-white/40">
          {count} {count === 1 ? 'name' : 'names'} on the list
        </p>
      )}
    </section>
  );
};
