import { useI18n } from '../../components/localization/i18n'
/** Configuration failure is recoverable by correcting files, never by erasing learner data. */
export function ConfigurationRefusal({ message }: { message: string }) {
  const tr = useI18n()
  return <main className="startup-refusal" aria-label={tr("Configuration error")}>
    <h1>{tr("Configuration could not be loaded")}</h1>
    <p className="configuration-error" role="alert">{message}</p>
    <p>{tr("Fix the named configuration file, then quit and reopen SkellySpeak.")}</p>
  </main>
}
