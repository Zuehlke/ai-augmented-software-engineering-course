<script setup lang="ts">
import DefaultTheme from "vitepress/theme";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { useData, useRoute, useRouter, withBase } from "vitepress";

type OverlayTarget = "day1" | "day2";

const router = useRouter();
const route = useRoute();

const showOverlay = ref(false);
const activeTarget = ref<OverlayTarget | null>(null);
const activeHostName = ref<string | null>(null);
const siteBase = import.meta.env.BASE_URL ?? "/";
const hostNames = ["Lukas", "Marco", "Jonathan"] as const;
const { theme } = useData();

const day1LabsEnabled = computed(() => theme.value.accessControl?.day1LabsEnabled ?? true);
const day2LabsEnabled = computed(() => theme.value.accessControl?.day2LabsEnabled ?? true);

// A day stays locked until the password was entered once in this browser.
const unlockedDays = ref<Set<string>>(new Set());
const pendingPath = ref<string | null>(null);
type Download = { day: "day1" | "day2"; href: string; filename: string };
const pendingDownload = ref<Download | null>(null);
const password = ref("");
const passwordError = ref(false);
const unlockStorageKey = "course-unlocked-days";

function dayPassword(day: "day1" | "day2"): string | null {
  const control = theme.value.accessControl;
  return (day === "day1" ? control?.day1Password : control?.day2Password) ?? null;
}

function loadUnlockedDays(): void {
  try {
    const stored = JSON.parse(localStorage.getItem(unlockStorageKey) ?? "[]");
    unlockedDays.value = new Set(Array.isArray(stored) ? stored : []);
  } catch {
    unlockedDays.value = new Set();
  }
}

function saveUnlockedDays(): void {
  try {
    localStorage.setItem(unlockStorageKey, JSON.stringify([...unlockedDays.value]));
  } catch {
    // Storage unavailable (private mode): the day stays unlocked until reload.
  }
}

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

// Labs 7 and up belong to day 2, everything else under /labs to day 1.
function getLabDay(path: string): "day1" | "day2" | null {
  const normalizedPath = normalizePath(path);
  if (normalizedPath !== "/labs" && !normalizedPath.startsWith("/labs/")) return null;
  const labNumber = Number(normalizedPath.match(/^\/labs\/lab-(\d+)/)?.[1]);
  return labNumber >= 7 ? "day2" : "day1";
}

function getOverlayTarget(path: string): OverlayTarget | null {
  const labDay = getLabDay(path);
  if (labDay === "day1" && (!day1LabsEnabled.value || (dayPassword("day1") && !unlockedDays.value.has("day1")))) {
    return "day1";
  }
  if (labDay === "day2" && (!day2LabsEnabled.value || (dayPassword("day2") && !unlockedDays.value.has("day2")))) {
    return "day2";
  }
  return null;
}

function openOverlay(target: OverlayTarget, path: string | null, download: Download | null = null): void {
  activeTarget.value = target;
  pendingPath.value = path;
  pendingDownload.value = download;
  password.value = "";
  passwordError.value = false;
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
    openOverlay(target, to);
    return false;
  }
  return true;
};

// The overlay asks for a password when the day is enabled but not unlocked yet.
const needsPassword = computed(
  () =>
    (activeTarget.value === "day1" && day1LabsEnabled.value) ||
    (activeTarget.value === "day2" && day2LabsEnabled.value),
);

function startDownload({ href, filename }: Download): void {
  const link = document.createElement("a");
  link.href = href;
  link.download = filename;
  link.click();
}

function onDownloadRequest(event: Event): void {
  const download = (event as CustomEvent<Download>).detail;
  const unlocked = !dayPassword(download.day) || unlockedDays.value.has(download.day);
  if (unlocked) startDownload(download);
  else openOverlay(download.day, null, download);
}

function submitPassword(): void {
  const day = activeTarget.value;
  if (day !== "day1" && day !== "day2") return;
  if (password.value !== dayPassword(day)) {
    passwordError.value = true;
    return;
  }
  unlockedDays.value = new Set(unlockedDays.value).add(day);
  saveUnlockedDays();
  const target = pendingPath.value;
  const download = pendingDownload.value;
  closeOverlay();
  if (download) startDownload(download);
  else if (target) void router.go(target);
}

onMounted(() => {
  loadUnlockedDays();
  window.addEventListener("course:download", onDownloadRequest);
  const target = getOverlayTarget(route.path);
  if (target) {
    openOverlay(target, route.path);
    void router.go(withBase("/"));
  }
});

onUnmounted(() => window.removeEventListener("course:download", onDownloadRequest));

const overlayTitle = computed(() => {
  if (needsPassword.value) return "We will go through the labs in the course";
  if (activeTarget.value === "day1") return "Day 1 labs are not available yet";
  if (activeTarget.value === "day2") return "Day 2 labs are not available yet";
  return "Labs are not available yet";
});

const overlayDescription = computed(() => {
  if (needsPassword.value) return "Enter the password you got from the course host.";
  if (activeTarget.value === "day1") return "The day 1 labs will be enabled during the course.";
  if (activeTarget.value === "day2") return "The day 2 labs will be enabled during the course.";
  return "The labs will be enabled during the course.";
});

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
        <form v-if="needsPassword" class="slides-overlay__form" @submit.prevent="submitPassword">
          <input
            v-model="password"
            class="slides-overlay__input"
            type="password"
            autocomplete="off"
            placeholder="Password"
            aria-label="Password"
            :aria-invalid="passwordError"
            @input="passwordError = false"
          />
          <p v-if="passwordError" class="slides-overlay__error" role="alert">Wrong password.</p>
          <button type="submit" class="slides-overlay__button">Unlock</button>
        </form>
        <button v-else type="button" class="slides-overlay__button" @click="closeOverlay">
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
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.slides-overlay__card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.875rem;
  line-height: 1.55;
}

.slides-overlay__button {
  border: 1px solid transparent;
  border-radius: 10px;
  width: fit-content;
  margin-top: 6px;
  padding: 10px 18px;
  font-size: 0.875rem;
  font-weight: 600;
  line-height: 1.25;
  color: #fff;
  background: var(--vp-c-brand-1);
  cursor: pointer;
  transition: background-color 0.2s ease;
}

.slides-overlay__form {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.slides-overlay__input {
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  padding: 10px 14px;
  font-size: 0.875rem;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
}

.slides-overlay__input[aria-invalid="true"] {
  border-color: var(--vp-c-danger-1);
}

.slides-overlay__card .slides-overlay__error {
  color: var(--vp-c-danger-1);
  font-size: 0.875rem;
}

.slides-overlay__button:hover {
  background: var(--vp-c-brand-2);
}
</style>
