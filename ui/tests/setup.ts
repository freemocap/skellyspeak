// Testing Library's DOM matchers (toBeInTheDocument, toBeDisabled, ...). The
// `/vitest` entry both extends `expect` and declares the matcher types, so
// `tsc` sees them too. Harmless for the pure-function tests, which run in the
// node environment and simply never call them.
import '@testing-library/jest-dom/vitest'
import { afterEach, vi } from 'vitest'

// Zustand stores are module-level singletons. The shared mock resets every
// store after each test and is registered explicitly so its location is independent
// of Vitest's root-level __mocks__ discovery convention.
vi.mock('zustand', async () => ({
  ...await vi.importActual<typeof import('zustand')>('zustand'),
  ...await import('./mocks/zustand'),
}))

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

  // jsdom has no layout observer; component tests can supply measured boxes.
  globalThis.ResizeObserver ??= class { observe() {} unobserve() {} disconnect() {} }

  // Nothing under test scrolls, but the chat stream asks the DOM to.
  Element.prototype.scrollIntoView ??= vi.fn()
  // jsdom has no top-layer popover implementation; layout is verified in-browser.
  HTMLElement.prototype.showPopover ??= function () { this.style.display = 'block' }
  HTMLElement.prototype.hidePopover ??= function () { this.style.display = 'none' }
}
