export type ReadingSizeAction = 'increase' | 'decrease' | 'reset'

/// The desktop View menu owns its reading-size accelerators. Subscribing here
/// keeps menu clicks and keyboard shortcuts on one path, and keeps the Tauri
/// event API behind the platform boundary.
export async function onReadingSizeAction(handler: (action: ReadingSizeAction) => void): Promise<() => void> {
  const { listen } = await import('@tauri-apps/api/event')
  return listen<string>('reading-size-action', event => {
    if (event.payload === 'increase' || event.payload === 'decrease' || event.payload === 'reset') handler(event.payload)
  })
}
