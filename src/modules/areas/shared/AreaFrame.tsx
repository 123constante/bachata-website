import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import '@/modules/organiser/theme.css';

export interface AreaFrameProps {
  title: ReactNode;
  back?: { to: string; label: string };
  children: ReactNode;
  testId?: string;
}

/** Teacher / DJ area page frame: the organiser theme tokens, a top bar and one phone-width column. */
export function AreaFrame({ title, back, children, testId }: AreaFrameProps) {
  return (
    <div data-testid={testId} className="org-theme min-h-[100dvh]">
      <header className="border-b border-[var(--line)] bg-[var(--bg)]" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="mx-auto flex h-[52px] max-w-[640px] items-center gap-[4px] px-[8px]">
          {back ? (
            <Link to={back.to} className="flex h-[44px] min-w-[44px] items-center gap-[2px] rounded-[12px] px-[8px] text-[15px] font-semibold text-[var(--gold)]">
              <ChevronLeft aria-hidden="true" className="h-[20px] w-[20px]" />
              {back.label}
            </Link>
          ) : (
            <span className="w-[8px]" aria-hidden="true" />
          )}
          <h1 className="min-w-0 flex-1 truncate text-[17px] font-bold">{title}</h1>
        </div>
      </header>
      <div className="mx-auto w-full max-w-[640px] space-y-[16px] px-[16px] py-[16px]" style={{ paddingBottom: 'calc(16px + env(safe-area-inset-bottom))' }}>
        {children}
      </div>
    </div>
  );
}
