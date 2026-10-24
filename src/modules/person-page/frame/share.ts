import { toast } from 'sonner';

/** navigator.share where there is one, else copy the link. The URL is read on tap only (SSR-safe). */
export async function sharePage(title: string): Promise<void> {
  const url = typeof window !== 'undefined' ? window.location.href : '';
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, url });
      return;
    } catch (err) {
      // The person closed the sheet: nothing to say. Any other failure falls through to copying the link.
      if ((err as { name?: string } | null)?.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    toast.error("Couldn't copy the link. Try again.");
  }
}
