<script setup lang="ts">
import { useData } from "vitepress";

// Shows its content only when the docs are deployed to the given platform.
defineProps<{
  platform: "gitlab" | "github";
}>();

const { theme } = useData();
</script>

<template>
  <div v-if="theme.hostingPlatform === platform">
    <slot />
  </div>
</template>
