/**
 * What Kakiaji needs to post a text to the blog (kakiaji/docs/blog-publishing.md): the images a text refers to,
 * rewriting their paths, and what to warn about before the text becomes a public file. It parses exactly as the
 * site does (remark + GFM, ./render.ts), so what it finds is what the build sees. Like render.ts it must stay free
 * of Node and DOM APIs: Kakiaji runs it in JavaScriptCore.
 *
 * Positions are 1-based lines and columns of the text given (front matter already removed, so Kakiaji adds its
 * own offset for line numbers it shows). A column counts characters (UTF-16 code units, as JavaScript strings and
 * NSString do): a tab counts as one, and on the first line a byte order mark is not counted. Offsets, used only
 * inside this file, count UTF-16 code units from after a byte order mark.
 */
import { unified, type Processor } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import { visit } from 'unist-util-visit';
import type { Definition, Image, Node, Nodes as MdastNode, Root as MdastRoot } from 'mdast';

/** An image the text shows, in the order it appears. A reference-style image (`![a][p]`) is where it is used. */
export interface PostImage {
  /** The source as parsed (escapes resolved, `<…>` removed, not percent-decoded). */
  url: string;
  line: number;
  column: number;
}

export interface PostHtml {
  /** Raw HTML or an HTML comment: the page leaves it out, but the .md file in the public repository shows it. */
  value: string;
  line: number;
  column: number;
}

export interface PostLink {
  /** A link's target, an autolink, or a definition's URL (`[p]: url`), as parsed. */
  url: string;
  /**
   * `definition` for `[p]: url` (which images may use too: Kakiaji can tell those from links to warn about).
   * GitHub-style autolinks found in plain text (`www.example.com`) are `link`s.
   */
  kind: 'link' | 'definition';
  /**
   * Where it was written. An autolink found in plain text has no position of its own; it takes its paragraph's
   * (or other enclosing block's), so the line may be earlier than the link's own.
   */
  line: number;
  column: number;
}

export interface PostCode {
  /** The code's text, inline or a block. */
  value: string;
  line: number;
  endLine: number;
}

export interface PostInspection {
  images: PostImage[];
  html: PostHtml[];
  links: PostLink[];
  code: PostCode[];
}

/** Where a destination was written, `<` and `>` included, as offsets into the text. */
interface Span {
  start: number;
  end: number;
}

const DESTINATION = 'postDestination';

/**
 * Records on each image, link and definition where its destination was written. mdast keeps only the whole
 * node's position; the destination's own tokens (`resourceDestination`, `definitionDestination`) have no
 * default handler, so handling their exit adds to the tree without changing it. At that exit the node is on
 * top of the stack (its destination string was buffered and resumed inside).
 */
function remarkDestinations(this: Processor) {
  const data = this.data() as { fromMarkdownExtensions?: unknown[] };
  const record = function (this: { stack: Node[] }, token: { start: { offset?: number }; end: { offset?: number } }) {
    const node = this.stack[this.stack.length - 1];
    if (token.start.offset === undefined || token.end.offset === undefined) return;
    node.data = { ...node.data, [DESTINATION]: { start: token.start.offset, end: token.end.offset } } as Node['data'];
  };
  (data.fromMarkdownExtensions ??= []).push({ exit: { resourceDestination: record, definitionDestination: record } });
}

function parse(markdown: string): MdastRoot {
  return unified().use(remarkParse).use(remarkGfm).use(remarkDestinations).parse(markdown) as MdastRoot;
}

function destination(node: Node): Span | undefined {
  return (node.data as Record<string, Span | undefined> | undefined)?.[DESTINATION];
}

/** The first definition of each identifier, which is the one references use (CommonMark). */
function definitionsOf(tree: MdastRoot): Map<string, Definition> {
  const found = new Map<string, Definition>();
  visit(tree, 'definition', (node) => {
    if (!found.has(node.identifier)) found.set(node.identifier, node);
  });
  return found;
}

/** Calls `fn` for every node in document order, with its ancestors (root first). */
function walk(node: Node, fn: (node: MdastNode, ancestors: Node[]) => void, ancestors: Node[] = []): void {
  fn(node as MdastNode, ancestors);
  const children = (node as { children?: Node[] }).children;
  if (children) for (const child of children) walk(child, fn, [...ancestors, node]);
}

