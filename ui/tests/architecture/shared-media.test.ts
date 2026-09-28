import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { buildGraph, isTestFile } from '../../../tools/import-graph'

/// Chat and Practice use one machinery for the same task. Every surface that
/// shows or plays a recording is drawn from the shared parts in
/// components/media, and only the platform layer creates audio elements, so a
/// private copy of the playback clock, the cursor, the timed words or the time
/// axis cannot come back unnoticed.
const repositoryRoot = fileURLToPath(new URL('../../../', import.meta.url))
const graph = buildGraph(repositoryRoot)

const SURFACES: Record<string, string[]> = {
  'ui/src/components/media/RecordingTrack.tsx': ['ui/src/components/media/PlaybackCursor.tsx', 'ui/src/components/media/InspectionTracks.tsx', 'ui/src/components/media/Spectrogram.tsx'],
  'ui/src/features/drill/DrillComparison.tsx': ['ui/src/components/media/RecordingTrack.tsx', 'ui/src/components/media/PlaybackProgress.tsx', 'ui/src/components/media/InspectionTracks.tsx'],
  'ui/src/features/conversation/speech/TranscriptionInspector.tsx': ['ui/src/components/media/PlaybackCursor.tsx', 'ui/src/components/media/PlaybackProgress.tsx', 'ui/src/components/media/InspectionTracks.tsx', 'ui/src/components/media/Spectrogram.tsx', 'ui/src/components/media/useRecordingPlayback.ts'],
  'ui/src/components/media/CompactInspection.tsx': ['ui/src/components/media/RecordingTrack.tsx', 'ui/src/components/media/PlaybackProgress.tsx'],
  'ui/src/features/conversation/messages/TurnView.tsx': ['ui/src/components/media/useRecordingPlayback.ts', 'ui/src/components/media/CompactInspection.tsx'],
  'ui/src/features/drill/DrillPage.tsx': ['ui/src/components/media/useRecordingPlayback.ts'],
}

describe('shared recording machinery', () => {
  for (const [surface, parts] of Object.entries(SURFACES)) {
    it(`${surface} is drawn from the shared media parts`, () => {
      const imported = new Set(graph.edges.filter(edge => edge.from === surface).map(edge => edge.to))
      expect(parts.filter(part => !imported.has(part)), 'shared parts this surface no longer uses').toEqual([])
    })
  }

  it('only the platform layer creates audio elements', () => {
    const found = graph.modules
      .filter(module => module.startsWith('ui/src/') && !module.startsWith('ui/src/platform/') && !isTestFile(module))
      .filter(module => /new Audio\(|<audio[\s>]|HTMLAudioElement/.test(graph.sources.get(module) ?? ''))
    expect(found, 'modules playing audio outside platform/audio').toEqual([])
  })
})
