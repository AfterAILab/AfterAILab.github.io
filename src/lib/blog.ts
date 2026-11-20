import { getCollection, type CollectionEntry } from 'astro:content';
import { checkBlogImages } from './blog-images';

/** A blog post: one Markdown file, src/content/blog/slug.md. */
export interface BlogPost {
  id: string;
  title: string;
  /** First published, with the writer's offset: "2026-11-20T14:03:12+09:00". */
  createdAt: string;
  /** Last changed, as createdAt. */
  updatedAt: string;
  /** The writer's day of createdAt: "2026-11-20". */
  publishedDay: string;
  /** The writer's day of updatedAt, when it is not publishedDay. */
  updatedDay?: string;
  description: string;
  /**
   * Whether the body opens with a `# heading`. The post page then lets that heading be the page's <h1>
   * (no separate title is printed); otherwise it prints `title` itself.
   */
  opensWithHeading: boolean;
  /** e.g. "/blog/paging/" */
  url: string;
  entry: CollectionEntry<'blog'>;
}

/** The writer's day of a moment ("2026-11-20T14:03:12+09:00" → "2026-11-20"): its date part, in its own offset. */
function dayOf(moment: string): string {
  return moment.slice(0, 10);
}

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

/**
 * All published posts, newest first. A post without created_at (checked by the collection's schema) or a title
 * fails the build, as does an image not ready to publish (see ./blog-images.ts).
 */
export function getBlogPosts(): Promise<BlogPost[]> {
  postsCache ??= (async () => {
    await checkBlogImages();
    const entries = await getCollection('blog');
    return entries
      .map((entry) => {
        const file = entry.filePath ?? entry.id;
        const body = entry.body ?? '';
        const { created_at: createdAt, updated_at: updatedAt = createdAt } = entry.data;
        const heading = openingHeading(body);
        const title = entry.data.title ?? heading;
        if (!title) throw new Error(`Blog post ${file}: start the body with "# タイトル" or set "title" in front matter`);
        return {
          id: entry.id,
          title,
          createdAt,
          updatedAt,
          publishedDay: dayOf(createdAt),
          updatedDay: dayOf(updatedAt) === dayOf(createdAt) ? undefined : dayOf(updatedAt),
          description: entry.data.description ?? excerpt(body),
          opensWithHeading: heading !== undefined,
          url: `/blog/${entry.id}/`,
          entry,
        };
      })
      // By the moment, not its text: two offsets may order differently as strings.
      .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || b.id.localeCompare(a.id));
  })();
  return postsCache;
}
