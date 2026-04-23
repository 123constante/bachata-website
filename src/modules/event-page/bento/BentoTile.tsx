import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type BentoTileProps = {
  title: string;
  color: string;
  children?: ReactNode;
  className?: string;
  // Exactly one of these should be set. href wins if both are.
  onClick?: () => void;
  href?: string;
};

const SHELL_CLASS =
  'relative flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-white/[0.08] text-left text-white shadow-[0_6px_14px_rgba(0,0,0,0.3)]';

export const BentoTile = ({ title, color, children, className, onClick, href }: BentoTileProps) => {
  const cls = `${SHELL_CLASS} ${className ?? ''}`;
  const style = { background: color } as const;

  const inner = (
    <>
      <div className="px-3 pb-1 pt-[10px] text-[11px] font-bold uppercase tracking-[0.04em] text-white/90">
        {title}
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-3">{children}</div>
    </>
  );

  if (href) {
    return (
      <Link to={href} className={cls} style={style}>
        {inner}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls} style={style}>
        {inner}
      </button>
    );
  }

  return (
    <div className={cls} style={style}>
      {inner}
    </div>
  );
};
