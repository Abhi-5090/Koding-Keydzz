import { describe, it, expect, vi } from 'vitest'
import { retryImport, RouteErrorBoundary, lazyWithRetry } from './lazyWithRetry'

/**
 * A LOST PAGE CHUNK MUST NOT BLANK THE APP.
 *
 * Every page below the login screen is fetched on demand, so a stuttering
 * school connection can lose one. React.lazy treats that as a render error and
 * — with no boundary above it — unmounts the whole tree: the child sees a white
 * screen with no message and no way back. It reproduced in the browser suite on
 * WebKit ("Importing a module script failed") on whichever game happened to
 * lose a request under load.
 *
 * The retry is what makes that invisible in the common case, and the bound is
 * what stops it becoming an endless spinner instead.
 */

describe('retryImport', () => {
  it('returns the module first time, with no retry', async () => {
    const importer = vi.fn().mockResolvedValue({ default: 'page' })
    await expect(retryImport(importer, { backoffMs: 1 })).resolves.toEqual({ default: 'page' })
    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('retries a failed import and resolves — the child never sees an error', async () => {
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('Importing a module script failed.'))
      .mockResolvedValue({ default: 'page' })

    await expect(retryImport(importer, { backoffMs: 1 })).resolves.toEqual({ default: 'page' })
    expect(importer).toHaveBeenCalledTimes(2)
  })

  it('survives several consecutive failures within the budget', async () => {
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new Error('1'))
      .mockRejectedValueOnce(new Error('2'))
      .mockResolvedValue({ default: 'page' })

    await expect(retryImport(importer, { backoffMs: 1 })).resolves.toEqual({ default: 'page' })
    expect(importer).toHaveBeenCalledTimes(3)
  })

  it('gives up after a BOUNDED number of attempts', async () => {
    // The bound is the point: retrying forever would leave a child watching a
    // spinner with no error and no way to recover.
    const importer = vi.fn().mockRejectedValue(new TypeError('gone'))
    await expect(retryImport(importer, { backoffMs: 1 })).rejects.toThrow('gone')
    expect(importer).toHaveBeenCalledTimes(3) // 1 attempt + 2 retries
  })

  it('rethrows the LAST failure, not a wrapper', async () => {
    const last = new TypeError('Importing a module script failed.')
    const importer = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValue(last)
    await expect(retryImport(importer, { backoffMs: 1 })).rejects.toBe(last)
  })

  it('honours a custom retry budget', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('gone'))
    await expect(retryImport(importer, { retries: 0, backoffMs: 1 })).rejects.toThrow()
    expect(importer).toHaveBeenCalledTimes(1)
  })

  it('backs off between attempts rather than hammering', async () => {
    const importer = vi.fn().mockRejectedValue(new Error('gone'))
    const started = Date.now()
    await expect(retryImport(importer, { backoffMs: 30 })).rejects.toThrow()
    // Two waits: 30ms then 60ms. Assert only the lower bound, so the test does
    // not become flaky on a slow machine.
    expect(Date.now() - started).toBeGreaterThanOrEqual(80)
  })
})

describe('the recovery boundary', () => {
  it('renders its children while nothing is wrong', () => {
    const boundary = new RouteErrorBoundary({ children: 'ok' })
    expect(boundary.state.failed).toBe(false)
    expect(boundary.render()).toBe('ok')
  })

  it('switches to the recovery view once a chunk fails', () => {
    expect(RouteErrorBoundary.getDerivedStateFromError(new Error('boom'))).toEqual({
      failed: true,
    })
  })

  it('offers a way out — not a blank screen', () => {
    const boundary = new RouteErrorBoundary({ children: 'ok' })
    boundary.state = { failed: true }
    const tree = boundary.render()

    // It is announced, it says what happened, and it has an action.
    expect(tree.props.role).toBe('alert')
    const rendered = JSON.stringify(tree)
    expect(rendered).toMatch(/didn&apos;t load|didn.t load/i)
    expect(rendered).toMatch(/try again/i)
  })
})

describe('lazyWithRetry', () => {
  it('produces a React lazy component', () => {
    const Lazy = lazyWithRetry(() => Promise.resolve({ default: () => null }))
    // React marks lazy elements with this type symbol.
    expect(Lazy.$$typeof).toBe(Symbol.for('react.lazy'))
  })
})
