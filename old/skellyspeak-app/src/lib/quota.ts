/// Making the hosted allowance's reset legible.

/// What time of day the allowance resets, in the reader's own timezone.
///
/// The server resets at 00:00 UTC and says so, which is accurate and useless:
/// in New York that is 8pm the evening before, so tokens spent after dinner
/// count against tomorrow and the counter looks stuck at local midnight. The
/// number is right; "00:00 UTC" is what makes it read as broken.
///
/// Returns a local clock time like "8:00 PM" — the daily reset is a fixed UTC
/// instant, so the local time of day is fixed too, give or take a DST shift.
export function resetsAtLocalTime(now: Date = new Date()): string {
  const next = new Date(now)
  next.setUTCHours(24, 0, 0, 0)
  return next.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })
}
