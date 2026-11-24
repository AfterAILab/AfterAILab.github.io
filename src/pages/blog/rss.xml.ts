import type { APIRoute } from 'astro';
import { getBlogPosts } from '../../lib/blog';
import { esc } from '../../lib/rss';

const BLOG_FEED_PATH = '/blog/rss.xml';

/** RSS 2.0 feed of the blog: each post's title, link, date and summary, newest first. */
export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('`site` must be set in astro.config.mjs for absolute feed URLs');
  const abs = (p: string) => new URL(p, site).href;
  const posts = await getBlogPosts();

  const items = posts.map(
    (post) => `
    <item>
      <title>${esc(post.title)}</title>
      <link>${abs(post.url)}</link>
      <guid isPermaLink="true">${abs(post.url)}</guid>
      <pubDate>${new Date(post.createdAt).toUTCString()}</pubDate>
      <description>${esc(post.description)}</description>
    </item>`,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AfterAI Blog</title>
    <link>${abs('/blog/')}</link>
    <atom:link href="${abs(BLOG_FEED_PATH)}" rel="self" type="application/rss+xml" />
    <language>ja</language>
    <description>AfterAI の記事</description>
    <copyright>© AfterAI</copyright>${
      posts[0] ? `\n    <lastBuildDate>${new Date(latestUpdate(posts)).toUTCString()}</lastBuildDate>` : ''
    }${items.join('')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};

/** The latest updated_at among the posts (compared as moments, since offsets may differ). */
function latestUpdate(posts: { updatedAt: string }[]): string {
  return posts.reduce((a, b) => (Date.parse(b.updatedAt) > Date.parse(a.updatedAt) ? b : a)).updatedAt;
}
