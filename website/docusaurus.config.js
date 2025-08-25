/** @type {import('@docusaurus/types').DocusaurusConfig} */
module.exports = {
  title: "Create Agent Instructions",
  tagline: "CLI to generate agent instruction packs",
  url: "https://example.com",
  baseUrl: "/",
  onBrokenLinks: "warn",
  onBrokenMarkdownLinks: "warn",
  favicon: "img/favicon.ico",
  organizationName: "",
  projectName: "",
  presets: [
    [
      "@docusaurus/preset-classic",
      {
        docs: {
          sidebarPath: require.resolve("./sidebars.js"),
          editUrl: undefined,
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      },
    ],
  ],
};
