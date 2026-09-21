import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkMediaFiles } from './check-appimage.ts'

const plugins = ['coreelements', 'app', 'playback', 'autodetect', 'pulseaudio', 'audioconvert', 'audioresample', 'wavparse']
const complete = [...plugins.map(name => `/usr/lib/gstreamer-1.0/libgst${name}.so`), '/usr/libexec/gstreamer-1.0/gst-plugin-scanner']
test('rejects the shipped libraries-only bundle and incomplete audio runtimes', () => {
  assert.throws(() => checkMediaFiles(['/usr/lib/libgstreamer-1.0.so.0']), /libgstpulseaudio/)
  for (const missing of complete) assert.throws(() => checkMediaFiles(complete.filter(path => path !== missing)), /lacks required audio runtime files/)
  assert.doesNotThrow(() => checkMediaFiles(complete))
})
