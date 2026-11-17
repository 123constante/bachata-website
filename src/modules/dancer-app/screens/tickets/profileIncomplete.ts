/**
 * The bar and the locks show for an unfinished profile: view-only, no dancer profile
 * (my_dancer_edit_v1 says no_profile), or required steps not done. Not read yet, or a read
 * that failed for any other reason (offline), = not shown: a finished dancer is never locked
 * out by a network blip, and nothing flashes.
 */
export type ProfileRead = { status: 'pending' | 'error' | 'no_profile' | 'success'; requiredDone: boolean };

export function profileIncomplete(viewOnly: boolean, read: ProfileRead): boolean {
  if (viewOnly) return true;
  if (read.status === 'no_profile') return true;
  if (read.status !== 'success') return false;
  return !read.requiredDone;
}
