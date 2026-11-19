import { readdir } from 'node:fs/promises';
import { join, relative } from 'node:path';
import sharp from 'sharp';

/** Widest image a post may carry, and the widths the site serves it at (srcset). Keep in step with scripts/blog-images.sh. */
export const BLOG_IMAGE_MAX_WIDTH = 1600;
export const BLOG_IMAGE_WIDTHS = [400, 800, 1600];

const IMAGE = /\.(jpe?g|png|webp|gif|avif|heic)$/i;
const ROOT = 'src/content/blog';

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const files = await Promise.all(
    entries.map((e) => (e.isDirectory() ? walk(join(dir, e.name)) : IMAGE.test(e.name) ? [join(dir, e.name)] : [])),
  );
  return files.flat();
}

/** What is wrong with one image for publishing, if anything. */
async function problems(file: string): Promise<string[]> {
  if (/\.heic$/i.test(file)) return ['HEIC(JPG に変換する)'];
  const meta = await sharp(file).metadata();
  const found: string[] = [];
  if ((meta.width ?? 0) > BLOG_IMAGE_MAX_WIDTH) found.push(`幅 ${meta.width}px(${BLOG_IMAGE_MAX_WIDTH}px まで)`);
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
