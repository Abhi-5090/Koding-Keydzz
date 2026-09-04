/**
 * Download the Pyodide runtime for SELF-HOSTING.
 *
 * WHY SELF-HOST
 * -------------
 * Python in the Playground and in every in-lesson "Try It" editor runs on
 * Pyodide (CPython compiled to WebAssembly). By default it loads from the
 * public jsDelivr CDN, and two things go wrong with that in a school:
 *
 *   1. School networks routinely block public CDNs. When jsDelivr is filtered
 *      every Python lesson fails with "couldn't load the Python engine" — in
 *      exactly the environment this product is sold into.
 *   2. It is ~13 MB per device. Served from your own origin the proxy caches
 *      it once instead of it crossing the school's uplink thirty times when a
 *      class starts.
 *
 * WHY THIS IS A SCRIPT AND NOT COMMITTED
 * --------------------------------------
 * These are 13 MB of binaries. Git keeps them for the life of the repository,
 * so every clone pays for them forever. They are fetched on demand instead,
 * and the build fails loudly if it is configured to use them and they are
 * missing (see vite.config.js) — so a deploy cannot silently fall back to a
 * blocked CDN.
 *
 * USAGE
 *   npm run fetch:pyodide
 *   # then set, in the build environment:
 *   #   VITE_PYODIDE_URL=/pyodide/v0.26.4/full/
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const VERSION = '0.26.4';
const BASE = `https://cdn.jsdelivr.net/pyodide/v${VERSION}/full`;

/**
 * The CORE runtime only — enough for the plain Python the lessons use
 * (arithmetic, strings, lists, loops, functions). The full distribution also
 * carries numpy, pandas and friends, which would be hundreds of megabytes and
 * are not part of the curriculum.
 */
const FILES = [
  'pyodide.js',
  'pyodide.mjs',
  'pyodide.asm.js',
  'pyodide.asm.wasm',
  'python_stdlib.zip',
  'pyodide-lock.json',
];

const here = dirname(fileURLToPath(import.meta.url));
const OUT_DIR = join(here, '..', 'public', 'pyodide', `v${VERSION}`, 'full');

const mb = (bytes) => `${(bytes / 1024 / 1024).toFixed(1)} MB`;

await mkdir(OUT_DIR, { recursive: true });

let total = 0;
let skipped = 0;

for (const file of FILES) {
  const dest = join(OUT_DIR, file);

  // Idempotent: skip anything already downloaded.
  try {
    const existing = await stat(dest);
    if (existing.size > 0) {
      console.log(`  ${file.padEnd(22)} already present (${mb(existing.size)})`);
      total += existing.size;
      skipped += 1;
      continue;
    }
  } catch {
    /* not downloaded yet */
  }

  process.stdout.write(`  ${file.padEnd(22)} downloading… `);
  const res = await fetch(`${BASE}/${file}`, { signal: AbortSignal.timeout(300_000) });
  if (!res.ok) {
    console.error(`FAILED (${res.status})`);
    console.error(
      `\nCould not download ${file} from ${BASE}.\n` +
        'Check your network, or download the Pyodide release manually and copy its\n' +
        `\`full/\` directory to ${OUT_DIR}\n`
    );
    process.exit(1);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  await writeFile(dest, buf);
  total += buf.length;
  console.log(mb(buf.length));
}

console.log(`\nPyodide ${VERSION} ready in public/pyodide/v${VERSION}/full (${mb(total)} total${skipped ? `, ${skipped} already present` : ''}).`);
console.log('\nNow build with:');
console.log(`  VITE_PYODIDE_URL=/pyodide/v${VERSION}/full/ npm run build\n`);
