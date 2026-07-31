import { defineConfig } from "vitepress";

// The product name lives HERE and in index.md only — the mainnet rename is a
// two-line change, content pages stay name-agnostic.
const NAME = "PRISM";

export default defineConfig({
  title: `${NAME} Docs`,
  description: "Give your agent a budget — not your wallet. Bounded agent treasuries on Stellar.",
  base: "/docs/",
  outDir: "../public/docs",
  ignoreDeadLinks: true, // included repo-root markdown carries GitHub-relative links
  themeConfig: {
    nav: [
      { text: "App", link: "https://prism-stellar.vercel.app/#overview" },
      { text: "GitHub", link: "https://github.com/Bekirerdem/prism" },
    ],
    sidebar: [
      {
        text: "Concepts",
        items: [
          { text: `What is ${NAME}?`, link: "/" },
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
          { text: "Changelog", link: "/changelog" },
        ],
      },
    ],
    socialLinks: [{ icon: "github", link: "https://github.com/Bekirerdem/prism" }],
  },
});
