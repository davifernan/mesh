import { defineConfig } from 'vitepress'

export default defineConfig({
  title: 'mesh',
  description: 'Self-hosted Discord alternative built on Matrix. Native LiveKit voice/video, E2EE, spaces, channels — own your data.',
  lang: 'en-US',


  head: [
    ['link', { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }],
    ['link', { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' }],
    ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/apple-touch-icon.png' }],
    ['meta', { name: 'theme-color', content: '#5865f2' }],
    ['meta', { property: 'og:type', content: 'website' }],
    ['meta', { property: 'og:site_name', content: 'mesh docs' }],
    ['meta', { property: 'og:image', content: 'https://docs.hostmesh.diy/og.png' }],
  ],

  themeConfig: {
    logo: '/logo.svg',
    siteTitle: 'mesh',

    nav: [
      { text: 'Guide', link: '/guide/getting-started' },
      { text: 'Features', link: '/features/microapps' },
      { text: 'Contributing', link: '/contributing/' },
      { text: 'Changelog', link: '/changelog' },
      {
        text: 'v0.2.0',
        items: [
          { text: 'Releases', link: 'https://github.com/davifernan/mesh/releases' },
          { text: 'Changelog', link: '/changelog' },
        ]
      }
    ],

    sidebar: {
      '/guide/': [
        {
          text: 'Getting Started',
          items: [
            { text: 'What is mesh?', link: '/guide/what-is-mesh' },
            { text: 'Self-Hosting', link: '/guide/getting-started' },
            { text: 'Configuration', link: '/guide/configuration' },
            { text: 'Desktop App', link: '/guide/desktop' },
          ]
        },
        {
          text: 'Advanced',
          items: [
            { text: 'Architecture', link: '/guide/architecture' },
            { text: 'Troubleshooting', link: '/guide/troubleshooting' },
          ]
        }
      ],
      '/features/': [
        {
          text: 'Features',
          items: [
            { text: 'Activities (Microapps)', link: '/features/microapps' },
            { text: 'Roadmap', link: '/features/roadmap' },
          ]
        }
      ],
      '/contributing/': [
        {
          text: 'Contributing',
          items: [
            { text: 'Development Setup', link: '/contributing/' },
          ]
        }
      ]
    },

    socialLinks: [
      { icon: 'github', link: 'https://github.com/davifernan/mesh' }
    ],

    footer: {
      message: 'Released under the AGPL-3.0 License.',
      copyright: 'Built on Matrix · Powered by LiveKit'
    },

    editLink: {
      pattern: 'https://github.com/davifernan/mesh/edit/main/docs-site/:path',
      text: 'Edit this page on GitHub'
    },

    search: {
      provider: 'local'
    },

    outline: {
      level: [2, 3],
      label: 'On this page'
    }
  },

  markdown: {
    theme: {
      light: 'github-light',
      dark: 'one-dark-pro'
    }
  }
})
