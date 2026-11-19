import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';
import blogRules from './blog-rules.json';

/**
 * ./blog-rules.json, checked when the build loads it: it is the only switch for these checks (and Kakiaji's copy),
 * so a typo must fail loudly rather than quietly turn a check off.
 */
const rules = (() => {
  const { images } = blogRules;
  const known = new Set(['exif', 'xmp', 'iptc', 'icc']);
  const strings = (list: unknown) => Array.isArray(list) && list.every((e) => typeof e === 'string');
  if (!strings(images.extensions) || !strings(images.rejectedExtensions) || !strings(images.rejectedMetadata)) {
    throw new Error('src/lib/blog-rules.json: extensions, rejectedExtensions and rejectedMetadata must be lists of strings');
  }
  const problems = [
    Number.isInteger(images.maxWidth) && images.maxWidth > 0 ? '' : 'maxWidth',
    Number.isInteger(images.jpegQuality) && images.jpegQuality > 0 && images.jpegQuality <= 100 ? '' : 'jpegQuality',
    ...[...images.extensions, ...images.rejectedExtensions].filter((e) => !/^[a-z0-9]+$/.test(e)).map((e) => `extension "${e}"`),
    ...images.rejectedMetadata.filter((m) => !known.has(m)).map((m) => `rejectedMetadata "${m}"`),
    ...[...known].filter((m) => !images.rejectedMetadata.includes(m)).map((m) => `rejectedMetadata lacks "${m}"`),
  ].filter(Boolean);
  if (problems.length) throw new Error(`src/lib/blog-rules.json: ${problems.join(', ')}`);
  return blogRules;
})();

/** Widest image a post may carry (./blog-rules.json, shared with scripts/blog-images.sh and Kakiaji). */
export const BLOG_IMAGE_MAX_WIDTH = rules.images.maxWidth;
/** The widths the site serves a post's image at (srcset). */
export const BLOG_IMAGE_WIDTHS = [400, 800, 1600];

/** "jpg" for "a/写真.JPG" (and for a file named ".jpg"); empty for a name without a dot. */
const extension = (file: string) => {
  const name = file.slice(file.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot + 1).toLowerCase() : '';
};
const IMAGE_EXTENSIONS = new Set([...rules.images.extensions, ...rules.images.rejectedExtensions]);
const REJECTED_EXTENSIONS = new Set(rules.images.rejectedExtensions);
const ROOT = 'src/content/blog';

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : IMAGE_EXTENSIONS.has(extension(e.name)) ? [join(dir, e.name)] : [])),
  );
  return files.flat();
}

/** What is wrong with one image for publishing, if anything. */
async function problems(file: string): Promise<string[]> {
  const ext = extension(file);
  if (REJECTED_EXTENSIONS.has(ext)) return [`${ext.toUpperCase()}(JPG に変換する)`];
  const meta = await sharp(file).metadata();
  const found: string[] = [];
  if ((meta.width ?? 0) > BLOG_IMAGE_MAX_WIDTH) found.push(`幅 ${meta.width}px(${BLOG_IMAGE_MAX_WIDTH}px まで)`);
  // All four are always checked: the JSON must list each of them (validated above) and cannot switch one off.
  if (meta.exif) found.push('EXIF(撮影位置・機種・日時など)');
  if (meta.xmp) found.push('XMP');
  if (meta.iptc) found.push('IPTC');
  if (meta.icc) found.push('ICC プロファイル');
  return found;
}

let checked: Promise<void> | undefined;

/**
 * Fails the build when an image under src/content/blog/ is not ready to publish: too wide, carrying metadata
 * (the repository is public, so a photo's location would be readable there), or HEIC.
 * Every image there counts, used by a post or not. scripts/blog-images.sh fixes them all.
 */
export function checkBlogImages(): Promise<void> {
  checked ??= (async () => {
    const files = await walk(ROOT);
    const bad = (await Promise.all(files.map(async (f) => [f, await problems(f)] as const))).filter(([, p]) => p.length);
    if (bad.length) {
      const list = bad.map(([f, p]) => `  ${relative(process.cwd(), f)}: ${p.join('、')}`).join('\n');
      throw new Error(`Blog の画像が公開できる形になっていません。scripts/blog-images.sh を実行してください。\n${list}`);
    }
  })();
  return checked;
}
