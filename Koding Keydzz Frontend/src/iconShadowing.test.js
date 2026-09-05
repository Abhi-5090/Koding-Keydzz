import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'

/**
 * NO ICON MAY SHADOW A JAVASCRIPT GLOBAL.
 *
 * THE BUG THIS EXISTS FOR
 * -----------------------
 * `lucide-react` exports an icon called `Map`. WorldDetail.jsx imported it —
 *
 *     import { ..., Map } from 'lucide-react'
 *
 * — which shadows the global `Map` CONSTRUCTOR for the entire module. The
 * `new Map()` further down then tried to construct a React component and threw
 * `TypeError: Map is not a constructor`.
 *
 * Every world page crashed. And it was close to undiagnosable from what the
 * user saw, for three compounding reasons:
 *
 *   1. Minified, the message read `te is not a constructor` and pointed at a
 *      `useMemo` in a hashed bundle.
 *   2. The route error boundary caught it and rendered "the connection dropped
 *      while it was loading" — so it presented as a NETWORK fault.
 *   3. It only appears at runtime, on one route, after the data has loaded.
 *
 * lucide also exports `Image`, `Text`, `Filter`, `Option`, `Range`, `Menu`,
 * `History`, `Table`, `Screen` and more — every one a name that means something
 * else in a browser. So the rule is: import them ALIASED, always, whether or
 * not this file happens to construct one today. The landmine is the `new Map()`
 * somebody adds next month, in a file where the import looks harmless.
 */

/** Global names that lucide also exports as icons. Aliasing is mandatory. */
const SHADOWABLE = [
  'Map',
  'Set',
  'Image',
  'Text',
  'Filter',
  'Option',
  'Range',
  'History',
  'Table',
  'Menu',
  'Screen',
  'Location',
  'Navigator',
  'Selection',
  'Notification',
]

function sourceFiles(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue
    const full = path.join(dir, entry)
    if (statSync(full).isDirectory()) sourceFiles(full, out)
    else if (/\.jsx?$/.test(entry) && !/\.test\.jsx?$/.test(entry)) out.push(full)
  }
  return out
}

/** The `{ ... }` of every `from 'lucide-react'` import in a file. */
function lucideImports(source) {
  const out = []
  const re = /import\s*\{([\s\S]*?)\}\s*from\s*['"]lucide-react['"]/g
  let m
  while ((m = re.exec(source))) out.push(m[1])
  return out
}

describe('lucide icons never shadow a JavaScript global', () => {
  const files = sourceFiles(path.resolve(__dirname))

  it('scans a realistic number of files', () => {
    // A broken walker that found nothing would make every assertion below
    // pass silently, which is the classic way a guard like this rots.
    expect(files.length).toBeGreaterThan(30)
  })

  it('imports every shadowing icon under an alias', () => {
    const offenders = []

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
      for (const block of lucideImports(source)) {
        // Strip aliased forms first: `Map as MapIcon` is exactly what we want.
        const withoutAliases = block.replace(/\b\w+\s+as\s+\w+/g, '')
        for (const name of SHADOWABLE) {
          if (new RegExp(`(^|,)\\s*${name}\\s*(,|$)`).test(withoutAliases)) {
            offenders.push(
              `${path.relative(path.resolve(__dirname, '..'), file)} imports \`${name}\` ` +
                `unaliased — use \`${name} as ${name}Icon\``
            )
          }
        }
      }
    }

    expect(
      offenders,
      `these imports shadow a JavaScript global:\n  ${offenders.join('\n  ')}`
    ).toEqual([])
  })

  it('catches the exact bug that broke every world page', () => {
    /**
     * A regression test for the scanner itself, not the source tree. If the
     * regex above stopped matching, the test above would pass on an empty
     * list and prove nothing — so the detector is fed the original broken
     * import and required to flag it.
     */
    const broken = `import { ArrowLeft, Circle, Map } from 'lucide-react'`
    const block = lucideImports(broken)[0]
    const withoutAliases = block.replace(/\b\w+\s+as\s+\w+/g, '')
    expect(/(^|,)\s*Map\s*(,|$)/.test(withoutAliases)).toBe(true)

    const fixed = `import { ArrowLeft, Circle, Map as MapIcon } from 'lucide-react'`
    const fixedBlock = lucideImports(fixed)[0].replace(/\b\w+\s+as\s+\w+/g, '')
    expect(/(^|,)\s*Map\s*(,|$)/.test(fixedBlock)).toBe(false)
  })
})
