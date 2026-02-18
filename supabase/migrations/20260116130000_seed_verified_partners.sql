-- 1. Verify existing organisers (so they don't disappear)
UPDATE public.organisers 
SET verified = true 
WHERE verified IS NULL OR verified = false;

-- 2. Add 4 Premium Parnters with nice images
INSERT INTO public.organisers (name, city, verified, photo_url, bio, instagram)
SELECT 'Bachata Exchange', 'London', true, 'https://images.unsplash.com/photo-1516450360452-9312f5e86fc7?w=500&auto=format&fit=crop&q=60', 'Weekly social events in central London.', 'https://instagram.com/bachataexchange'
WHERE NOT EXISTS (SELECT 1 FROM public.organisers WHERE name = 'Bachata Exchange');

INSERT INTO public.organisers (name, city, verified, photo_url, bio, instagram)
SELECT 'Latin Roots', 'London', true, 'https://images.unsplash.com/photo-1545934563-3561a293ea19?w=500&auto=format&fit=crop&q=60', 'The home of authentic Dominican bachata.', 'https://instagram.com/latinroots'
WHERE NOT EXISTS (SELECT 1 FROM public.organisers WHERE name = 'Latin Roots');

INSERT INTO public.organisers (name, city, verified, photo_url, bio, instagram)
SELECT 'Salsa Temple', 'London', true, 'https://images.unsplash.com/photo-1504609773096-104ff2c73ba4?w=500&auto=format&fit=crop&q=60', 'River views and smooth moves every Sunday.', 'https://instagram.com/salsatemple'
WHERE NOT EXISTS (SELECT 1 FROM public.organisers WHERE name = 'Salsa Temple');

INSERT INTO public.organisers (name, city, verified, photo_url, bio, instagram)
SELECT 'Urban Bachata', 'London', true, 'https://images.unsplash.com/photo-1533174072545-e8d9859f654d?w=500&auto=format&fit=crop&q=60', 'Modern fusion styles for the new generation.', 'https://instagram.com/urbanbachata'
WHERE NOT EXISTS (SELECT 1 FROM public.organisers WHERE name = 'Urban Bachata');
