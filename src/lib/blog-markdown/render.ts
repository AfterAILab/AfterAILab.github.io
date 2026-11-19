/**
 * Markdown → HTML for blog posts. The one renderer both the site (src/pages/blog/[id].astro) and Kakiaji's
 * preview use, so a post looks in the editor as it will on the web. It must stay free of Node and DOM APIs:
 * Kakiaji runs it in JavaScriptCore (see scripts/build-blog-renderer.mjs).
 *
 * - CommonMark + GitHub's tables, strikethrough, task lists, autolinks and footnotes.
 * - A line break between two wide (Japanese) characters is dropped (./join-wide-lines.ts).
 * - Smart punctuation: "…" → “…”, -- → –, ... → ….
 * - Raw HTML in the text is left out, and links or images with a scheme other than http(s), mailto or tel lose it.
 * - Headings get GitHub-style ids; code blocks are coloured by Shiki (github-dark).
 */
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkSmartypants from 'remark-smartypants';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import rehypeShikiFromHighlighter from '@shikijs/rehype/core';
import { createHighlighterCoreSync } from 'shiki/core';
import { createJavaScriptRegexEngine } from 'shiki/engine/javascript';
import GithubSlugger from 'github-slugger';
import { visit } from 'unist-util-visit';
import type { Image, Root as MdastRoot } from 'mdast';
import type { Root as HastRoot, Element, ElementContent } from 'hast';
import remarkJoinWideLines from './join-wide-lines';

import githubDark from 'shiki/themes/github-dark.mjs';
import langBash from 'shiki/langs/bash.mjs';
import langCss from 'shiki/langs/css.mjs';
import langDiff from 'shiki/langs/diff.mjs';
import langGo from 'shiki/langs/go.mjs';
import langHtml from 'shiki/langs/html.mjs';
import langJavascript from 'shiki/langs/javascript.mjs';
import langJson from 'shiki/langs/json.mjs';
import langJsx from 'shiki/langs/jsx.mjs';
import langMarkdown from 'shiki/langs/markdown.mjs';
import langPython from 'shiki/langs/python.mjs';
import langRust from 'shiki/langs/rust.mjs';
import langShellscript from 'shiki/langs/shellscript.mjs';
import langSql from 'shiki/langs/sql.mjs';
import langSwift from 'shiki/langs/swift.mjs';
import langToml from 'shiki/langs/toml.mjs';
import langTsx from 'shiki/langs/tsx.mjs';
import langTypescript from 'shiki/langs/typescript.mjs';
import langYaml from 'shiki/langs/yaml.mjs';

export interface ResolvedImage {
  src: string;
  width?: number;
  height?: number;
  /** The site serves each image at several widths; Kakiaji shows the file itself. */
  srcset?: string;
  sizes?: string;
}

export interface RenderOptions {
  /**
   * Maps an image's `src` as written (e.g. "./photo.jpg", "./写真 1.jpg") to the URL to show. Return undefined to keep it.
   * The site points it at the optimized file; Kakiaji at the file next to the document.
   */
  resolveImage?: (src: string) => ResolvedImage | undefined;
  /** Adds `data-sourcepos="line:col-line:col"` to block elements (Kakiaji opens its preview at the caret's line). */
  sourcePositions?: boolean;
}

const SHIKI_THEME = 'github-dark';

let highlighter: ReturnType<typeof createHighlighterCoreSync> | undefined;
function getHighlighter() {
  highlighter ??= createHighlighterCoreSync({
    themes: [githubDark],
    langs: [
      langBash, langCss, langDiff, langGo, langHtml, langJavascript, langJson, langJsx, langMarkdown, langPython,
      langRust, langShellscript, langSql, langSwift, langToml, langTsx, langTypescript, langYaml,
    ],
    // A fixed target rather than 'auto', so V8 (the site) and JavaScriptCore (Kakiaji) compile the same patterns.
    engine: createJavaScriptRegexEngine({ target: 'ES2018' }),
  });
  return highlighter;
}

const SAFE_URL = /^(?:https?|mailto|tel):/i;
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Empties link targets and image sources the author wrote with an unsafe scheme (javascript:, data:, file: …),
 * as cmark's safe mode does. Runs before images are resolved, so the URLs the site or Kakiaji put in stay.
 */
