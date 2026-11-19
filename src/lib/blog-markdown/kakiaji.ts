/**
 * Entry point of the renderer bundle Kakiaji runs in JavaScriptCore (built by scripts/build-blog-renderer.mjs).
 *
 * - `BlogMarkdown.render(markdown, imageBase)` for the preview; `imageBase` is the URL relative image paths
 *   resolve against (the document's folder), or an empty string to leave them as written.
 * - `BlogMarkdown.inspect(markdown)` and `BlogMarkdown.rewriteImages(markdown, paths)` for posting a text to the
 *   blog (./publish.ts).
 */
// First: JavaScriptCore has no console, and Shiki warns through it while loading grammars.
import './jsc-console';
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

(globalThis as { BlogMarkdown?: unknown }).BlogMarkdown = {
  render,
  inspect: inspectPost,
  rewriteImages: rewritePostImages,
};