/** Where a node starts; a node without a position (an autolink GFM found in text) takes its nearest ancestor's. */
function start(node: Node, ancestors: Node[]): { line: number; column: number } {
  const positioned = [node, ...[...ancestors].reverse()].find((n) => n.position);
  return { line: positioned?.position?.start.line ?? 1, column: positioned?.position?.start.column ?? 1 };
}

/** The images, raw HTML, links and code in a text (front matter already removed). */
export function inspectPost(markdown: string): PostInspection {
  const tree = parse(markdown);
  const definitions = definitionsOf(tree);
  const result: PostInspection = { images: [], html: [], links: [], code: [] };
  walk(tree, (node, ancestors) => {
    const at = () => start(node, ancestors);
    switch (node.type) {
      case 'image':
        result.images.push({ url: node.url, ...at() });
        break;
      case 'imageReference': {
        const definition = definitions.get(node.identifier);
        if (definition) result.images.push({ url: definition.url, ...at() });
        break;
      }
      case 'html':
        result.html.push({ value: node.value, ...at() });
        break;
      case 'link':
      case 'definition':
        result.links.push({ url: node.url, kind: node.type, ...at() });
        break;
      case 'code':
      case 'inlineCode':
        result.code.push({ value: node.value, line: at().line, endLine: node.position?.end.line ?? at().line });
        break;
    }
  });
  return result;
}

/** A destination as Markdown: bare when it can be, otherwise in `<…>`. `&` is escaped so no entity is read. */
function writeDestination(url: string): string {
  if (/[\r\n]/.test(url)) throw new Error(`an image path cannot contain a line break: ${JSON.stringify(url)}`);
  if (url && !/[\s<>()\\]/.test(url)) return url.replace(/&/g, '\\&');
  return `<${url.replace(/[<>\\&]/g, '\\$&')}>`;
}

/** A tree as plain data, without positions or the destinations this file records. */
function shape(tree: MdastRoot): string {
  return JSON.stringify(tree, (key, value) => (key === 'position' || key === 'data' ? undefined : value));
}

/**
 * Rewrites the paths of images: every image whose source (as `inspectPost` reports it) is a key of `paths` gets
 * the value instead, whether written inline (`![a](写真.heic "t")`, `![a](<写真 1.png>)`) or through a definition
 * an image uses (`[p]: 写真.heic`). Only the destination is replaced; alt text, titles and everything else stay
 * as written. A definition used by both an image and a link changes for both.
 *
 * Throws unless the result parses to exactly the original document with only those paths changed: a new path
 * must not change the structure around it (a `|` that splits a table cell, say).
 */
export function rewritePostImages(markdown: string, paths: Record<string, string>): string {
  const want = new Map(Object.entries(paths));
  const tree = parse(markdown);
  const definitions = definitionsOf(tree);
  const spans = new Map<number, { span: Span; url: string }>();
  const changed = new Set<Image | Definition>();
  const replace = (node: Image | Definition) => {
    const url = want.get(node.url);
    if (url === undefined) return;
    const span = destination(node);
    if (!span) throw new Error(`no written destination to replace for image ${JSON.stringify(node.url)}`);
    spans.set(span.start, { span, url });
    changed.add(node);
  };
  visit(tree, (node) => {
    if (node.type === 'image') replace(node);
    else if (node.type === 'imageReference') {
      const definition = definitions.get(node.identifier);
      if (definition) replace(definition);
    }
  });

  // The parser skips a leading byte order mark and counts offsets from after it.
  const bom = markdown.startsWith('\uFEFF') ? 1 : 0;
  let out = markdown;
  // From the end, so earlier offsets stay valid.
  for (const { span, url } of [...spans.values()].sort((a, b) => b.span.start - a.span.start)) {
    out = out.slice(0, bom + span.start) + writeDestination(url) + out.slice(bom + span.end);
  }

  // What the original would be with just the new paths, against what the rewritten text actually is.
  for (const node of changed) node.url = want.get(node.url)!;
  if (shape(tree) !== shape(parse(out))) {
    throw new Error(`rewriting image paths would change more than the paths: ${JSON.stringify(paths)}`);
  }
  return out;
}
