import { defineConfig } from "vitepress";
import { resolveAccessControlFromEnv } from "./theme/access-control";

const rawBase = process.env.PAGES_BASE ?? "/";
const normalizedBase = rawBase.trim().replace(/^\/+|\/+$/g, "");
const base = normalizedBase ? `/${normalizedBase}/` : "/";
const accessControl = resolveAccessControlFromEnv(process.env);
const siteDescription =
  "An introduction to AI-augmented software engineering that helps teams build software with AI in a more disciplined and systematic way - learning the key concepts and methods of modern AI coding tools and applying them directly in hands-on labs.";
const faviconDataUrl =
  "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAAUElEQVRYhWNgGOmAEcaYET3nPx3tPZCxNMWRgYGBgYmOlmIFow4YdcCoA0YdMOqAUQeMOmDUAaMOGHXAqANGHTDgDmBBYh+go70X6GjXIAcAHYYGymg+31EAAAAASUVORK5CYII=";

export default defineConfig({
  title: "AI-Augmented Software Engineering",
  description: siteDescription,
  base,
  head: [
    ["link", { rel: "icon", type: "image/png", href: faviconDataUrl }],
    ["link", { rel: "shortcut icon", type: "image/png", href: faviconDataUrl }],
    ["link", { rel: "apple-touch-icon", href: `${base}favicon.png` }],
  ],
  srcDir: ".",
  outDir: "../public",
  cleanUrls: true,
  lastUpdated: true,
  ignoreDeadLinks: [/^https?:\/\/localhost/],
  themeConfig: {
    accessControl,
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
          { text: "Lab 2 · Steering Agents", link: "/labs/lab-2-steering-agents" },
          { text: "Lab 3 · Create Your Own Agents", link: "/labs/lab-3-create-your-own-agents" },
          { text: "Lab 4 · Structured Agentic Workflows", link: "/labs/lab-4-structured-agentic-workflows" },
          { text: "Lab 5 · Spec-Driven Development", link: "/labs/lab-5-spec-driven-development" },
          { text: "Lab 6 · Automated Feedback Loops", link: "/labs/lab-6-automated-feedback-loops" },
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
