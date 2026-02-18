import React, { useState } from 'react';
import { Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';

interface AvatarUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  userId: string;
  initials?: string;
}

export const AvatarUpload: React.FC<AvatarUploadProps> = ({ 
  value, 
  onChange, 
  userId,
  initials = '?'
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
      const fileExt = file.name.split('.').pop();
      const fileName = `${userId}-${Math.random()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);

      if (uploadError) {
        throw uploadError;
      }

      const { data } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      onChange(data.publicUrl);
      
      toast({
        title: "Photo uploaded!",
        description: "Looking good.",
      });

    } catch (error: any) {
      toast({
        title: "Upload failed",
        description: error.message,
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
        <Avatar className="w-24 h-24 border-4 border-background shadow-lg">
          <AvatarImage src={value || ''} className="object-cover" />
          <AvatarFallback className="text-2xl bg-muted/50">{initials}</AvatarFallback>
        </Avatar>
        
        {value && (
          <button
            type="button"
            onClick={handleRemove}
            className="absolute -top-2 -right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full shadow-sm hover:bg-destructive/90 transition-colors opacity-0 group-hover:opacity-100"
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
            className="relative overflow-hidden"
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
              accept="image/*"
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
