/**
 * Test setup for the student app.
 *
 * Two things, and the second is not optional:
 *
 *  1. jest-dom's DOM matchers (`toBeInTheDocument`, `toHaveTextContent`), so
 *     component tests read as assertions about what a child would SEE rather
 *     than about node properties.
 *
 *  2. UNMOUNTING BETWEEN TESTS. Testing Library registers its own cleanup only
 *     when the runner's globals are enabled, and this project runs without
 *     them. Without it every render accumulates: the second test finds two
 *     copies of the component and fails with "Found multiple elements", which
 *     reads like a bug in the component and is not.
 *
 *     It matters more than usual here because the toast viewport renders into
 *     a PORTAL on `document.body`, outside the render container — so a leaked
 *     tree is not visible in the container the next test looks at, but its
 *     toasts are still in the document.
 *
 * The rest of this suite is pure-logic and needs neither; both are global
 * because a per-file import is exactly the thing that gets forgotten.
 */
import { afterEach } from 'vitest'
import { cleanup } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

afterEach(() => {
  cleanup()
})
