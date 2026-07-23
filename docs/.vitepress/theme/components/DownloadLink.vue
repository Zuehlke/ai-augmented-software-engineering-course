<script setup lang="ts">
import { withBase } from "vitepress";
import { computed } from "vue";

const props = defineProps<{
  href: string;
  label: string;
}>();

const resolvedHref = computed(() => withBase(props.href));
const filename = computed(() => {
  const parts = props.href.split("/");
  return parts[parts.length - 1];
});
</script>

<template>
  <a :href="resolvedHref" :download="filename" class="download-link">
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

