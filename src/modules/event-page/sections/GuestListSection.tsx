import { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { useEventGuestList, type GuestListConfig } from '@/modules/event-page/hooks/useEventGuestList';
import { useSubmitGuestListEntry } from '@/modules/event-page/hooks/useSubmitGuestListEntry';

type GuestListSectionProps = {
  eventId: string | null;
};

// Scoped styles for this section — shimmer keyframes, pill sweep, button sweep,
// and the "just added" glow. Injected once via a <style> tag; class names are
// prefixed with gl- to avoid collisions with the rest of the app.
const sectionStyles = `
  @keyframes gl-shimmer {
    0%   { background-position: -200% center; }
    100% { background-position: 200% center; }
  }
  @keyframes gl-sweep {
    0%   { transform: translateX(-100%); }
    100% { transform: translateX(200%); }
  }
  @keyframes gl-glow {
    0%, 100% { box-shadow: 0 0 0 rgba(245, 213, 99, 0.0); }
    50%      { box-shadow: 0 0 18px rgba(245, 213, 99, 0.55); }
  }
  @keyframes gl-duplicate-pulse {
    0%, 100% { background-color: rgba(197, 148, 10, 0.08); }
    50%      { background-color: rgba(245, 213, 99, 0.28); }
  }
  .gl-shimmer-text {
    background: linear-gradient(90deg, #c8940a, #f5d563, #ffe08a, #f5d563, #c8940a);
    background-size: 200% auto;
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
    animation: gl-shimmer 4s linear infinite;
  }
  .gl-pill {
    position: relative;
    overflow: hidden;
    background: rgba(197, 148, 10, 0.08);
    border: 0.5px solid rgba(245, 213, 99, 0.2);
    color: #f5d563;
  }
  .gl-pill::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(245, 213, 99, 0.18), transparent);
    transform: translateX(-100%);
    animation: gl-sweep 3.5s linear infinite;
    pointer-events: none;
  }
  .gl-pill-added {
    border-color: rgba(255, 224, 138, 0.7) !important;
    background: rgba(245, 213, 99, 0.18) !important;
    animation: gl-glow 1.4s ease-in-out 2;
  }
  .gl-pill-duplicate {
    border-color: rgba(255, 200, 90, 0.85) !important;
    animation: gl-duplicate-pulse 0.9s ease-in-out 3;
  }
  .gl-button {
    position: relative;
    overflow: hidden;
    background: linear-gradient(135deg, #b8860b, #d4a017, #c8940a);
    color: #fff;
    border: 0;
  }
  .gl-button:hover:not(:disabled) {
    background: linear-gradient(135deg, #c8940a, #e6b52c, #d4a017);
  }
  .gl-button::after {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.22), transparent);
    transform: translateX(-100%);
    animation: gl-sweep 2.8s linear infinite;
    pointer-events: none;
  }
  .gl-card {
    background: transparent;
    border: 0.5px solid rgba(197, 148, 10, 0.18);
    border-radius: 16px;
  }
  .gl-save-badge {
    background: rgba(29, 158, 117, 0.15);
    border: 0.5px solid rgba(29, 158, 117, 0.4);
    color: #5ee6b8;
  }
  .gl-input {
    background: rgba(0, 0, 0, 0.25) !important;
    border: 0.5px solid rgba(197, 148, 10, 0.3) !important;
    color: #fff !important;
    text-align: center;
  }
  .gl-input::placeholder {
    color: rgba(240, 230, 233, 0.35) !important;
    text-align: center;
  }
  .gl-input:focus-visible {
    border-color: rgba(245, 213, 99, 0.55) !important;
    outline: none;
    box-shadow: 0 0 0 1px rgba(245, 213, 99, 0.25) !important;
  }
`;

const MUTED_PRIMARY = 'rgba(240, 230, 233, 0.45)';
const MUTED_SECONDARY = 'rgba(240, 230, 233, 0.35)';
const STRIKE = 'rgba(240, 230, 233, 0.3)';

type PriceTierProps = {
  label: string;
  regular: number | null;
  guestList: number | null;
};

const PriceTier = ({ label, regular, guestList }: PriceTierProps) => {
  if (regular == null) return null;
  const hasSave = typeof guestList === 'number' && regular > guestList;
  const displayPrice = typeof guestList === 'number' ? guestList : regular;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 py-1">
      <span className="text-xs" style={{ color: MUTED_PRIMARY }}>{label}</span>
      <span className="gl-shimmer-text text-[17px] font-bold">£{displayPrice}</span>
      {hasSave && (
        <>
          <span className="text-[11px] line-through" style={{ color: STRIKE }}>
            £{regular}
          </span>
          <span className="gl-save-badge rounded-full px-2 py-0.5 text-[10px] font-semibold">
            Save £{regular - (guestList as number)}
          </span>
        </>
      )}
    </div>
  );
};

