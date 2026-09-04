import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

/**
 * THE ADMIN PORTAL MUST MEET THE SAME BAR AS THE STUDENT APP.
 *
 * The student app enforces these rules because the HTML course teaches them.
 * They apply here for a different reason: teachers and administrators use
 * assistive technology too, and a roster nobody can operate by keyboard is as
 * broken as a lesson nobody can read. The portal had NO accessibility tests at
 * all until this file.
 *
 * DELIBERATELY SOURCE-LEVEL, NOT A RENDERED AUDIT. A full axe pass needs every
 * page mounted with providers, routes and data; this app's test suite is
 * logic-first and has no such harness. Static checks catch the specific
 * regressions the course names, cost nothing to run, and never flake. They are
 * a floor, not a substitute for testing with a real screen reader.
 */

const here = dirname(fileURLToPath(import.meta.url))
const SRC = here

/**
 * Extract one JSX opening tag, brace-aware.
 *
 * A naive `<tag[^>]*>` is wrong in JSX: `onChange={(e) => f(e)}` contains a
 * `>` inside an arrow function, so the match truncates mid-tag and misses the
 * attributes after it. That produced a false failure claiming a textarea had
 * no accessible name when `aria-label` was sitting three lines below the
 * arrow. Tracking brace depth is the difference between checking the tag and
 * checking the first half of it.
 */
function openingTags(rawSource, tagName) {
  /**
   * Comments are stripped first.
   *
   * A JSDoc line reading "a monospace <textarea> (deliberately not Monaco)"
   * matched as a tag with no attributes and failed the accessible-name check.
   * The test was reading prose and reporting it as markup.
   */
  const source = rawSource
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1')

  const out = []
  const pattern = new RegExp(`<${tagName}\\b`, 'g')
  let match

  while ((match = pattern.exec(source))) {
    let i = match.index + match[0].length
    let depth = 0
    let quote = null

    while (i < source.length) {
      const ch = source[i]
      if (quote) {
        if (ch === quote) quote = null
      } else if (ch === '"' || ch === "'" || ch === '`') {
        quote = ch
      } else if (ch === '{') {
        depth += 1
      } else if (ch === '}') {
        depth -= 1
      } else if (ch === '>' && depth === 0) {
        break
      }
      i += 1
    }
    out.push(source.slice(match.index, i + 1))
  }
  return out
}

/** Every .jsx file under src, recursively. */
function jsxFiles(dir = SRC, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules') continue
      jsxFiles(full, out)
    } else if (entry.endsWith('.jsx') && !entry.endsWith('.test.jsx')) {
      out.push(full)
    }
  }
  return out
}

const FILES = jsxFiles().map((path) => ({
  path: relative(SRC, path),
  source: readFileSync(path, 'utf8'),
}))

