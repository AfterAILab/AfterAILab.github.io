import { existsSync } from 'node:fs';
import path from 'node:path';
import type { APIRoute } from 'astro';
import { getWeeklyIssues } from '../../lib/weekly';
import { PODCAST, episodeGuid } from '../../lib/podcast';

/** Podcast RSS for AfterAI Weekly (Apple Podcasts / Spotify compatible). */
export const GET: APIRoute = async ({ site }) => {
  if (!site) throw new Error('`site` must be set in astro.config.mjs for absolute feed URLs');
  if (!existsSync(path.join(process.cwd(), 'public', PODCAST.coverPath))) {
    throw new Error(`Podcast cover missing: public${PODCAST.coverPath}`);
  }
  const abs = (p: string) => new URL(p, site).href;

  const episodes = (await getWeeklyIssues())
    .filter((issue) => issue.audio)
    .map((issue) => ({ issue, audio: issue.audio! }))
    .sort((a, b) => b.audio.date.localeCompare(a.audio.date) || b.issue.number - a.issue.number);

  const items = episodes.map(
    ({ issue, audio }) => `
    <item>
      <title>${esc(audio.title)}</title>
      <link>${abs(issue.url)}</link>
      <guid isPermaLink="false">${episodeGuid(issue.slug)}</guid>
      <pubDate>${rfc822(audio.date)}</pubDate>
      <description>${esc(`${audio.description}\n\n${issue.title}: ${abs(issue.url)}`)}</description>
      <enclosure url="${abs(audio.url)}" length="${audio.bytes}" type="audio/x-m4a" />
      <itunes:duration>${audio.seconds}</itunes:duration>
      <itunes:episode>${issue.number}</itunes:episode>
      <itunes:episodeType>full</itunes:episodeType>
      <itunes:explicit>false</itunes:explicit>
    </item>`,
  );

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${esc(PODCAST.title)}</title>
    <link>${abs('/weekly/')}</link>
    <atom:link href="${abs(PODCAST.feedPath)}" rel="self" type="application/rss+xml" />
    <language>${PODCAST.language}</language>
    <description>${esc(PODCAST.description)}</description>
    <copyright>© AfterAI</copyright>
    <itunes:author>${esc(PODCAST.author)}</itunes:author>
    <itunes:owner>
      <itunes:name>${esc(PODCAST.ownerName)}</itunes:name>
      <itunes:email>${esc(PODCAST.ownerEmail)}</itunes:email>
    </itunes:owner>
    <itunes:image href="${abs(PODCAST.coverPath)}" />
    <image>
      <url>${abs(PODCAST.coverPath)}</url>
      <title>${esc(PODCAST.title)}</title>
      <link>${abs('/weekly/')}</link>
    </image>
    <itunes:category text="${esc(PODCAST.category)}">
      <itunes:category text="${esc(PODCAST.subcategory)}" />
    </itunes:category>
    <itunes:explicit>false</itunes:explicit>
    <itunes:type>episodic</itunes:type>${items.join('')}
  </channel>
</rss>
`;
  return new Response(xml, { headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' } });
};

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** "2026-11-18" → "Wed, 18 Nov 2026 03:00:00 GMT" (noon in Japan, so the date is the same in JST and UTC). */
function rfc822(date: string): string {
  return new Date(`${date}T12:00:00+09:00`).toUTCString();
}