const shouldRenderPrices = (config: GuestListConfig) =>
  config.regular_party_price != null || config.regular_class_party_price != null;

export const GuestListSection = ({ eventId }: GuestListSectionProps) => {
  const { data } = useEventGuestList(eventId);
  const submit = useSubmitGuestListEntry(eventId);
  const [name, setName] = useState('');
  const [justAdded, setJustAdded] = useState<string | null>(null);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);

  if (!data || !data.enabled) return null;

  const { count, entries, config, cutoff_passed } = data;
  const hasPrices = shouldRenderPrices(config);
  const hasDescription = Boolean(config.description && config.description.trim());
  const hasArriveBefore = Boolean(config.discount_until && config.discount_until.trim());

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
      // toast already surfaced in the mutation hook
    }
  };

  return (
    <section className="gl-card p-3 text-center">
      <style>{sectionStyles}</style>

      {/* Header */}
      <div className="mb-4 flex items-center justify-center gap-2">
        <ClipboardList className="h-3.5 w-3.5" style={{ color: MUTED_PRIMARY }} />
        <p className="text-[10px] uppercase tracking-[0.18em]" style={{ color: MUTED_PRIMARY }}>
          Guest List
        </p>
      </div>

      {/* Price tiers */}
      {hasPrices && (
        <div className="mb-4 space-y-1">
          <PriceTier
            label="Party only"
            regular={config.regular_party_price}
            guestList={config.guest_list_party_price}
          />
          <PriceTier
            label="Class + party"
            regular={config.regular_class_party_price}
            guestList={config.guest_list_class_party_price}
          />
        </div>
      )}

      {/* Arrive before */}
      {hasArriveBefore && (
        <p className="mt-2 mb-3 text-center text-[10px]" style={{ color: MUTED_SECONDARY }}>
          Arrive before {config.discount_until}
        </p>
      )}

      {/* Description */}
      {hasDescription && (
        <p
          className="mx-auto mb-4 max-w-md text-center"
          style={{ color: 'rgba(240, 230, 233, 0.5)', fontSize: '13px', lineHeight: 1.8 }}
        >
          {config.description.split('\n').map((line, i, arr) => (
            <span key={i}>
              {line}
              {i < arr.length - 1 && <br />}
            </span>
          ))}
        </p>
      )}

      {/* Input form OR closed message */}
      {cutoff_passed ? (
        <p className="mt-2 mb-4 text-center text-[10px]" style={{ color: MUTED_PRIMARY }}>
          Guest list is now closed
        </p>
      ) : (
        <form
          onSubmit={handleSubmit}
          className="mx-auto mb-4 flex max-w-[400px] flex-row items-center gap-2"
        >
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Enter your first name"
            disabled={submit.isPending}
            maxLength={60}
            className="gl-input h-9 flex-1 py-2"
          />
          <Button
            type="submit"
            disabled={!name.trim() || submit.isPending}
            className="gl-button h-9 shrink-0 py-2 font-semibold"
          >
            {submit.isPending ? 'Adding…' : 'Add My Name'}
          </Button>
        </form>
      )}

      {/* Name pills */}
      {entries.length > 0 ? (
        <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5">
          {entries.map((entry, idx) => {
            const lower = entry.first_name.toLowerCase();
            const isJustAdded = justAdded && lower === justAdded.toLowerCase();
            const isDuplicate = duplicateName && lower === duplicateName;
            return (
              <span
                key={`${entry.first_name}-${entry.created_at}-${idx}`}
                className={cn(
                  'gl-pill rounded-full px-2.5 py-0.5 text-xs font-medium',
                  isJustAdded && 'gl-pill-added',
                  isDuplicate && 'gl-pill-duplicate',
                )}
              >
                <span className="relative z-10">{entry.first_name}</span>
              </span>
            );
          })}
        </div>
      ) : (
        !cutoff_passed && (
          <p className="mb-2 text-xs italic" style={{ color: MUTED_SECONDARY }}>
            Be the first on the list
          </p>
        )
      )}

      {/* Count */}
      {count > 0 && (
        <p className="text-[10px]" style={{ color: 'rgba(240, 230, 233, 0.3)' }}>
          {count} {count === 1 ? 'name' : 'names'} on the guest list
        </p>
      )}
    </section>
  );
};
