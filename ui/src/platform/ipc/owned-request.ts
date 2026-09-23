import { reportFault } from '../diagnostics/faults'

/** Shared begin/run/cancel lifetime. Cancellation never starts replacement work. */
export async function ownedRequest<T>(signal: AbortSignal, begin: () => Promise<string>,
  run: (id: string) => Promise<T>, cancelRequest: (id: string) => Promise<void>, context: string): Promise<T> {
  signal.throwIfAborted()
  const id = await begin()
  const cancel = () => { void cancelRequest(id).catch(error => reportFault(context, error)) }
  if (signal.aborted) { cancel(); signal.throwIfAborted() }
  signal.addEventListener('abort', cancel, { once: true })
  try { const result = await run(id); signal.throwIfAborted(); return result }
  finally { signal.removeEventListener('abort', cancel) }
}
