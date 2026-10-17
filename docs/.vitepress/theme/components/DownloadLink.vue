<script setup lang="ts">
import { withBase } from "vitepress";
import { computed } from "vue";

const props = defineProps<{
  href: string;
  label: string;
  // Protects the download with the password of this day.
  day?: "day1" | "day2";
}>();

const resolvedHref = computed(() => withBase(props.href));
const filename = computed(() => {
  const parts = props.href.split("/");
  return parts[parts.length - 1];
});

// The access overlay decides whether to download right away or to ask for the password first.
function requestDownload(event: MouseEvent): void {
  if (!props.day) return;
  event.preventDefault();
  window.dispatchEvent(
    new CustomEvent("course:download", {
      detail: { day: props.day, href: resolvedHref.value, filename: filename.value },
    }),
  );
}
</script>

<template>
  <a :href="resolvedHref" :download="filename" class="download-link" @click="requestDownload">
    <svg class="icon" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
      <path
        fill="currentColor"
        d="M7.25 1.75a.75.75 0 0 1 1.5 0v6.69l2.22-2.22a.75.75 0 1 1 1.06 1.06l-3.5 3.5a.75.75 0 0 1-1.06 0l-3.5-3.5a.75.75 0 0 1 1.06-1.06l2.22 2.22V1.75ZM2.5 11.25a.75.75 0 0 1 1.5 0v1.5c0 .14.11.25.25.25h7.5a.25.25 0 0 0 .25-.25v-1.5a.75.75 0 0 1 1.5 0v1.5A1.75 1.75 0 0 1 11.75 14.5h-7.5A1.75 1.75 0 0 1 2.5 12.75v-1.5Z"
      />
    </svg>
    <span>{{ label }}</span>
  </a>
</template>

<style scoped>
/* Same shape as the "Open in GitHub Codespaces" badge, in the brand button colours. */
.download-link {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  margin-top: 12px;
  background: var(--vp-button-brand-bg);
  border: 1px solid transparent;
  border-radius: 6px;
  color: #fff;
  text-decoration: none;
  font-size: 14px;
  font-weight: 500;
  line-height: 20px;
  transition: background 0.2s ease;
}

.download-link:hover,
.download-link:focus-visible {
  background: var(--vp-button-brand-active-bg);
  color: #fff;
}

.icon {
  flex-shrink: 0;
}
</style>
