/**
 * Entry point of the renderer bundle Kakiaji runs in JavaScriptCore (built by scripts/build-blog-renderer.mjs).
 *
 * - `BlogMarkdown.render(markdown, imageBase)` for the preview; `imageBase` is the URL relative image paths
 *   resolve against (the document's folder), or an empty string to leave them as written.
 * - `BlogMarkdown.inspect(markdown)` and `BlogMarkdown.rewriteImages(markdown, paths)` for posting a text to the
 *   blog (./publish.ts).
 * - `BlogMarkdown.siteID(fileName)`: the id (and URL) the site gives a post's file, so Kakiaji can tell whether a
 *   new post's id is already some other file's.
 */
// First: JavaScriptCore has no console, and Shiki warns through it while loading grammars.
import './jsc-console';
import { slug } from 'github-slugger';
import { inspectPost, rewritePostImages } from './publish';
import { renderBlogMarkdown } from './render';

const RELATIVE = /^(?![a-z][a-z0-9+.-]*:|\/|#)/i;

function render(markdown: string, imageBase = ''): string {
  return renderBlogMarkdown(markdown, {
    sourcePositions: true,
    resolveImage: (src) => {
      if (!imageBase || !src || !RELATIVE.test(src)) return undefined;
      const path = src.replace(/^\.\//, '');
      // Encode each segment, so names with spaces or Japanese resolve to the file on disk.
      const encoded = path.split('/').map((part) => encodeURIComponent(safeDecode(part))).join('/');
      return { src: imageBase.replace(/\/?$/, '/') + encoded };
    },
  });
}

function safeDecode(part: string): string {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/**
 * The id Astro's glob loader gives a file in src/content/blog (no `slug` in its front matter): the name without its
 * extension, through github-slugger (astro/dist/content/utils.js `getContentEntryIdAndSlug`).
 */
function siteID(fileName: string): string {
  const dot = fileName.lastIndexOf('.');
  return slug(dot > 0 ? fileName.slice(0, dot) : fileName);
}

(globalThis as { BlogMarkdown?: unknown }).BlogMarkdown = {
  siteID,
  render,
  inspect: inspectPost,
  rewriteImages: rewritePostImages,
};
