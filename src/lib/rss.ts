/** Helpers shared by the site's RSS feeds (src/pages/blog/rss.xml.ts, src/pages/weekly/*.xml.ts). */

/** Escapes text for an XML element or attribute. */
export function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** "2026-11-18" → "Wed, 18 Nov 2026 03:00:00 GMT" (noon in Japan, so the date is the same in JST and UTC). */
export function rfc822Day(date: string): string {
  return new Date(`${date}T12:00:00+09:00`).toUTCString();
}
