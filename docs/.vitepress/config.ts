import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'marknative',
  description: 'Native Markdown rendering engine — produces paginated PNG/SVG documents without a browser',
  base: '/marknative/',
  srcExclude: ['**/superpowers/**'],

  head: [['link', { rel: 'icon', href: '/marknative/favicon.svg' }]],

  themeConfig: {
    logo: { svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M7 8h10M7 12h6M7 16h8"/></svg>' },

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'API', link: '/api/reference' },
      {
        text: 'Changelog',
        link: 'https://github.com/liyown/marknative/releases',
      },
    ],

    sidebar: [
      {
        text: 'Guide',
        items: [
          { text: 'Getting Started', link: '/guide/getting-started' },
          { text: 'Render Options', link: '/guide/options' },
          { text: 'Single-Page Mode', link: '/guide/single-page' },
          { text: 'Image Rendering', link: '/guide/images' },
        ],
      },
      {
        text: 'API Reference',
        items: [{ text: 'API Reference', link: '/api/reference' }],
      },
    ],

    socialLinks: [{ icon: 'github', link: 'https://github.com/liyown/marknative' }],

    footer: {
      message: 'Released under the MIT License.',
      copyright: 'Copyright © 2024–present marknative contributors',
    },

    search: { provider: 'local' },

    editLink: {
      pattern: 'https://github.com/liyown/marknative/edit/main/docs/:path',
      text: 'Edit this page on GitHub',
    },
  },
})
