<script setup lang="ts">
import { computed, ref } from "vue";

const props = defineProps<{
  tabs: string[];
}>();

const activeIndex = ref(0);
const activeSlot = computed(() => `tab${activeIndex.value + 1}`);
</script>

<template>
  <div class="content-tabs">
    <div class="content-tabs__list" role="tablist" aria-label="Content tabs">
      <button
        v-for="(tab, index) in props.tabs"
        :key="tab"
        type="button"
        role="tab"
        class="content-tabs__button"
        :class="{ 'content-tabs__button--active': index === activeIndex }"
        :aria-selected="index === activeIndex"
        @click="activeIndex = index"
      >
        {{ tab }}
      </button>
    </div>
    <div class="content-tabs__panel" role="tabpanel">
      <slot :name="activeSlot" />
    </div>
  </div>
</template>

<style scoped>
.content-tabs {
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  overflow: hidden;
  margin: 16px 0;
}

.content-tabs__list {
  display: flex;
  flex-wrap: wrap;
  gap: 0;
  border-bottom: 1px solid var(--vp-c-divider);
  background: var(--vp-code-tab-bg);
}

.content-tabs__button {
  appearance: none;
  border: 0;
  border-right: 1px solid var(--vp-c-divider);
  padding: 10px 14px;
  font-weight: 600;
  color: var(--vp-c-text-2);
  background: transparent;
  cursor: pointer;
}

.content-tabs__button:hover {
  color: var(--vp-c-text-1);
}

.content-tabs__button--active {
  color: var(--vp-c-brand-1);
  background: var(--vp-c-bg);
}

.content-tabs__panel {
  padding: 16px;
}

.content-tabs__panel :deep(*:first-child) {
  margin-top: 0;
}

.content-tabs__panel :deep(*:last-child) {
  margin-bottom: 0;
}
</style>
