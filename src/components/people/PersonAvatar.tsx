/**
 * A person's round photo with the nationality flag. Use it for any NEW round person
 * photo; existing surfaces with their own image markup wrap it in a relative box and
 * add <NationalityFlag> -- either way the flag is the one implementation.
 *
 * The outer box never clips (the flag stands out past the top-right); the photo itself
 * is clipped to a circle. `children` sit on top of the photo (e.g. an owner's controls,
 * which belong at the bottom-right so the flag keeps its corner).
 */
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { NationalityFlag } from './NationalityFlag';

export interface PersonAvatarProps {
  name: string;
  photoUrl?: string | null;
  nationalityCode?: unknown;
  /** Rendered diameter in CSS px. */
  size: number;
  className?: string;
  photoClassName?: string;
  /** Shown when there is no photo (defaults to the initials). */
  fallback?: ReactNode;
  children?: ReactNode;
}

export const personInitials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('') || '?';

export function PersonAvatar({ name, photoUrl, nationalityCode, size, className, photoClassName, fallback, children }: PersonAvatarProps) {
  return (
    <span data-person-avatar className={cn('relative inline-block shrink-0 align-middle', className)} style={{ width: size, height: size }}>
      <span className={cn('flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-muted', photoClassName)}>
        {photoUrl ? (
          <img src={photoUrl} alt={name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
        ) : (
          fallback ?? (
            <span aria-hidden="true" className="font-semibold text-muted-foreground" style={{ fontSize: Math.max(10, Math.round(size * 0.36)) }}>
              {personInitials(name)}
            </span>
          )
        )}
      </span>
      <NationalityFlag code={nationalityCode} size={size} />
      {children}
    </span>
  );
}

export default PersonAvatar;
