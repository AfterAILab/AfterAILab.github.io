/**
 * AfterAI Weekly (the podcast): the audio companion of the handwritten AfterAI Weekly newsletter.
 * Episodes come from the issues that have audio (see src/lib/weekly.ts); the feed is
 * src/pages/weekly/podcast.xml.ts. Changing `guid` of a published episode makes podcast apps
 * show it again as a new episode, so keep episodeGuid stable.
 */
export const PODCAST = {
  title: 'AfterAI Weekly',
  description:
    '手書きのニュースレター「AfterAI Weekly」の各号について、書いた本人がひとりで話す音声版です。AI 以後の世界でどのように生きるべきかを、悩みながら考えています。',
  author: 'AfterAI',
  ownerName: 'AfterAI株式会社',
  /** Public: podcast directories (Spotify) send ownership verification codes here. */
  ownerEmail: 'info@afterai.dev',
  /** Square, 1400–3000px, JPG or PNG (Apple Podcasts requirement). */
  coverPath: '/img/podcast/cover.jpg',
  feedPath: '/weekly/podcast.xml',
  /** Apple Podcasts categories: https://podcasters.apple.com/support/1691-apple-podcasts-categories */
  category: 'Society & Culture',
  subcategory: 'Personal Journals',
  language: 'ja',
} as const;

export function episodeGuid(slug: string): string {
  return `afterai.dev/weekly/${slug}/audio`;
}
