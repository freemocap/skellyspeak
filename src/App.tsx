import { AppShell } from './app/AppShell'
import { SkillNavigationProvider } from './state/useSkillNavigation'

/// The entry point composes two things and nothing else: the skill-navigation
/// provider every surface reads, and the shell that owns the rest.
export default function App() { return <SkillNavigationProvider><AppShell /></SkillNavigationProvider> }