describe('the app meets the accessibility rules its own course teaches', () => {
  it('has JSX files to check', () => {
    // Guards the guard: a broken glob would make every test below vacuous.
    expect(FILES.length).toBeGreaterThan(20)
  })

  it('gives every <img> an alt attribute', () => {
    /**
     * The course teaches that a missing alt is worse than an empty one: a
     * screen reader falls back to reading the file name. `alt=""` is correct
     * for decoration — absent is never correct.
     */
    const offenders = []
    for (const { path, source } of FILES) {
      for (const tag of openingTags(source, 'img')) {
        if (!/\balt\s*=/.test(tag)) {
          offenders.push(`${path}: ${tag.slice(0, 80)}`)
        }
      }
    }
    expect(offenders, `images with no alt:\n${offenders.join('\n')}`).toEqual([])
  })

  it('does not fake a button with a clickable div or span', () => {
    /**
     * A clickable div cannot be focused, cannot be triggered from the
     * keyboard, and is invisible to assistive software — three bugs a real
     * <button> never has. The course states this outright.
     */
    const offenders = []
    for (const { path, source } of FILES) {
      /**
       * `motion.div` counts too.
       *
       * The scanner originally matched only `<div` and `<span`, so it walked
       * straight past a `<motion.div onClick=...>` backdrop — which is exactly
       * how the mobile drawer shipped with no keyboard escape while this test
       * reported the app clean. Framer wraps almost every animated element in
       * this codebase, so excluding them left most of the UI unchecked.
       */
      const candidates = [
        ...openingTags(source, 'div'),
        ...openingTags(source, 'span'),
        ...openingTags(source, 'motion\\.div'),
        ...openingTags(source, 'motion\\.span'),
        ...openingTags(source, 'motion\\.li'),
      ]

      for (const tag of candidates) {
        if (!/\bonClick\b/.test(tag)) continue

        /**
         * Two legitimate exceptions, and only two.
         *
         * 1. An explicit `role` WITH a keyboard handler — a deliberate,
         *    accessible custom control rather than the mistake being guarded
         *    against.
         * 2. `aria-hidden="true"` — a decorative overlay whose click merely
         *    duplicates a real control. Modal and drawer backdrops are the
         *    case: keyboard users dismiss them with Escape, so announcing a
         *    nameless clickable region would be noise. This rule originally
         *    rejected them, which pushed towards the WRONG fix (bolting a
         *    role onto a backdrop) instead of the right one (hiding it and
         *    making sure Escape works).
         */
        const customControl =
          /\brole\s*=/.test(tag) && /\bonKeyDown\b|\bonKeyUp\b/.test(tag)
        const decorative = /aria-hidden=["'{]?true/.test(tag)

        /**
         * A click-to-dismiss OVERLAY, in a component that also handles Escape.
         *
         * This is the standard dialog pattern and axe does not flag it: the
         * click is a convenience for pointer users, and Escape is the keyboard
         * path. The rule needs this case because the alternatives are both
         * wrong — `aria-hidden` on a wrapper would hide the dialog inside it,
         * and bolting a `role` onto a backdrop invents a control nobody wants.
         *
         * The condition is deliberately paired: an overlay is only excused
         * when the file genuinely offers Escape. That pairing is what turned
         * up the real bugs — BOTH mobile drawers had a click-only backdrop and
         * no Escape at all, so a keyboard user who opened the menu was stuck
         * in it. Loosening this to "any overlay" would have hidden them.
         */
        /**
         * An `onClick` that only stops propagation is not a control.
         *
         * `onClick={(e) => e.stopPropagation()}` on a dialog panel exists to
         * PREVENT the click-outside-to-close from firing. It performs no
         * action, so there is nothing for a keyboard user to be denied — and
         * turning it into a button would create a control that does nothing.
         */
        const containmentOnly = /onClick=\{\s*\(?e\)?\s*=>\s*e\.stopPropagation\(\)\s*\}/.test(
          tag
        )

        const isOverlay = /\binset-0\b/.test(tag)
        const fileHandlesEscape = /['"]Escape['"]/.test(source)
        const dismissibleOverlay = isOverlay && fileHandlesEscape

        if (!customControl && !decorative && !dismissibleOverlay && !containmentOnly) {
          offenders.push(`${path}: ${tag.slice(0, 100)}`)
        }
      }
    }
    expect(offenders, `clickable non-buttons:\n${offenders.join('\n')}`).toEqual([])
  })

  it('pairs every label’s for with an input id', () => {
    /**
     * Text merely sitting beside a box is not a label. The connection is what
     * makes the label clickable and what makes a screen reader announce
     * "Email, edit text" instead of just "edit text".
     */
    const offenders = []
    for (const { path, source } of FILES) {
      const fors = [...source.matchAll(/htmlFor=["'{]([^"'}\s]+)/g)].map((m) => m[1])
      const ids = new Set(
        [...source.matchAll(/\bid=["'{]([^"'}\s]+)/g)].map((m) => m[1])
      )
      for (const target of fors) {
        // Template values (`${...}`) are resolved at runtime and cannot be
        // checked statically; a literal that matches nothing is a real bug.
        if (target.includes('$') || target.includes('`')) continue
        if (!ids.has(target)) {
          offenders.push(`${path}: htmlFor="${target}" matches no id in the file`)
        }
      }
    }
    expect(offenders, `labels pointing at nothing:\n${offenders.join('\n')}`).toEqual([])
  })


  it('provides a visible focus ring on every interactive element', () => {
    /**
     * The portal never blanket-removes outlines, so it only needs to prove the
     * ring exists. Asserted rather than assumed, because a later `outline:
     * none` added for looks would silently make the whole portal
     * keyboard-hostile.
     */
    const css = readFileSync(join(SRC, 'index.css'), 'utf8')
    expect(css).toMatch(/:focus-visible/)
    expect(css).toMatch(/:focus-visible[\s\S]{0,400}(box-shadow|outline)/)
  })

  it('offers a skip link as the FIRST focusable thing in the layout', () => {
    /**
     * A keyboard user must not have to tab through the whole sidebar to reach
     * the lesson. Order matters as much as existence: a skip link placed after
     * the navigation skips nothing.
     */
    const layout = FILES.find((f) => f.path.endsWith('layout/AdminLayout.jsx'))
    expect(layout, 'AdminLayout.jsx not found').toBeTruthy()

    const skipAt = layout.source.indexOf('Skip to main content')
    const sidebarAt = layout.source.indexOf('<aside')
    expect(skipAt, 'no skip link').toBeGreaterThan(-1)
    expect(skipAt, 'the skip link comes after the sidebar').toBeLessThan(sidebarAt)

    // And it must point at something that exists.
    expect(layout.source).toContain('href="#main-content"')
    expect(layout.source).toContain('id="main-content"')
  })

  it('keeps the skip link visible once focused', () => {
    // `sr-only` alone makes it a trap: focused, active, and invisible.
    const layout = FILES.find((f) => f.path.endsWith('layout/AdminLayout.jsx'))
    const link = layout.source.slice(
      layout.source.indexOf('href="#main-content"'),
      layout.source.indexOf('Skip to main content')
    )
    expect(link).toContain('focus:not-sr-only')
  })

  it('uses semantic landmarks in the layout', () => {
    // The course teaches that a screen-reader user jumps straight to <main>.
    const layout = FILES.find((f) => f.path.endsWith('layout/AdminLayout.jsx'))
    for (const landmark of ['<main', '<header', '<nav', '<aside']) {
      expect(layout.source, `layout has no ${landmark}>`).toContain(landmark)
    }
  })



})
