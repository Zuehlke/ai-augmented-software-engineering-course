<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import { computed, onMounted, ref } from "vue";
import { useData, useRoute, useRouter, withBase } from "vitepress";

const router = useRouter();
const route = useRoute();

const showOverlay = ref(false);
const activeTarget = ref<"labs" | "slides" | null>(null);
const activeHostName = ref<string | null>(null);
const siteBase = import.meta.env.BASE_URL ?? "/";
const hostNames = ["Lukas", "Marco", "Jonathan"] as const;
const { theme } = useData();

const labsEnabled = computed(() => theme.value.accessControl?.labsEnabled ?? true);
const slidesEnabled = computed(() => theme.value.accessControl?.slidesEnabled ?? true);

function normalizePath(path: string): string {
  const [pathWithoutQueryOrHash] = path.split(/[?#]/);
  const normalizedBase = siteBase.endsWith("/") ? siteBase.slice(0, -1) : siteBase;
  const pathWithoutBase =
    normalizedBase && normalizedBase !== "/" && pathWithoutQueryOrHash.startsWith(`${normalizedBase}/`)
      ? pathWithoutQueryOrHash.slice(normalizedBase.length)
      : pathWithoutQueryOrHash === normalizedBase
        ? "/"
        : pathWithoutQueryOrHash;
  const normalizedPath = pathWithoutBase.replace(/\.html$/, "");
  if (normalizedPath.length > 1 && normalizedPath.endsWith("/")) {
    return normalizedPath.slice(0, -1);
  }
  return normalizedPath || "/";
}

function isLabsPath(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return normalizedPath === "/labs" || normalizedPath.startsWith("/labs/");
}

function isSlidesPath(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return normalizedPath === "/slides" || normalizedPath.startsWith("/slides/");
}

function isCheatsheetPath(path: string): boolean {
  const normalizedPath = normalizePath(path);
  return normalizedPath === "/cheatsheet" || normalizedPath.startsWith("/cheatsheet/");
}

function getOverlayTarget(path: string): "labs" | "slides" | null {
  if (!labsEnabled.value && isLabsPath(path)) {
    return "labs";
  }
  if (!slidesEnabled.value && (isSlidesPath(path) || isCheatsheetPath(path))) {
    return "slides";
  }
  return null;
}

function openOverlay(target: "labs" | "slides"): void {
  activeTarget.value = target;
  activeHostName.value = pickHostName();
  showOverlay.value = true;
}

function closeOverlay(): void {
  showOverlay.value = false;
  activeTarget.value = null;
}

router.onBeforeRouteChange = (to: string) => {
  const target = getOverlayTarget(to);
  if (target) {
    openOverlay(target);
    return false;
  }
  return true;
};

onMounted(() => {
  const target = getOverlayTarget(route.path);
  if (target) {
    openOverlay(target);
    void router.go(withBase("/"));
  }
});

const overlayTitle = computed(() =>
  activeTarget.value === "labs" ? "Labs are not available yet" : "Resources are not available yet",
);

const overlayDescription = computed(() =>
  activeTarget.value === "labs"
    ? "The labs will be enabled during the course."
    : "The slides and cheatsheet will be provided during the course.",
);

function pickHostName(): string | null {
  if (hostNames.length === 0) return null;
  const pool = activeHostName.value ? hostNames.filter((name) => name !== activeHostName.value) : hostNames;
  const selectedPool = pool.length > 0 ? pool : hostNames;
  const randomIndex = Math.floor(Math.random() * selectedPool.length);
  return selectedPool[randomIndex] ?? null;
}

const overlayBadge = computed(() =>
  activeHostName.value ? `Message from ${activeHostName.value}` : "Message from course host",
);
</script>

<template>
  <DefaultTheme.Layout />
  <Teleport to="body">
    <div
      v-if="showOverlay"
      class="slides-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="course-overlay-title"
      aria-describedby="course-overlay-description"
      @click.self="closeOverlay"
    >
      <div class="slides-overlay__card">
        <button
          type="button"
          class="slides-overlay__close"
          aria-label="Close message"
          @click="closeOverlay"
        >
          ×
        </button>
        <span class="slides-overlay__badge">{{ overlayBadge }}</span>
        <h2 id="course-overlay-title">{{ overlayTitle }}</h2>
        <p id="course-overlay-description">{{ overlayDescription }}</p>
        <button type="button" class="slides-overlay__button" @click="closeOverlay">
          Got it
        </button>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.slides-overlay {
  position: fixed;
  inset: 0;
  z-index: 1200;
  display: grid;
  place-items: center;
  padding: 24px;
  backdrop-filter: blur(5px);
  background: rgba(15, 17, 21, 0.42);
}

.slides-overlay__card {
  position: relative;
  width: min(560px, 100%);
  border: 1px solid var(--vp-c-divider);
  border-radius: 16px;
  padding: 30px;
  background: var(--vp-c-bg);
  box-shadow: 0 14px 36px rgba(0, 0, 0, 0.2);
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.slides-overlay__badge {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  width: fit-content;
  padding: 5px 11px;
  margin: 0;
  font-size: 0.75rem;
  font-weight: 600;
  line-height: 1.25;
  letter-spacing: 0.01em;
  color: var(--vp-c-text-2);
  background: var(--vp-c-bg-soft);
}

.slides-overlay__badge::before {
  content: "";
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 2px color-mix(in srgb, #22c55e 20%, transparent);
}

.slides-overlay__close {
  position: absolute;
  top: 14px;
  right: 14px;
  width: 30px;
  height: 30px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 999px;
  font-size: 18px;
  line-height: 1;
  color: var(--vp-c-text-2);
  background: transparent;
  cursor: pointer;
}

.slides-overlay__close:hover {
  color: var(--vp-c-text-1);
  border-color: var(--vp-c-divider-dark);
  background: var(--vp-c-bg-soft);
}

.slides-overlay__card h2 {
  margin: 2px 0 0;
  font-size: 1.6rem;
  font-weight: 600;
  line-height: 1.3;
}

.slides-overlay__card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 1rem;
  line-height: 1.55;
}

.slides-overlay__button {
  border: 1px solid transparent;
  border-radius: 10px;
  width: fit-content;
  margin-top: 6px;
  padding: 10px 18px;
  font-size: 0.95rem;
  font-weight: 600;
  line-height: 1.25;
  color: #fff;
  background: var(--vp-c-brand-1);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.slides-overlay__button:hover {
  background: var(--vp-c-brand-2);
}
</style>
