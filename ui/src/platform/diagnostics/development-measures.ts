/// React 19.2's development build records a `performance.measure` for every
/// component render, and its detail lists every changed prop down to array
/// elements. The browser copies each detail and keeps the entry until it is
/// cleared. A spectrogram prop lists thousands of values, so development kept
/// hundreds of megabytes of these diffs and the WebView renderer crashed.
///
/// Development keeps React's render entries but lists at most `rows` changed
/// props, marking how many were left out, and clears recorded measures on an
/// interval. The app records no measures of its own. Release builds record none.
export function guardDevelopmentMeasures({ rows = 40, intervalMs = 5000 } = {}): () => void {
  if (typeof performance?.measure !== 'function' || typeof performance.clearMeasures !== 'function') return () => {}
  const original = performance.measure
  const measure = (name: string, options?: string | PerformanceMeasureOptions, end?: string) => {
    const listed: unknown = typeof options === 'object' ? options?.detail?.devtools?.properties : undefined
    if (typeof options === 'object' && Array.isArray(listed) && listed.length > rows) {
      const devtools = options.detail.devtools
      options = { ...options, detail: { ...options.detail, devtools: {
        ...devtools, properties: [...listed.slice(0, rows), ['…', `${listed.length - rows} more rows omitted`]],
      } } }
    }
    return original.call(performance, name, options, end)
  }
  performance.measure = measure as Performance['measure']
  const timer = setInterval(() => performance.clearMeasures(), intervalMs)
  return () => { clearInterval(timer); performance.measure = original }
}
