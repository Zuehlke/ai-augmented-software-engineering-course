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
    {{ label }}
  </a>
</template>

<style scoped>
.download-link {
  display: inline-block;
  padding: 8px 16px;
  margin-top: 12px;
  background: var(--vp-c-brand-soft);
  border: 1px solid var(--vp-c-brand-1);
  border-radius: 8px;
  color: var(--vp-c-brand-1);
  text-decoration: none;
  font-weight: 500;
  transition: all 0.2s ease;
}

.download-link:hover {
  background: var(--vp-c-brand-1);
  color: white;
  border-color: var(--vp-c-brand-2);
}
</style>

