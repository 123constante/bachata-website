import React, { useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { uploadToR2 } from '@/lib/uploadToR2';
import { PersonAvatar } from '@/components/account/profiles/PersonAvatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { uploadErrorMessage, validateImageFile } from '@/lib/upload-validation';

interface AvatarUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  userId: string;
  /** The person's first name so far: its initial, or a person glyph with none. */
  name?: string | null;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({ 
  value, 
  onChange, 
  userId,
  name = null
}) => {
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState(false);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      setIsUploading(true);
      
      if (!event.target.files || event.target.files.length === 0) {
        throw new Error('You must select an image to upload.');
      }

      const file = event.target.files[0];
      const check = validateImageFile(file);
      if (!check.ok) throw new Error(check.message);

      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const publicUrl = await uploadToR2(file, 'avatars', filePath);

      onChange(publicUrl);
      
      toast({
        title: "Photo uploaded!",
        description: "Looking good.",
      });

    } catch (error: unknown) {
      toast({
        title: "Upload failed",
        description: uploadErrorMessage(error),
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleRemove = () => {
    onChange('');
  };

  return (
    <div className="flex items-center gap-6">
      <div className="relative group">
        {/* The ONE PersonAvatar: its no-photo disc is the site's muted tone, never a see-through blank. */}
        <PersonAvatar
          photoUrl={value || null}
          name={name}
          size={88}
          loading="eager"
          imgTestId="avatar-upload-photo"
          placeholderTestId="avatar-upload-empty"
        />
        
        {value && (
          <button
            type="button"
            onClick={handleRemove}
            aria-label="Remove photo"
            className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full hover:bg-destructive/90 transition-colors"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      <div className="flex-1 space-y-2">
        <div className="flex items-center gap-3">
          <Button 
            type="button" 
            variant="outline" 
            disabled={isUploading}
            className="relative min-h-[44px] overflow-hidden"
          >
            {isUploading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Upload Photo
              </>
            )}
            <input 
              type="file" 
              className="absolute inset-0 opacity-0 cursor-pointer" 
              accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
              onChange={handleUpload}
              disabled={isUploading}
            />
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground">
          Recommended: Square JPG or PNG, max 2MB.
        </p>
      </div>
    </div>
  );
};
