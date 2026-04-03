import { defineConfig } from 'vitepress'
import { tabsMarkdownPlugin } from 'vitepress-plugin-tabs'

export default defineConfig({
  title: 'marknative',
  description: 'Native Markdown rendering engine — produces paginated PNG/SVG documents without a browser',
  base: '/marknative/',
  srcExclude: ['**/superpowers/**'],

  markdown: {
    config(md) {
      md.use(tabsMarkdownPlugin)
    },
  },

  head: [['link', { rel: 'icon', href: '/marknative/logo.png' }]],

  themeConfig: {
    logo: '/logo.png',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Showcase', link: '/showcase/syntax' },
      { text: 'API', link: '/api/reference' },
      {
        text: 'Changelog',
        link: 'https://github.com/liyown/marknative/releases',
      },
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Guide',
          items: [
            { text: 'Getting Started', link: '/guide/getting-started' },
            { text: 'Render Options', link: '/guide/options' },
            { text: 'Single-Page Mode', link: '/guide/single-page' },
            { text: 'Image Rendering', link: '/guide/images' },
          ],
        },
      ],
      '/api/': [
        {
          text: 'API Reference',
          items: [{ text: 'API Reference', link: '/api/reference' }],
        },
      ],
      '/showcase/': [
        {
          text: 'Markdown Syntax',
          items: [
            { text: 'Headings', link: '/showcase/syntax#headings' },
            { text: 'Inline Styles', link: '/showcase/syntax#inline-styles' },
            { text: 'Unordered List', link: '/showcase/syntax#unordered-list' },
            { text: 'Ordered List', link: '/showcase/syntax#ordered-list' },
            { text: 'Task List', link: '/showcase/syntax#task-list' },
            { text: 'Blockquote', link: '/showcase/syntax#blockquote' },
            { text: 'Code Block', link: '/showcase/syntax#code-block' },
            { text: 'Table', link: '/showcase/syntax#table' },
            { text: 'Image', link: '/showcase/syntax#image' },
            { text: 'Thematic Break', link: '/showcase/syntax#thematic-break' },
          ],
        },
        {
          text: 'Features',
          items: [
            { text: 'Paginated Rendering', link: '/showcase/features#paginated-rendering' },
            { text: 'Single-Page Mode', link: '/showcase/features#single-page-mode' },
            { text: 'Custom Page Width', link: '/showcase/features#custom-page-width' },
            { text: 'Custom Page Height', link: '/showcase/features#custom-page-height' },
          ],
        },
      ],
    },

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
