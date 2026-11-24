import type { APIRoute } from 'astro';
import { getTranscription, getWeeklyIssues } from '../../lib/weekly';
import { esc, rfc822Day } from '../../lib/rss';

const FEED_PATH = '/weekly/rss.xml';

/**
 * RSS 2.0 feed of every AfterAI Weekly issue, newest first. Each item carries the page image and, when the
 * issue has one, its transcription, so a feed reader shows the issue itself. Audio-only subscribers use
 * the podcast feed (/weekly/podcast.xml) instead.
 */
export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('`site` must be set in astro.config.mjs for absolute feed URLs');
  const abs = (p: string) => new URL(p, site).href;
  const issues = await getWeeklyIssues();

  const items = await Promise.all(
    issues.map(async (issue) => {
      const transcription = issue.hasTranscription ? (await getTranscription(issue.slug))?.rendered?.html : undefined;
      const body = [
        `<p><a href="${abs(issue.url)}"><img src="${abs(issue.webp[800])}" width="800" alt="${esc(issue.title)}" /></a></p>`,
        transcription,
      ]
        .filter(Boolean)
        .join('\n');
      return `
    <item>
      <title>${esc(issue.title)}</title>
      <link>${abs(issue.url)}</link>
      <guid isPermaLink="true">${abs(issue.url)}</guid>
      <pubDate>${rfc822Day(issue.date)}</pubDate>
      <description>${esc(body)}</description>
    </item>`;
    }),
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>AfterAI Weekly</title>
    <link>${abs('/weekly/')}</link>
    <atom:link href="${abs(FEED_PATH)}" rel="self" type="application/rss+xml" />
    <language>ja</language>
    <description>AI 以後の世界でどのように生きるべきかを、悩みながら 1 枚の紙に手書きしているニュースレターです。</description>
    <copyright>© AfterAI</copyright>${
      issues[0] ? `\n    <lastBuildDate>${rfc822Day(issues[0].date)}</lastBuildDate>` : ''
    }${items.join('')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};
