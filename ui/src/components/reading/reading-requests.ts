/** Share one request across surfaces while retaining each consumer's cancellation. */
export function readingRequests<T>() {
  const pending = new Map<string, { controller: AbortController; promise: Promise<T>; users: number }>()
  return {
    clear() { for (const entry of pending.values()) entry.controller.abort(); pending.clear() },
    run(key: string, signal: AbortSignal, create: (signal: AbortSignal) => Promise<T>): Promise<T> {
      signal.throwIfAborted()
      let entry = pending.get(key)
      if (!entry) {
        const controller = new AbortController()
        const promise = Promise.resolve().then(() => { controller.signal.throwIfAborted(); return create(controller.signal) })
        entry = { controller, promise, users: 0 }
        pending.set(key, entry)
        const current = entry
        void promise.then(() => { if (pending.get(key) === current) pending.delete(key) }, () => { if (pending.get(key) === current) pending.delete(key) })
      }
      const current = entry
      current.users++
      return new Promise<T>((resolve, reject) => {
        let done = false
        const finish = () => {
          if (done) return false
          done = true; signal.removeEventListener('abort', cancel)
          if (--current.users === 0) {
            current.controller.abort()
            if (pending.get(key) === current) pending.delete(key)
          }
          return true
        }
        const cancel = () => { if (finish()) reject(signal.reason) }
        signal.addEventListener('abort', cancel, { once: true })
        current.promise.then(value => { if (finish()) resolve(value) }, error => { if (finish()) reject(error) })
      })
    },
  }
}
