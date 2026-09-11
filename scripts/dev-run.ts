import { fileURLToPath } from 'node:url'
import { runLogged } from './run-log.ts'
const root = fileURLToPath(new URL('../', import.meta.url))
const [mode, ...args] = process.argv.slice(2)
if (mode === 'server') {
  process.exitCode = await runLogged(root, 'server/.venv/bin/python', ['-u', 'server/local_server.py', ...args], 'server')
} else if (mode === 'process') {
  const [command, ...parameters] = args
  if (!command) throw new Error('A process command is required.')
  process.exitCode = await runLogged(root, command, parameters, 'process')
} else {
  process.exitCode = await runLogged(root, process.execPath, ['scripts/macos-dev.ts', mode ?? '', ...args])
}
