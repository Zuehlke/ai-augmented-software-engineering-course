<script setup lang="ts">
// Lab 10: the generator and validator pattern. The agent generates a step, the judge validates it:
// a rejected step goes back with feedback, a passed one lets the work go on.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

const AT = { gen: "translate(270px, 92px)", val: "translate(450px, 92px)", back: "translate(450px, 140px)", home: "translate(270px, 140px)" };
const frames = [
  { at: "gen", token: "step", caption: "The agent generates one small step" },
  { at: "val", token: "step", caption: "It hands the step to the judge" },
  { at: "val", token: "step", verdict: "reject", caption: "The judge didn't write it, so it has no reason to defend it: reject" },
  { at: "back", token: "fix", verdict: "reject", caption: "It says what to fix" },
  { at: "home", token: "fix", caption: "The feedback goes back to the agent" },
  { at: "gen", token: "step", caption: "The agent fixes the step" },
  { at: "val", token: "step", caption: "The judge validates it again" },
  { at: "val", token: "step", verdict: "pass", caption: "Pass: the work goes on" },
] as const;

const index = ref(0);
const frame = computed(() => frames[index.value]);
// A new round jumps back to the agent instead of sliding
const jump = computed(() => index.value === 0 || (frame.value.at === "gen" && frames[index.value - 1].at === "home"));

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) index.value = frames.length - 1;
  else timer = setInterval(() => (index.value = (index.value + 1) % frames.length), 1900);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <figure class="diagram">
    <svg viewBox="0 0 720 220" role="img" :aria-label="`Generator and validator: ${frame.caption}`">
      <rect class="gen" x="40" y="60" width="230" height="110" rx="9" />
      <text class="title gen-title" x="155" y="96">Agent generates</text>
      <text class="text" x="155" y="120">one small step</text>
      <text class="sub" x="155" y="146">Sonnet</text>

      <rect class="val" x="450" y="60" width="230" height="110" rx="9" />
      <text class="title val-title" x="565" y="96">Judge validates</text>
      <text class="text" x="565" y="120">tests, then a review</text>
      <text class="sub" x="565" y="146">Opus · didn't write it</text>

      <path class="line" d="M270 92 H440" /><path class="head" d="M440 86 l10 6 -10 6z" />
      <text class="sub" x="360" y="74">step</text>
      <path class="line" d="M450 140 H280" /><path class="head" d="M280 134 l-10 6 10 6z" />
      <text class="sub" x="360" y="170">feedback: what to fix</text>

      <g class="token" :style="{ transform: AT[frame.at], transition: jump ? 'none' : undefined }">
        <rect x="-26" y="-11" width="52" height="22" rx="11" />
        <text x="0" y="4">{{ frame.token }}</text>
      </g>

      <text v-if="frame.verdict" :class="['verdict', frame.verdict]" x="565" y="40">
        {{ frame.verdict === "pass" ? "✓ pass" : "✗ reject" }}
      </text>
      <text class="sub" x="360" y="208">The one who writes never checks. The checker is the stronger model.</text>
    </svg>
    <figcaption>{{ frame.caption }}</figcaption>
  </figure>
</template>

<style scoped>
.diagram {
  margin: 24px 0;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
}
svg {
  display: block;
  width: 100%;
  height: auto;
  font-family: var(--vp-font-family-base);
}
text {
  text-anchor: middle;
}
.gen {
  fill: var(--tui-run-tint);
  stroke: var(--tui-run);
  stroke-width: 2;
}
.val {
  fill: var(--tui-you-tint);
  stroke: var(--tui-you);
  stroke-width: 2;
}
.title {
  font-size: 16px;
  font-weight: 600;
}
.gen-title {
  fill: var(--tui-run);
}
.val-title {
  fill: var(--tui-you);
}
.text {
  font-size: 12.5px;
  fill: var(--vp-c-text-1);
}
.sub {
  font-size: 12.5px;
  fill: var(--vp-c-text-3);
}
.line {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.4;
}
.head {
  fill: var(--vp-c-text-3);
}
.token {
  transition: transform 1.1s ease-in-out;
}
.token rect {
  fill: var(--vp-c-text-1);
}
.token text {
  font-size: 11.5px;
  fill: var(--vp-c-bg);
}
.verdict {
  font-size: 14px;
  font-weight: 700;
}
.verdict.reject {
  fill: var(--tui-you);
}
.verdict.pass {
  fill: var(--vp-c-green-1);
}
figcaption {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
@media (prefers-reduced-motion: reduce) {
  .token {
    transition: none !important;
  }
}
</style>
