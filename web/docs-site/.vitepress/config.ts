import { defineConfig } from "vitepress";

// The product name lives HERE and in index.md only — the mainnet rename is a
// two-line change, content pages stay name-agnostic.
const NAME = "Eunomia";

export default defineConfig({
  title: `${NAME} Docs`,
  description: "Give your agent a budget — not your wallet. Bounded agent treasuries on Stellar.",
  base: "/docs/",
  outDir: "../public/docs",
  ignoreDeadLinks: true, // included repo-root markdown carries GitHub-relative links
  // Every link in the sidebar and in the pages is extensionless ("/try-it"), but the default
  // build emits "try-it.html" — so the site's own navigation 404'd on a static host and only
  // the index was reachable. cleanUrls emits "try-it/index.html", which those links resolve to.
  cleanUrls: true,
  // `head` hrefs are emitted literally, so "/favicon.svg" reaches the app's own brand
  // files at the origin root. themeConfig.logo is different: VitePress prepends `base`
  // to it, so its "/favicon.svg" resolves to "/docs/favicon.svg" — that file must exist
  // in docs-site/public/ (it's a copy of web/public/favicon.svg; keep them in sync).
  head: [
    ["link", { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" }],
    ["link", { rel: "icon", type: "image/png", sizes: "32x32", href: "/favicon.png" }],
    ["link", { rel: "apple-touch-icon", href: "/apple-touch-icon.png" }],
    ["meta", { name: "theme-color", content: "#FCFFD5" }],
    ["meta", { property: "og:type", content: "website" }],
    ["meta", { property: "og:site_name", content: `${NAME} Docs` }],
    ["meta", { property: "og:image", content: "https://eunomia.finance/og.png" }],
    ["meta", { name: "twitter:card", content: "summary_large_image" }],
    ["meta", { name: "twitter:image", content: "https://eunomia.finance/og.png" }],
  ],
  themeConfig: {
    logo: { src: "/favicon.svg", alt: `${NAME}` },
    nav: [
      { text: "App", link: "https://eunomia.finance/#overview" },
      { text: "GitHub", link: "https://github.com/eunomia-finance/eunomia" },
    ],
    sidebar: [
      {
        text: "Concepts",
        items: [
          { text: `What is ${NAME}?`, link: "/" },
          { text: "Architecture", link: "/architecture" },
          { text: "Confidential compliance (ZK)", link: "/zk" },
        ],
      },
      {
        text: "Use it",
        items: [
          { text: "Try it (5 minutes)", link: "/try-it" },
          { text: "Hızlı başlangıç (TR)", link: "/try-it-tr" },
        ],
      },
      {
        text: "Reference",
        items: [
          { text: "Contracts & Addresses", link: "/contracts" },
          { text: "Security Model", link: "/security" },
          { text: "Roadmap", link: "/roadmap" },
          { text: "Changelog ↗", link: "https://github.com/eunomia-finance/eunomia/blob/main/CHANGELOG.md" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/eunomia-finance/eunomia" }],
  },
});
