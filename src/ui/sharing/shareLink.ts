/**
 * Share a link using native share sheet (mobile) or clipboard (desktop).
 * Returns true if native share was used, false if clipboard fallback.
 */
export async function shareOrCopy(url: string, title: string = 'repsheets'): Promise<boolean> {
  if (navigator.share) {
    try {
      await navigator.share({ title, url })
      return true
    } catch {
      // User cancelled share sheet — not an error
      return true
    }
  }
  // Desktop fallback
  try {
    await navigator.clipboard.writeText(url)
  } catch {}
  return false
}
