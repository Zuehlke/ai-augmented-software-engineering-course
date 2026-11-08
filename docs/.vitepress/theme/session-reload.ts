import type { Router } from "vitepress";

// TEMPORARY FIX — remove once GitLab Pages access control is turned off
// (Settings → General → Visibility → Pages: Everyone) or no longer expires.
//
// GitLab Pages access control: once the Pages session expires, client-side
// navigation can't fetch page chunks (they redirect to the GitLab login), so
// VitePress falls back to its 404 page. A full reload re-authenticates instead.
const RELOADED_KEY = "course-reloaded-path";

export function reloadOnExpiredSession(router: Router) {
  if (typeof window === "undefined") return;

  router.onAfterRouteChange = (to) => {
    const data = router.route.data;
    if (!data.isNotFound) {
      store(() => sessionStorage.removeItem(RELOADED_KEY));
      return;
    }
    // Only for pages that exist in this build; real dead links keep the 404 page.
    if (!isKnownPage(to)) return;
    // At most one reload per path, so a persistent failure can't loop.
    if (store(() => sessionStorage.getItem(RELOADED_KEY)) === to) return;
    store(() => sessionStorage.setItem(RELOADED_KEY, to));
    window.location.assign(to);
  };
}

// Same lookup as VitePress' pathToFile: /<base>/labs/lab-1 -> labs_lab-1.md.
// The 404 page's relativePath can't be used: in the browser it keeps the base.
function isKnownPage(href: string): boolean {
  const hashMap = (window as any).__VP_HASH_MAP__ ?? {};
  const base = import.meta.env.BASE_URL;
  let path = decodeURIComponent(new URL(href, location.href).pathname);
  if (path.startsWith(base)) path = path.slice(base.length);
  path = path.replace(/\.html$/, "").replace(/(^|\/)$/, "$1index");
  const key = (path.replace(/\//g, "_") + ".md").toLowerCase();
  const alt = key.endsWith("_index.md") ? key.slice(0, -9) + ".md" : key.slice(0, -3) + "_index.md";
  return Boolean(hashMap[key] || hashMap[alt]);
}

function store<T>(fn: () => T): T | undefined {
  try {
    return fn();
  } catch {
    return undefined;
  }
}