function remarkSafeUrls() {
  return (tree: MdastRoot) => {
    visit(tree, (node) => {
      if (node.type === 'link' || node.type === 'image' || node.type === 'definition') {
        const url = node.url.trim();
        if (HAS_SCHEME.test(url) && !SAFE_URL.test(url)) node.url = '';
      }
    });
  };
}

function textOf(node: ElementContent | Element): string {
  if (node.type === 'text') return node.value;
  if (node.type === 'element') return node.children.map(textOf).join('');
  return '';
}

/** GitHub-style ids on headings, so a section can be linked to. */
function rehypeHeadingIds() {
  return (tree: HastRoot) => {
    const slugger = new GithubSlugger();
    visit(tree, 'element', (node: Element) => {
      if (/^h[1-6]$/.test(node.tagName) && node.properties.id === undefined) {
        node.properties.id = slugger.slug(textOf(node));
      }
    });
  };
}

/** Collects the definitions of reference-style links and images (`[ref]: url`). */
function definitions(tree: MdastRoot): Map<string, string> {
  const urls = new Map<string, string>();
  visit(tree, 'definition', (node) => {
    if (!urls.has(node.identifier)) urls.set(node.identifier, node.url);
  });
  return urls;
}

/** Every image's src as written, reference-style ones (`![alt][ref]`) included. */
function eachImage(tree: MdastRoot, fn: (node: Image) => void): void {
  const urls = definitions(tree);
  visit(tree, (node, index, parent) => {
    if (node.type === 'imageReference' && parent && index !== undefined) {
      const url = urls.get(node.identifier);
      if (url === undefined) return;
      // Make it a plain image, so it is resolved like one.
      const image: Image = { type: 'image', url, alt: node.alt, position: node.position };
      parent.children[index] = image;
      fn(image);
    } else if (node.type === 'image') {
      fn(node);
    }
  });
}

function remarkImages(resolve: RenderOptions['resolveImage']) {
  return () => (tree: MdastRoot) => {
    eachImage(tree, (node) => {
      const resolved = resolve?.(node.url);
      const properties: Record<string, string | number> = { loading: 'lazy', decoding: 'async' };
      if (resolved) {
        node.url = resolved.src;
        if (resolved.width) properties.width = resolved.width;
        if (resolved.height) properties.height = resolved.height;
        if (resolved.srcset) properties.srcSet = resolved.srcset;
        if (resolved.sizes) properties.sizes = resolved.sizes;
      }
      node.data = { ...node.data, hProperties: { ...node.data?.hProperties, ...properties } };
    });
  };
}

const BLOCKS = new Set([
  'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'pre', 'table', 'hr', 'section',
]);

function rehypeSourcePositions(enabled: boolean) {
  return () => (tree: HastRoot) => {
    if (!enabled) return;
    visit(tree, 'element', (node: Element) => {
      const p = node.position;
      if (!p || !BLOCKS.has(node.tagName)) return;
      node.properties.dataSourcepos = `${p.start.line}:${p.start.column}-${p.end.line}:${p.end.column}`;
    });
  };
}

/** The image sources a post refers to, as written. The site resolves them (asynchronously) before rendering. */
export function imageSources(markdown: string): string[] {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as MdastRoot;
  const sources = new Set<string>();
  eachImage(tree, (node) => sources.add(node.url));
  return [...sources];
}

export function renderBlogMarkdown(markdown: string, options: RenderOptions = {}): string {
  const html = unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkJoinWideLines)
    // "--" is an en dash and "---" an em dash.
    .use(remarkSmartypants, { dashes: 'oldschool' })
    .use(remarkSafeUrls)
    .use(remarkImages(options.resolveImage))
    // No allowDangerousHtml: raw HTML is left out.
    .use(remarkRehype, { footnoteLabel: '脚注', footnoteBackLabel: '本文へ戻る' })
    .use(rehypeHeadingIds)
    .use(rehypeSourcePositions(options.sourcePositions ?? false))
    .use(rehypeShikiFromHighlighter, getHighlighter(), {
      theme: SHIKI_THEME,
      // No time limit per line: with one, a slow first run (grammar compilation) left the rest of a line
      // uncoloured, so the result depended on the machine and Kakiaji's preview could differ from the site.
      tokenizeTimeLimit: 0,
      defaultLanguage: 'text',
      fallbackLanguage: 'text',
    })
    .use(rehypeStringify)
    .processSync(markdown);
  return String(html);
}
