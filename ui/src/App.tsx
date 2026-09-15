import { AppShell } from './app/AppShell'

/// The entry point composes the shell and nothing else: the shell reads the
/// stores itself, so there is nothing to assemble here first.
export default function App() { return <AppShell /> }
