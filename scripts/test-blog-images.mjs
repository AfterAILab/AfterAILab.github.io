#!/usr/bin/env node
// Runs the build's image check (src/lib/blog-images.ts) on images Kakiaji re-encoded for a post
// (scripts/fixtures/kakiaji-images/: a Display P3 camera photo with location and a rotation flag, the same as
// HEIC, a transparent P3 PNG, a screenshot, a narrow tall photo). Each must pass, and must be what Kakiaji says it
// made. A photo carrying EXIF, made here, must fail, so a check that passes everything is caught too.
// Regenerate the fixtures with Kakiaji (after make sync-renderer there):
// `../kakiaji/.build/debug/Kakiaji --blog-samples scripts/fixtures/kakiaji-images`.
// Usage: pnpm test:blog-images   (Node 23.6+, which runs TypeScript)
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const { problems } = await import(join(root, 'src/lib/blog-images.ts'));
const folder = join(root, 'scripts/fixtures/kakiaji-images');

const expected = {
  'camera-p3-portrait.jpg': [1600, 2133],
  'camera-heic.jpg': [1600, 2133],
  'transparent-p3.png': [1600, 800],
  'screenshot.png': [1600, 1067],
  'tall-narrow.jpg': [1200, 2400],
};

let failed = 0;
const files = readdirSync(folder).sort();
if (files.join() !== Object.keys(expected).sort().join()) {
  failed++;
  console.error(`✗ fixtures: expected ${Object.keys(expected).sort().join(', ')}, found ${files.join(', ')}`);
}
for (const file of files) {
  const path = join(folder, file);
  const found = await problems(path);
  const meta = await sharp(path).metadata();
  const [width, height] = expected[file] ?? [];
  if (found.length || meta.width !== width || meta.height !== height) {
    failed++;
    console.error(`✗ ${file}: ${meta.width}×${meta.height} ${found.join('、')}`);
  }
}

const scratch = mkdtempSync(join(tmpdir(), 'blog-images-'));
const control = join(scratch, 'exif.jpg');
await sharp({ create: { width: 10, height: 10, channels: 3, background: '#c00' } })
  .withExif({ IFD0: { Model: 'iPhone' } })
  .jpeg()
  .toFile(control);
if (!(await problems(control)).some((p) => p.startsWith('EXIF'))) {
  failed++;
  console.error('✗ the check let a photo with EXIF through');
}

rmSync(scratch, { recursive: true, force: true });

console.log(`${files.length + 1 - failed}/${files.length + 1} image checks hold`);
process.exit(failed ? 1 : 0);
