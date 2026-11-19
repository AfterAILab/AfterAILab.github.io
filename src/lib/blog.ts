import { getCollection, type CollectionEntry } from 'astro:content';

/** A blog post: one Markdown file, src/content/blog/YYYY-MM-DD-slug.md. */
export interface BlogPost {
  id: string;
  title: string;
  /** "YYYY-MM-DD" */
  date: string;
  description: string;
  /**
   * Whether the body opens with a `# heading`. The post page then lets that heading be the page's <h1>
   * (no separate title is printed); otherwise it prints `title` itself.
   */
  opensWithHeading: boolean;
  /** e.g. "/blog/2026-11-18-paging/" */
  url: string;
  entry: CollectionEntry<'blog'>;
}

const FILE_DATE = /^(\d{4}-\d{2}-\d{2})-./;

/** The `# heading` the body opens with, if any. */
function openingHeading(body: string): string | undefined {
  const m = body.trimStart().match(/^#[ \t]+([^\n]+)/);
  return m?.[1].replace(/[ \t]+#+[ \t]*$/, '').trim() || undefined;
}

/** The opening of the first paragraph, as plain text. */
function excerpt(body: string, max = 110): string {
  const block = body
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .find((b) => b && !/^(#|!\[|```|<|\||-{3,}|>)/.test(b));
  if (!block) return '';
  const text = block
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

let postsCache: Promise<BlogPost[]> | undefined;

/** All published posts, newest first. A post without a date or a title fails the build. */
export function getBlogPosts(): Promise<BlogPost[]> {
  postsCache ??= (async () => {
    const entries = await getCollection('blog');
    return entries
      .map((entry) => {
        const file = entry.filePath ?? entry.id;
        const body = entry.body ?? '';
        const date = entry.data.date ?? entry.id.match(FILE_DATE)?.[1];
        if (!date) throw new Error(`Blog post ${file}: name the file YYYY-MM-DD-slug.md or set "date" in front matter`);
        const heading = openingHeading(body);
        const title = entry.data.title ?? heading;
        if (!title) throw new Error(`Blog post ${file}: start the body with "# タイトル" or set "title" in front matter`);
        return {
          id: entry.id,
          title,
          date,
          description: entry.data.description ?? excerpt(body),
          opensWithHeading: heading !== undefined,
          url: `/blog/${entry.id}/`,
          entry,
        };
      })
      .sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  })();
  return postsCache;
}
