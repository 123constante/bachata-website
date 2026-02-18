import { UserRole } from '@/hooks/useUserIds';
import { cn } from '@/lib/utils';
import { User, Calendar, Music, GraduationCap, Camera, ShoppingBag } from 'lucide-react';

interface ProfileSelectorProps {
  availableRoles: UserRole[];
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
}

export const ProfileSelector = ({ availableRoles, currentRole, onSelectRole }: ProfileSelectorProps) => {
  if (availableRoles.length <= 1) return null;

  return (
    <div className='flex bg-muted p-1 rounded-lg mx-auto max-w-lg mb-4 shadow-inner'>
      {availableRoles.includes('dancer') && (
        <button
          onClick={() => onSelectRole('dancer')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all',
            currentRole === 'dancer' 
              ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5' 
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <User className='w-4 h-4' />
          Dancer
        </button>
      )}
      
      {availableRoles.includes('organiser') && (
        <button
          onClick={() => onSelectRole('organiser')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all',
            currentRole === 'organiser' 
              ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5' 
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <Calendar className='w-4 h-4' />
          Organiser
        </button>
      )}

      {availableRoles.includes('teacher') && (
        <button
          onClick={() => onSelectRole('teacher')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all',
            currentRole === 'teacher' 
              ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5' 
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <GraduationCap className='w-4 h-4' />
          Teacher
        </button>
      )}

      {availableRoles.includes('dj') && (
        <button
          onClick={() => onSelectRole('dj')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all',
            currentRole === 'dj' 
              ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5' 
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <Music className='w-4 h-4' />
          DJ
        </button>
      )}

      {availableRoles.includes('videographer') && (
        <button
          onClick={() => onSelectRole('videographer')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all',
            currentRole === 'videographer'
              ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <Camera className='w-4 h-4' />
          Video
        </button>
      )}

      {availableRoles.includes('vendor') && (
        <button
          onClick={() => onSelectRole('vendor')}
          className={cn(
            'flex-1 flex items-center justify-center gap-2 py-2 px-3 text-sm font-medium rounded-md transition-all',
            currentRole === 'vendor'
              ? 'bg-background text-foreground shadow-sm ring-1 ring-black/5'
              : 'text-muted-foreground hover:text-foreground hover:bg-background/50'
          )}
        >
          <ShoppingBag className='w-4 h-4' />
          Vendor
        </button>
      )}
    </div>
  );
};

