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
  themeConfig: {
    nav: [
      { text: "App", link: "https://eunomia.finance/#overview" },
      { text: "GitHub", link: "https://github.com/Bekirerdem/prism" },
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
          { text: "Changelog ↗", link: "https://github.com/Bekirerdem/prism/blob/main/CHANGELOG.md" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/Bekirerdem/prism" }],
  },
});
