/** Configuration failure is recoverable by correcting files, never by erasing learner data. */
export function ConfigurationRefusal({ message }: { message: string }) {
  return <main className="startup-refusal" aria-label="Configuration error">
    <h1>Configuration could not be loaded</h1>
    <p className="configuration-error" role="alert">{message}</p>
    <p>Fix the named configuration file, then quit and reopen SkellySpeak.</p>
  </main>
}
