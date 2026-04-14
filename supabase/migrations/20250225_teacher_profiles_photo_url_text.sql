-- Convert teacher_profiles.photo_url from text[] to text using the first element
ALTER TABLE public.teacher_profiles
  ALTER COLUMN photo_url TYPE text
  USING (
    CASE
      WHEN photo_url IS NULL THEN NULL
      WHEN array_length(photo_url, 1) >= 1 THEN photo_url[1]
      ELSE NULL
    END
  );
