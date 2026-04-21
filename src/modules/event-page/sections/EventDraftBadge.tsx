import { AlertTriangle } from 'lucide-react';

type Props = {
  canEdit: boolean;
  statusLabel: string | null;
};

export const EventDraftBadge = ({ canEdit, statusLabel }: Props) => {
  if (!canEdit || statusLabel !== 'Draft') return null;

  return (
    <div className="flex justify-center pt-3">
      <span
        className="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium"
        style={{
          backgroundColor: '#FCEBEB',
          border: '0.5px solid #F09595',
          color: '#791F1F',
        }}
      >
        <AlertTriangle className="h-3 w-3" />
        Draft
      </span>
    </div>
  );
};
