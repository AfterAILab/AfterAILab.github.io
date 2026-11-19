import type { Root, Nodes, Parent } from 'mdast';

/**
 * Whether a character is wide (Japanese, Chinese, Korean, full-width forms). A line break between two
 * wide characters is dropped, because browsers (WebKit and Chromium) would show it as a space, which
 * Japanese text never has.
 */
export function isWide(codePoint: number): boolean {
  return (
    (codePoint >= 0x1100 && codePoint <= 0x115f) || // Hangul Jamo initials
    (codePoint >= 0x2e80 && codePoint <= 0x303e) || // CJK radicals, Kangxi, ideographic description, CJK symbols and punctuation
    (codePoint >= 0x3041 && codePoint <= 0x33ff) || // kana, Bopomofo, Hangul compatibility, Kanbun, CJK strokes, enclosed and compatibility
    (codePoint >= 0x3400 && codePoint <= 0x4dbf) || // CJK extension A
    (codePoint >= 0x4e00 && codePoint <= 0x9fff) || // CJK unified ideographs
    (codePoint >= 0xa000 && codePoint <= 0xa4cf) || // Yi
    (codePoint >= 0xf900 && codePoint <= 0xfaff) || // CJK compatibility ideographs
    (codePoint >= 0xfe30 && codePoint <= 0xfe4f) || // CJK compatibility forms
    (codePoint >= 0xff00 && codePoint <= 0xff60) || // full-width forms
    (codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
    (codePoint >= 0x20000 && codePoint <= 0x3fffd) // CJK extensions B and later
  );
}

function lastCodePoint(text: string): number | undefined {
  if (!text) return undefined;
  const low = text.charCodeAt(text.length - 1);
  if (low >= 0xdc00 && low <= 0xdfff && text.length >= 2) return text.codePointAt(text.length - 2);
  return low;
}

function firstCodePoint(text: string): number | undefined {
  return text ? text.codePointAt(0) : undefined;
}

/** The last character a phrasing node shows, looking inside emphasis, links and the like. */
function lastCharacter(node: Nodes | undefined): number | undefined {
  if (!node) return undefined;
  if (node.type === 'text' || node.type === 'inlineCode') return lastCodePoint(node.value);
  if ('children' in node) return lastCharacter(node.children.at(-1) as Nodes | undefined);
  return undefined;
}

function firstCharacter(node: Nodes | undefined): number | undefined {
  if (!node) return undefined;
  if (node.type === 'text' || node.type === 'inlineCode') return firstCodePoint(node.value);
  if ('children' in node) return firstCharacter(node.children[0] as Nodes | undefined);
  return undefined;
}

function joinIn(parent: Parent): void {
  const children = parent.children as Nodes[];
  children.forEach((child, i) => {
    if (child.type === 'text' && child.value.includes('\n')) {
      const value = child.value;
      child.value = value.replace(/\n/g, (_, offset: number) => {
        const before = offset > 0 ? lastCodePoint(value.slice(0, offset)) : lastCharacter(children[i - 1]);
        const after = offset < value.length - 1 ? firstCodePoint(value.slice(offset + 1)) : firstCharacter(children[i + 1]);
        return before !== undefined && after !== undefined && isWide(before) && isWide(after) ? '' : '\n';
      });
    }
    if ('children' in child) joinIn(child as Parent);
  });
}

/**
 * remark plugin: a single line break inside a paragraph joins its lines (CommonMark), and when both sides
 * are wide characters the break is dropped so no space appears between them.
 */
export default function remarkJoinWideLines() {
  return (tree: Root) => joinIn(tree);
}
