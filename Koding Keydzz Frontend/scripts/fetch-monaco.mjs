/**
 * Copy the Monaco editor into `public/monaco/vs` so it is served from this
 * app's own origin instead of a public CDN.
 *
 * WHY THIS EXISTS
 * ---------------
 * `@monaco-editor/react` ships only a loader; the ~3 MB editor is fetched at
 * runtime, from jsDelivr by default. School networks routinely filter public
 * CDNs, and when this one is filtered the Playground and both programming
 * games (66 levels between them) have no editor — with nothing but a console
 * line to say why.
 *
 * `monaco-editor` is already a dependency, so the files are on disk after
 * `npm ci`. This just copies them where Vite will serve them.
 *
 * USAGE
 *   npm run fetch:monaco     # run after npm ci, before npm run build
 *
 * The output is gitignored (it is a build artifact, ~3 MB), so CI and each
 * deployment run this step.
 */
import { cp, mkdir, stat, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const SRC = join(root, 'node_modules', 'monaco-editor', 'min', 'vs');
const DEST = join(root, 'public', 'monaco', 'vs');

if (!existsSync(SRC)) {
  console.error(
    `Cannot find ${SRC}\n` +
      'Is `monaco-editor` installed? Run `npm ci` first.'
  );
  process.exit(1);
}

// Fail loudly if the installed version has drifted from the one the app
// declares: a mismatched editor is exactly the bug this replaces.
const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'));
const declared = String(pkg.dependencies['monaco-editor'] || '').replace(/^[\^~]/, '');
const installed = JSON.parse(
  await readFile(join(root, 'node_modules', 'monaco-editor', 'package.json'), 'utf8')
).version;
if (declared && installed !== declared) {
  console.warn(
    `[fetch:monaco] WARNING: package.json declares monaco-editor ${declared} ` +
      `but ${installed} is installed. Update MONACO_VERSION in src/lib/monacoLoader.js.`
  );
}

await mkdir(dirname(DEST), { recursive: true });
await cp(SRC, DEST, { recursive: true });

const { size } = await stat(join(DEST, 'loader.js'));
console.log(`Copied monaco-editor ${installed} -> public/monaco/vs`);
console.log(`  loader.js present (${size} bytes)`);
console.log('  The app loads /monaco/vs by default — no env var needed.');
