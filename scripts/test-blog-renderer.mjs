#!/usr/bin/env node
// Tests the blog renderer bundle that Kakiaji runs (scripts/build-blog-renderer.mjs):
//   1. expectations on its HTML, run in a bare V8 context (no console, no Node APIs), and
//   2. on macOS, that JavaScriptCore (what Kakiaji uses) renders every case byte for byte as V8 does,
//      since the site renders with Node and the preview must match it.
// Usage: pnpm test:renderer
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const work = mkdtempSync(join(tmpdir(), 'blog-renderer-'));
execFileSync(process.execPath, [join(root, 'scripts/build-blog-renderer.mjs'), work], { stdio: 'ignore' });
const bundle = readFileSync(join(work, 'blog-markdown.js'), 'utf8');

const context = vm.createContext({});
vm.runInContext(bundle, context);
const render = (markdown, imageBase = '') => context.BlogMarkdown.render(markdown, imageBase);
const plain = (markdown, imageBase) => render(markdown, imageBase).replace(/ data-sourcepos="[^"]*"/g, '');

const cases = [
  ['Japanese lines join without a space', '今日は晴れ。散歩した。\n明日は雨らしい。', (h) => h === '<p>今日は晴れ。散歩した。明日は雨らしい。</p>'],
  ['Latin lines keep their break', 'Hello\nworld', (h) => h === '<p>Hello\nworld</p>'],
  ['mixed lines keep their break', 'AI\nにより', (h) => h === '<p>AI\nにより</p>'],
  ['the join looks inside emphasis', '**大事**\nな話', (h) => h === '<p><strong>大事</strong>な話</p>'],
  ['the join looks inside a link', '[リンク](https://a.example)\nの先', (h) => h === '<p><a href="https://a.example">リンク</a>の先</p>'],
  ['a blank line starts a paragraph', '一。\n\n二。', (h) => h === '<p>一。</p>\n<p>二。</p>'],
  ['tables', '| a | b |\n|---|---|\n| 1 | 2 |', (h) => h.includes('<table>') && h.includes('<td>1</td>')],
  ['strikethrough', '~~消す~~', (h) => h.includes('<del>消す</del>')],
  ['task lists', '- [x] 済み', (h) => h.includes('<input type="checkbox" checked disabled>')],
  ['autolinks', 'https://example.com を見て', (h) => h.includes('<a href="https://example.com">')],
  ['smart punctuation', '"引用" -- と --- と ...', (h) => h === '<p>“引用” – と — と …</p>'],
  ['heading ids', '## はじめに', (h) => h === '<h2 id="はじめに">はじめに</h2>'],
  ['raw HTML is left out', '<script>alert(1)</script>\n\n<b>太字</b>', (h) => !h.includes('<script') && !h.includes('<b>')],
  ['unsafe link targets are emptied', '[x](javascript:alert(1)) [y](data:text/html,1)', (h) => h === '<p><a href="">x</a> <a href="">y</a></p>'],
  ['safe link targets stay', '[x](mailto:a@example.com) [y](./next/) [z](#top)', (h) => h.includes('href="mailto:a@example.com"') && h.includes('href="./next/"') && h.includes('href="#top"')],
  [
    'relative images resolve against the base',
    '![写真](<./写真 1.jpg>) ![b](img/b.png) ![c](https://example.com/c.png)',
    (h) =>
      h.includes('src="file:///docs/%E5%86%99%E7%9C%9F%201.jpg"') &&
      h.includes('src="file:///docs/img/b.png"') &&
      h.includes('src="https://example.com/c.png"') &&
      h.includes('loading="lazy"'),
    'file:///docs',
  ],
  ['reference-style images resolve too', '![a][p]\n\n[p]: ./p.png', (h) => h.includes('src="file:///docs/p.png"'), 'file:///docs/'],
  ['an unsafe image source is emptied', '![a](javascript:x)', (h) => h.includes('src=""'), 'file:///docs/'],
  ['without a base, images stay as written', '![a](./p.png)', (h) => h.includes('src="./p.png"')],
  ['code is coloured by Shiki', '```js\nconst a = 1;\n```', (h) => h.includes('class="shiki github-dark"') && h.includes('>const</span>') && h.includes('> =</span>')],
  ['code without a language still gets the code style', '```\nplain\n```', (h) => h.includes('class="shiki github-dark"')],
  ['an unknown language falls back to plain text', '```nosuchlang\nx\n```', (h) => h.includes('class="shiki github-dark"')],
  ['footnotes', '本文[^1]\n\n[^1]: 注。', (h) => h.includes('class="footnotes"') && h.includes('脚注')],
];

let failed = 0;
for (const [name, markdown, check, base] of cases) {
  const html = plain(markdown, base).trim();
  if (!check(html)) {
    failed++;
    console.error(`✗ ${name}\n  ${JSON.stringify(html)}`);
  }
}
const positions = render('# 見出し\n\n本文');
if (!positions.includes('<h1 id="見出し" data-sourcepos="1:1-1:6">') || !positions.includes('<p data-sourcepos="3:1-3:3">')) {
  failed++;
  console.error(`✗ source positions\n  ${JSON.stringify(positions)}`);
}
console.log(`${cases.length + 1 - failed}/${cases.length + 1} expectations hold`);

// JavaScriptCore must render every case, and the long sample, exactly as V8 does.
const jsc = '/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc';
if (existsSync(jsc)) {
  const sample = readFileSync(join(root, 'scripts/blog-renderer-sample.md'), 'utf8');
  const inputs = [...cases.map(([, markdown, , base]) => [markdown, base ?? '']), [sample, 'file:///docs/']];
  // Each input in a fresh context, as Kakiaji's first render of a document may be the context's first.
  let mismatched = 0;
  inputs.forEach(([markdown, base], i) => {
    const script = join(work, `case-${i}.js`);
    writeFileSync(script, `print(BlogMarkdown.render(${JSON.stringify(markdown)}, ${JSON.stringify(base)}));`);
    const fromJsc = execFileSync(jsc, [join(work, 'blog-markdown.js'), script], { encoding: 'utf8' }).replace(/\n$/, '');
    const fresh = vm.createContext({});
    vm.runInContext(bundle, fresh);
    const fromV8 = fresh.BlogMarkdown.render(markdown, base);
    if (fromJsc !== fromV8) {
      mismatched++;
      console.error(`✗ JavaScriptCore differs from V8 on input ${i}:\n  V8:  ${JSON.stringify(fromV8)}\n  JSC: ${JSON.stringify(fromJsc)}`);
    }
  });
  console.log(`${inputs.length - mismatched}/${inputs.length} inputs render identically in JavaScriptCore and V8`);
  failed += mismatched;
} else {
  console.log('JavaScriptCore not found (not macOS): skipped the V8 / JavaScriptCore comparison');
}

process.exit(failed ? 1 : 0);
