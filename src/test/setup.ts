// Testing Library's DOM matchers (toBeInTheDocument, toBeDisabled, ...). The
// `/vitest` entry both extends `expect` and declares the matcher types, so
// `tsc` sees them too. Harmless for the pure-function tests, which run in the
// node environment and simply never call them.
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Zustand stores are module-level singletons, so state written by one test is
// visible to the next. The root `__mocks__/zustand.ts` remembers each store's
// initial state and restores it after every test, so no store carries reset
// machinery of its own. Registering it here opts every test file into that mock:
// without this call vitest leaves the real package in place.
vi.mock('zustand')

if (typeof document !== 'undefined') {
  const { cleanup } = await import('@testing-library/react')
  afterEach(cleanup)

  // jsdom implements no media queries, and the app asks about viewport width
  // to choose between its desktop and mobile layouts. Answer "not mobile";
  // a test that cares about the mobile surface can override this.
  if (!window.matchMedia) {
    window.matchMedia = ((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })) as unknown as typeof window.matchMedia
  }

  // Nothing under test scrolls, but the chat stream asks the DOM to.
  Element.prototype.scrollIntoView ??= vi.fn()
}
