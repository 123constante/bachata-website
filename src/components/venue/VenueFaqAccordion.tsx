import { useState } from 'react';
import { ChevronDown } from 'lucide-react';

export interface VenueFaqItem {
  q: string;
  a: string;
}

interface VenueFaqAccordionProps {
  items: VenueFaqItem[];
  initialOpen?: number;
}

export default function VenueFaqAccordion({
  items,
  initialOpen = 0,
}: VenueFaqAccordionProps) {
  const [open, setOpen] = useState<number>(
    items.length > 0 ? Math.min(initialOpen, items.length - 1) : -1,
  );
  if (items.length === 0) return null;

  return (
    <div
      className="overflow-hidden rounded-[18px] border"
      style={{
        background: 'var(--va-surface)',
        borderColor: 'var(--va-accent-line)',
        boxShadow:
          '0 0 0 1px color-mix(in srgb, var(--va-halo) 10%, transparent), 0 18px 44px -22px color-mix(in srgb, var(--va-halo) 32%, transparent)',
      }}
    >
      {items.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={`${i}-${item.q}`}
            style={{ borderTop: i ? '1px solid var(--va-line)' : 'none' }}
          >
            <button
              type="button"
              onClick={() => setOpen(isOpen ? -1 : i)}
              className="flex w-full cursor-pointer items-center justify-between gap-3 border-0 bg-transparent px-4 py-3.5 text-left"
              aria-expanded={isOpen}
            >
              <span
                className="text-[14.5px] font-bold leading-snug"
                style={{ color: 'var(--va-text)' }}
              >
                {item.q}
              </span>
              <ChevronDown
                className="h-[18px] w-[18px] flex-shrink-0 transition-transform duration-200"
                style={{
                  color: 'var(--va-accent)',
                  transform: isOpen ? 'rotate(180deg)' : 'none',
                }}
              />
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-300"
              style={{
                gridTemplateRows: isOpen ? '1fr' : '0fr',
              }}
            >
              <div className="overflow-hidden">
                <div
                  className="px-4 pb-3.5 text-[13.5px] leading-[1.55]"
                  style={{ color: 'var(--va-text2)' }}
                >
                  {item.a}
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
