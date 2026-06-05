import starlight from '@astrojs/starlight';
import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://konlanx.github.io',
  base: '/branchly',
  integrations: [
    starlight({
      title: 'branchly',
      description: 'Give every Git branch its own database. Switch branches, and your data follows.',
      logo: {
        src: './src/assets/logo.svg',
        alt: 'branchly',
      },
      favicon: '/favicon.svg',
      social: [{ icon: 'github', label: 'GitHub', href: 'https://github.com/konlanx/branchly' }],
      editLink: {
        baseUrl: 'https://github.com/konlanx/branchly/edit/main/packages/docs/',
      },
      customCss: ['./src/styles/custom.css'],
      sidebar: [
        {
          label: 'Start here',
          items: [{ slug: 'start/why' }, { slug: 'start/installation' }, { slug: 'start/quickstart' }],
        },
        {
          label: 'Guides',
          items: [
            { slug: 'guides/how-it-works' },
            { slug: 'guides/configuration' },
            { slug: 'guides/cli' },
            { slug: 'guides/cache' },
            { slug: 'guides/cleanup' },
            { slug: 'guides/injected-envs' },
          ],
        },
        {
          label: 'Adapters',
          items: [
            { slug: 'adapters/overview' },
            {
              label: 'Datasources',
              items: [{ slug: 'adapters/postgres' }, { slug: 'adapters/mysql' }, { slug: 'adapters/sqlite' }],
            },
            {
              label: 'Migrators',
              items: [{ slug: 'adapters/prisma' }, { slug: 'adapters/drizzle' }, { slug: 'adapters/knex' }],
            },
            {
              label: 'Resolvers',
              items: [{ slug: 'adapters/env-file' }, { slug: 'adapters/direnv' }],
            },
          ],
        },
        {
          label: 'Authoring adapters',
          items: [
            { slug: 'authoring/overview' },
            { slug: 'authoring/datasource' },
            { slug: 'authoring/migrator' },
            { slug: 'authoring/resolver' },
            { slug: 'authoring/test-kit' },
            { slug: 'authoring/publishing' },
          ],
        },
      ],
    }),
  ],
});
