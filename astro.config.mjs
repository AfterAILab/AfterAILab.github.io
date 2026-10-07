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
    // '/ja/weekly/[slug]': '/weekly/[slug]', // enabled once the weekly route exists
    '/ja/yugioh-life-counter/': '/works/yugioh-life-counter/',
    '/yugioh-life-counter/': '/works/yugioh-life-counter/',
  },
});
