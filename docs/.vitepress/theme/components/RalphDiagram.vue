<script setup lang="ts">
// Lab 10: the Ralph loop. Three runs of the same prompt, each with a fresh context; only the memory survives.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type Step = 0 | 1 | 2 | 3 | "wipe" | "done";
const STEPS = [
  ["Read", "memory, task"],
  ["Agent generates", "one small step"],
  ["Judge validates", "tests, then a review"],
  ["Commit", "one git commit"],
];
const CAPTIONS = [
  "A new agent starts with an empty context and reads the memory",
  "The agent generates one small step",
  "The judge validates the step: tests, then a review",
  "It commits. Git and progress.md now know about the step",
];

const frames: { run: number; step: Step; caption: string }[] = [];
for (let run = 0; run < 3; run++) {
  for (let step = 0; step < 4; step++) frames.push({ run, step: step as Step, caption: CAPTIONS[step] });
  frames.push(
    run === 2
      ? { run, step: "done", caption: "The task is done, so the loop stops" }
      : { run, step: "wipe", caption: "The run ends and its context is thrown away. Same prompt again" },
  );
}

const index = ref(0);
const frame = computed(() => frames[index.value]);
const context = computed(() => (typeof frame.value.step === "number" ? [30, 110, 160, 190][frame.value.step] : 0));
const contextLabel = computed(() => {
  const step = frame.value.step;
  return step === 0 ? "empty" : step === "wipe" ? "thrown away" : step === "done" ? "" : "filling";
});
// Commits so far: the current run's counts once it has committed
const commits = computed(() => frame.value.run + (frame.value.step === 3 || typeof frame.value.step !== "number" ? 1 : 0));

let timer: ReturnType<typeof setInterval> | undefined;
onMounted(() => {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) index.value = frames.length - 1;
  else timer = setInterval(() => (index.value = (index.value + 1) % frames.length), 1900);
});
onBeforeUnmount(() => clearInterval(timer));
</script>

<template>
  <figure class="diagram">
    <svg viewBox="0 0 720 310" role="img" :aria-label="`Ralph loop: ${frame.caption}`">
      <text class="run" x="20" y="30">Run {{ frame.run + 1 }}</text>
      <text class="sub" x="90" y="30">context</text>
      <rect class="bar" x="145" y="21" width="200" height="10" rx="5" />
      <rect class="bar fill" x="145" y="21" :width="context" height="10" rx="5" />
      <text class="sub" x="355" y="30">{{ contextLabel }}</text>

      <path class="loop" :class="{ on: frame.step === 'wipe' }" d="M623 92 V68 Q623 56 611 56 H107 Q95 56 95 68 V84" />
      <path class="loop-head" :class="{ on: frame.step === 'wipe' }" d="M89 80 L95 92 L101 80 Z" />
      <text class="sub mid" x="360" y="48">same prompt again, until the task is done</text>

      <g v-for="([title, sub], i) in STEPS" :key="title" :class="['step', { on: frame.step === i }]">
        <rect :x="20 + i * 176" y="96" width="150" height="64" rx="7" />
        <text class="title" :x="95 + i * 176" y="124">{{ title }}</text>
        <text class="sub mid" :x="95 + i * 176" y="144">{{ sub }}</text>
      </g>
      <path v-for="i in 3" :key="i" class="head" :d="`M${i * 176} 122 l8 6 -8 6z`" />

      <path class="dash" d="M95 196 V164" /><path class="head" d="M89 170 l6 -10 6 10z" />
      <path class="dash" d="M623 164 V196" /><path class="head" d="M617 190 l6 10 6-10z" />

      <text class="label" x="360" y="190">MEMORY · ALL THAT SURVIVES A RUN</text>
      <rect class="memory" x="20" y="204" width="222" height="90" rx="7" />
      <text class="file" x="36" y="228">git history</text>
      <path class="track" d="M48 262 H112" />
      <circle v-for="i in 3" :key="i" :class="['commit', { on: i <= commits }]" :cx="16 + i * 32" cy="262" r="7" />
      <rect class="memory" x="249" y="204" width="222" height="90" rx="7" />
      <text class="file" x="265" y="228">progress.md</text>
      <rect v-for="(w, i) in [150, 120, 140]" :key="i" :class="['line', { on: i < commits }]" x="265" :y="244 + i * 16" :width="w" height="6" rx="3" />
      <rect class="memory" x="478" y="204" width="222" height="90" rx="7" />
      <text class="file" x="494" y="228">task status</text>
      <text class="status" :class="{ done: frame.step === 'done' }" x="494" y="268">{{ frame.step === "done" ? "done" : "open" }}</text>
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
.run {
  font-size: 14px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
}
.sub {
  font-size: 12.5px;
  fill: var(--vp-c-text-3);
}
.mid,
.title,
.label {
  text-anchor: middle;
}
.bar {
  fill: var(--vp-c-divider);
}
.bar.fill {
  fill: var(--tui-run);
  transition: width 0.7s ease;
}
.loop {
  fill: none;
  stroke: var(--vp-c-divider);
  stroke-width: 1.8;
  transition: stroke 0.3s;
}
.loop-head {
  fill: var(--vp-c-divider);
  transition: fill 0.3s;
}
.loop.on {
  stroke: var(--tui-run);
}
.loop-head.on {
  fill: var(--tui-run);
}
.step rect {
  fill: var(--vp-c-bg);
  stroke: var(--vp-c-divider);
  stroke-width: 1.2;
  transition: fill 0.3s, stroke 0.3s;
}
.step.on rect {
  fill: var(--tui-run-tint);
  stroke: var(--tui-run);
  stroke-width: 2;
}
.title {
  font-size: 15px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
  transition: fill 0.3s;
}
.step.on .title {
  fill: var(--tui-run);
}
.head {
  fill: var(--vp-c-text-3);
}
.dash {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.4;
  stroke-dasharray: 4 4;
}
.label {
  font-size: 11.5px;
  font-weight: 600;
  letter-spacing: 0.09em;
  fill: var(--vp-c-text-3);
}
.memory {
  fill: var(--vp-c-bg-soft);
  stroke: var(--vp-c-divider);
}
.file {
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  fill: var(--vp-c-text-1);
}
.track {
  stroke: var(--vp-c-divider);
  stroke-width: 1.4;
}
.commit,
.line {
  opacity: 0;
  transition: opacity 0.4s;
}
.commit {
  fill: var(--vp-c-text-1);
}
.line {
  fill: var(--vp-c-text-3);
}
.commit.on,
.line.on {
  opacity: 1;
}
.status {
  font-size: 15px;
  font-weight: 600;
  fill: var(--vp-c-text-3);
}
.status.done {
  fill: var(--vp-c-green-1);
}
figcaption {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
@media (prefers-reduced-motion: reduce) {
  * {
    transition: none !important;
  }
}
</style>
