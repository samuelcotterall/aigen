import React from 'react';
import ComponentCreator from '@docusaurus/ComponentCreator';

export default [
  {
    path: '/__docusaurus/debug',
    component: ComponentCreator('/__docusaurus/debug', '5ff'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/config',
    component: ComponentCreator('/__docusaurus/debug/config', '5ba'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/content',
    component: ComponentCreator('/__docusaurus/debug/content', 'a2b'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/globalData',
    component: ComponentCreator('/__docusaurus/debug/globalData', 'c3c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/metadata',
    component: ComponentCreator('/__docusaurus/debug/metadata', '156'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/registry',
    component: ComponentCreator('/__docusaurus/debug/registry', '88c'),
    exact: true
  },
  {
    path: '/__docusaurus/debug/routes',
    component: ComponentCreator('/__docusaurus/debug/routes', '000'),
    exact: true
  },
  {
    path: '/docs',
    component: ComponentCreator('/docs', '82d'),
    routes: [
      {
        path: '/docs',
        component: ComponentCreator('/docs', '8ff'),
        routes: [
          {
            path: '/docs',
            component: ComponentCreator('/docs', '57c'),
            routes: [
              {
                path: '/docs/api/',
                component: ComponentCreator('/docs/api/', '5e5'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/docs/api/index/',
                component: ComponentCreator('/docs/api/index/', '7b4'),
                exact: true
              },
              {
                path: '/docs/api/index/functions/run',
                component: ComponentCreator('/docs/api/index/functions/run', '35d'),
                exact: true
              },
              {
                path: '/docs/api/modules',
                component: ComponentCreator('/docs/api/modules', '04f'),
                exact: true
              },
              {
                path: '/docs/api/prefs/',
                component: ComponentCreator('/docs/api/prefs/', 'a96'),
                exact: true
              },
              {
                path: '/docs/api/prefs/functions/loadDefaults',
                component: ComponentCreator('/docs/api/prefs/functions/loadDefaults', '533'),
                exact: true
              },
              {
                path: '/docs/api/prefs/functions/saveDefaults',
                component: ComponentCreator('/docs/api/prefs/functions/saveDefaults', '6f4'),
                exact: true
              },
              {
                path: '/docs/api/schema/',
                component: ComponentCreator('/docs/api/schema/', '327'),
                exact: true
              },
              {
                path: '/docs/api/schema/type-aliases/AgentConfig',
                component: ComponentCreator('/docs/api/schema/type-aliases/AgentConfig', '44f'),
                exact: true
              },
              {
                path: '/docs/api/schema/variables/AgentConfigSchema',
                component: ComponentCreator('/docs/api/schema/variables/AgentConfigSchema', 'cce'),
                exact: true
              },
              {
                path: '/docs/api/schema/variables/ToolSchema',
                component: ComponentCreator('/docs/api/schema/variables/ToolSchema', 'a8d'),
                exact: true
              },
              {
                path: '/docs/api/templates/',
                component: ComponentCreator('/docs/api/templates/', '16c'),
                exact: true
              },
              {
                path: '/docs/api/templates/functions/renderTemplates',
                component: ComponentCreator('/docs/api/templates/functions/renderTemplates', '351'),
                exact: true
              },
              {
                path: '/docs/api/tool-list/',
                component: ComponentCreator('/docs/api/tool-list/', 'a02'),
                exact: true
              },
              {
                path: '/docs/api/tool-list/functions/loadToolList',
                component: ComponentCreator('/docs/api/tool-list/functions/loadToolList', '120'),
                exact: true
              },
              {
                path: '/docs/api/tool-list/type-aliases/ToolItem',
                component: ComponentCreator('/docs/api/tool-list/type-aliases/ToolItem', '146'),
                exact: true
              },
              {
                path: '/docs/api/write/',
                component: ComponentCreator('/docs/api/write/', 'd08'),
                exact: true
              },
              {
                path: '/docs/api/write/functions/deepMerge',
                component: ComponentCreator('/docs/api/write/functions/deepMerge', '031'),
                exact: true
              },
              {
                path: '/docs/api/write/functions/isObject',
                component: ComponentCreator('/docs/api/write/functions/isObject', 'bfc'),
                exact: true
              },
              {
                path: '/docs/api/write/functions/mergeMarkdownSections',
                component: ComponentCreator('/docs/api/write/functions/mergeMarkdownSections', '346'),
                exact: true
              },
              {
                path: '/docs/api/write/functions/writeOutputs',
                component: ComponentCreator('/docs/api/write/functions/writeOutputs', 'f48'),
                exact: true
              },
              {
                path: '/docs/getting-started',
                component: ComponentCreator('/docs/getting-started', '2a1'),
                exact: true,
                sidebar: "tutorialSidebar"
              },
              {
                path: '/docs/intro',
                component: ComponentCreator('/docs/intro', '61d'),
                exact: true,
                sidebar: "tutorialSidebar"
              }
            ]
          }
        ]
      }
    ]
  },
  {
    path: '*',
    component: ComponentCreator('*'),
  },
];
