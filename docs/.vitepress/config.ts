import { defineConfig, loadEnv } from "vitepress";
import { resolveAccessControlFromEnv } from "./theme/access-control";

const rawBase = process.env.PAGES_BASE ?? "/";
const normalizedBase = rawBase.trim().replace(/^\/+|\/+$/g, "");
const base = normalizedBase ? `/${normalizedBase}/` : "/";
// Also reads docs/.env (git-ignored) so the passwords can be set locally.
const env = {
  ...loadEnv(process.env.NODE_ENV ?? "development", process.cwd(), "VITE_"),
  ...process.env,
};
const accessControl = resolveAccessControlFromEnv(env);
// "gitlab" or "github": lets pages show platform-specific content.
const hostingPlatform = env.VITE_HOSTING_PLATFORM === "github" ? "github" : "gitlab";
// Locked days are left out of the navbar and sidebar.
const labsLink = accessControl.day1LabsEnabled
  ? "/labs/lab-1-vibe-coding"
  : accessControl.day2LabsEnabled
    ? "/labs/lab-7-sandboxing"
    : null;
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
    hostingPlatform,
    nav: [
      { text: "Getting Started", link: "/getting-started/setup" },
      ...(labsLink ? [{ text: "Labs", link: labsLink }] : []),
      { text: "Resources", link: "/slides/" },
    ],
    sidebar: [
      {
        text: "Getting Started",
        items: [
          { text: "Setup", link: "/getting-started/setup" },
        ],
      },
      ...(accessControl.day1LabsEnabled ? [{
        text: "Day 1 · Labs",
        items: [
          { text: "Lab 1 · Vibe Coding", link: "/labs/lab-1-vibe-coding" },
          { text: "Lab 2 · Steering Agents", link: "/labs/lab-2-steering-agents" },
          { text: "Lab 3 · Create Reusable Prompts", link: "/labs/lab-3-create-reusable-prompts" },
          { text: "Lab 4 · Structured Agentic Workflows", link: "/labs/lab-4-structured-agentic-workflows" },
          { text: "Lab 5 · Spec-Driven Development", link: "/labs/lab-5-spec-driven-development" },
          { text: "Lab 6 · Automated Feedback Loops", link: "/labs/lab-6-automated-feedback-loops" },
        ],
      }] : []),
      ...(accessControl.day2LabsEnabled ? [{
        text: 'Day 2 · Labs <span class="sidebar-tag-new">New</span>',
        items: [
          { text: "Lab 7 · Sandboxing", link: "/labs/lab-7-sandboxing" },
          { text: "Lab 8 · Tracer Bullets", link: "/labs/lab-8-tracer-bullets" },
          { text: "Lab 9 · Durable Workflows", link: "/labs/lab-9-durable-workflows" },
          { text: "Lab 10 · Ralph Loop", link: "/labs/lab-10-ralph-loop" },
          { text: "Lab 11 · Parallelizing Work", link: "/labs/lab-11-parallelizing-work" },
          { text: "Lab 12 · Orchestration", link: "/labs/lab-12-orchestration" },
          { text: "Lab 13 · Evals", link: "/labs/lab-13-evals" },
        ],
      }] : []),
      {
        text: "Resources",
        items: [
          { text: "Slides", link: "/slides/" },
          { text: "Cheatsheet", link: "/cheatsheet/" },
          { text: "Glossary", link: "/glossary/" },
        ],
      },
    ],
    search: { provider: "local" },
    outline: { level: [2, 3] },
  },
});
