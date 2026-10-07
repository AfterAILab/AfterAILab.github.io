// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://afterai.dev',
  integrations: [sitemap()],
  build: { format: 'directory' },
  redirects: {
    // Old VPP demo page is folded into /vpp/.
    '/vpp/demo/': '/vpp/#poc',
    // The site is Japanese only now; the former /ja/ mirror collapses onto the root.
    '/ja/': '/',
    '/ja/about/': '/about/',
    '/ja/works/': '/works/',
    '/ja/weekly/': '/weekly/',
    '/ja/weekly/[slug]': '/weekly/[slug]',
    '/ja/yugioh-life-counter/': '/works/yugioh-life-counter/',
    '/yugioh-life-counter/': '/works/yugioh-life-counter/',
    // Old maker-project pages (served at their file paths under Jekyll).
    '/ja/works/flaps/': '/works/flaps/',
    '/ja/works/events/': '/works/events/',
    '/works/flaps.html': '/works/flaps/',
    '/works/events.html': '/works/events/',
    '/ja/works/flaps.html': '/works/flaps/',
    '/ja/works/events.html': '/works/events/',
    '/yugioh-life-counter.html': '/works/yugioh-life-counter/',
    '/ja/yugioh-life-counter.html': '/works/yugioh-life-counter/',
  },
});
