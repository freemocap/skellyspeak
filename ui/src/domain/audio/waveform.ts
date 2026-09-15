/// Where the strip gets its samples.
///
/// Browser and native recorders both provide normalized sample arrays through
/// this source-neutral contract. It lives below the component that draws it, so
/// a recorder does not have to import a canvas component to describe its output.
export interface WaveSource {
  /// Time-domain samples in -1..1, oldest first, since the last call.
  /// Whatever is returned is consumed: the strip owns them afterwards.
  read: () => number[]
  /// How many samples a second `read` produces in total. The device picks the
  /// rate, so this is reported rather than assumed — guessing puts a visible
  /// drift in the time axis on anything that is not running at 48kHz.
  samplesPerSecond: number
}
