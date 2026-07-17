import { defineConfig } from "vitepress";

const base = process.env.PAGES_BASE ?? "/";

export default defineConfig({
  title: "AI-Augmented Software Engineering",
  description: "An introduction to AI-augmented software engineering that helps teams build software with AI in a more disciplined and systematic way - learning the key concepts and methods of modern AI coding tools and applying them directly in hands-on labs.",
  base,
  head: [["link", { rel: "icon", type: "image/png", href: `${base}favicon.png` }]],
  srcDir: ".",
  outDir: "../public",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  themeConfig: {
    nav: [
      { text: "Getting Started", link: "/getting-started/setup" },
      { text: "Labs", link: "/labs/lab-1-vibe-coding" },
      { text: "Slides", link: "/slides/" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [{ text: "Setup", link: "/getting-started/setup" }],
      },
      {
        text: "Labs",
        items: [
          { text: "Lab 1 · Vibe Coding", link: "/labs/lab-1-vibe-coding" },
          { text: "Lab 2 · Instructions & Skills", link: "/labs/lab-2-instructions-and-skills" },
          { text: "Lab 3 · Create Your Own Research Agent", link: "/labs/lab-3-research-agent" },
          { text: "Lab 4 · Structured Workflow", link: "/labs/lab-4-structured-workflow" },
          { text: "Lab 5 · Common SDD Framework", link: "/labs/lab-5-sdd-framework" },
          { text: "Lab 6 · Agent Hook", link: "/labs/lab-6-agent-hook" },
        ],
      },
      {
        text: "Slides",
        items: [{ text: "Slides", link: "/slides/" }],
      },
    ],
    search: { provider: "local" },
    outline: { level: [2, 3] },
  },
});
