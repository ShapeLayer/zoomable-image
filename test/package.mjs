import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

// Verify the artifact installed by a consumer, independent of workspace links.
const folder = mkdtempSync(join(tmpdir(), 'zoomable-image-package-'));
const npm = process.platform === 'win32' ? 'npm.cmd' : 'npm';
const run = (command, args, cwd = folder) =>
  execFileSync(command, args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
try {
  const packed = JSON.parse(
    run(
      npm,
      ['pack', '--json', '--pack-destination', folder, '--cache', join(folder, 'cache')],
      process.cwd()
    )
  )[0];
  const paths = packed.files.map((file) => file.path);
  for (const path of [
    'dist/index.js',
    'dist/index.d.ts',
    'dist/register.js',
    'LICENSE',
    'README.md',
    'custom-elements.json',
    'CHANGELOG.md'
  ])
    assert(paths.includes(path), `Missing ${path}`);
  assert(
    paths.every(
      (path) =>
        path.startsWith('dist/') ||
        ['LICENSE', 'README.md', 'custom-elements.json', 'CHANGELOG.md', 'package.json'].includes(
          path
        )
    ),
    'Unexpected source/test file in archive'
  );
  writeFileSync(join(folder, 'package.json'), '{"private":true,"type":"module"}');
  run(npm, [
    'install',
    '--ignore-scripts',
    '--no-audit',
    '--no-fund',
    '--cache',
    join(folder, 'cache'),
    join(folder, packed.filename)
  ]);
  const installed = JSON.parse(
    readFileSync(join(folder, 'node_modules/@shapelayer/zoomable-image/package.json'), 'utf8')
  );
  assert.equal(installed.license, 'MIT');
  assert.equal(installed.dependencies, undefined);
  writeFileSync(
    join(folder, 'consumer.mjs'),
    `import { ZoomableImage, defineZoomableImage } from '@shapelayer/zoomable-image';\nimport '@shapelayer/zoomable-image/register';\nif (typeof ZoomableImage !== 'function') throw new Error('Missing export');\ndefineZoomableImage();\n`
  );
  run(process.execPath, ['consumer.mjs']);
  writeFileSync(
    join(folder, 'consumer.ts'),
    `import { defineZoomableImage, type ImageAnnotation, type ZoomableImage } from '@shapelayer/zoomable-image';\nconst region: ImageAnnotation = { id: 'a', x: 0, y: 0, width: 10, height: 10, text: 'Region' };\nconst image: ZoomableImage = document.createElement('zoomable-image');\nimage.annotations = [region]; image.addEventListener('zoomable-zoom', event => { const scale: number = event.detail.scale; console.log(scale); }); image.caption = 'Caption'; image.open(); defineZoomableImage();\n`
  );
  const tsc = fileURLToPath(import.meta.resolve('typescript/bin/tsc'));
  run(process.execPath, [
    tsc,
    '--strict',
    '--noEmit',
    '--target',
    'ES2022',
    '--module',
    'NodeNext',
    '--lib',
    'ES2022,DOM,DOM.Iterable',
    'consumer.ts'
  ]);
  console.log(
    `Verified installed ${installed.name}@${installed.version}: ESM, SSR, register entry, types, license and file allowlist (${packed.size} bytes).`
  );
} finally {
  rmSync(folder, { recursive: true, force: true });
}
