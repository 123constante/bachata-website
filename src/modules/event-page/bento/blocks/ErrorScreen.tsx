import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { buildCityPath } from '@/lib/cityPath';
import { eventPageQueryKey } from '@/modules/event-page/useEventPageQuery';
import { PinkFallback } from '@/modules/event-page/bento/blocks/PinkFallback';

type Variant = 'not-found' | 'error' | 'unavailable';

type ErrorScreenProps = {
  variant: Variant;
  title: string;
  message: string | null;
  eventId: string | null;
  occurrenceId: string | null;
};

const readCitySlug = (): string => {
  if (typeof window === 'undefined') return 'london-gb';
  return window.localStorage.getItem('activeCitySlug') ?? 'london-gb';
};

const BtnPrimary = ({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) => (
  <button
    type="button"
    onClick={onClick}
    className="inline-flex items-center justify-center rounded-full bg-white px-5 py-[10px] text-[13px] font-bold text-[#E13A8A] transition hover:bg-white/90"
  >
    {children}
  </button>
);

const BtnLink = ({ children, to }: { children: React.ReactNode; to: string }) => (
  <Link
    to={to}
    className="inline-flex items-center justify-center rounded-full bg-white px-5 py-[10px] text-[13px] font-bold text-[#E13A8A] transition hover:bg-white/90"
  >
    {children}
  </Link>
);

export const ErrorScreen = ({
  variant,
  title,
  message,
  eventId,
  occurrenceId,
}: ErrorScreenProps) => {
  const queryClient = useQueryClient();

  let action: React.ReactNode = null;
  if (variant === 'not-found' || variant === 'unavailable') {
    action = <BtnLink to={buildCityPath(readCitySlug())}>Back to events</BtnLink>;
  } else if (variant === 'error') {
    action = (
      <BtnPrimary
        onClick={() => {
          void queryClient.invalidateQueries({ queryKey: eventPageQueryKey(eventId, occurrenceId) });
        }}
      >
        Try again
      </BtnPrimary>
    );
  }

  return (
    <div className="mx-auto w-full max-w-[430px] px-2 pt-4">
      <PinkFallback title={title} subtitle={message} action={action} />
    </div>
  );
};
