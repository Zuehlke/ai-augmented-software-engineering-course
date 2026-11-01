<script setup lang="ts">
import { computed } from "vue";
import { useData } from "vitepress";

// Shows its content only for the given audiences (space-separated): "internal" (Codehub)
// or "github" (GitHub Pages).
const props = defineProps<{
  audience: string;
}>();

const { theme } = useData();
const visible = computed(() =>
  props.audience.split(/\s+/).includes(theme.value.audience),
);
</script>

<template>
  <div v-if="visible">
    <slot />
  </div>
</template>
