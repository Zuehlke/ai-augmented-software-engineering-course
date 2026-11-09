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
const context = computed(() => (typeof frame.value.step === "number" ? [20, 77, 112, 133][frame.value.step] : 0));
const running = computed(() => typeof frame.value.step === "number");
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
    <svg viewBox="0 0 720 368" role="img" :aria-label="`Ralph loop: ${frame.caption}`">
      <!-- The run: dashed, its context is thrown away after every run -->
      <rect class="run-frame" x="36" y="10" width="672" height="132" rx="10" />
      <text class="label" x="52" y="34">RUN {{ frame.run + 1 }} OF 3 · FRESH CONTEXT</text>
      <text class="sub end" x="462" y="34">context</text>
      <rect class="bar" x="472" y="25" width="140" height="10" rx="5" />
      <rect class="bar fill" x="472" y="25" :width="context" height="10" rx="5" />
      <text class="sub" x="620" y="34">{{ contextLabel }}</text>
      <g class="run-body" :class="{ wiped: !running }">
        <g v-for="([title, sub], i) in STEPS" :key="title" :class="['step', { on: frame.step === i, judge: i === 2 }]">
          <rect :x="52 + i * 166" y="54" width="142" height="64" rx="7" />
          <text class="title" :x="123 + i * 166" y="82">{{ title }}</text>
          <text class="sub mid" :x="123 + i * 166" y="102">{{ sub }}</text>
        </g>
        <path v-for="i in 3" :key="i" class="head" :d="`M${36 + i * 166} 80 l8 6 -8 6z`" />
      </g>

      <!-- Between the two: a run reads all the memory, its commit writes to all of it -->
      <g class="io" :class="{ on: frame.step === 0 }">
        <path class="dash" d="M123 192 V124" /><path class="head" d="M117 130 l6 -10 6 10z" />
        <text class="sub" x="135" y="170">reads all</text>
      </g>
      <g class="io" :class="{ on: frame.step === 3 }">
        <path class="dash" d="M621 122 V188" /><path class="head" d="M615 182 l6 10 6 -10z" />
        <text class="sub end" x="609" y="170">writes all</text>
      </g>

      <!-- The memory: solid, it survives every run -->
      <rect class="mem-frame" x="36" y="196" width="672" height="124" rx="10" />
      <text class="label" x="52" y="220">MEMORY · SURVIVES EVERY RUN</text>
      <rect v-for="i in 3" :key="i" class="memory" :x="52 + (i - 1) * 214" y="232" width="200" height="74" rx="7" />
      <text class="file" x="68" y="254">git history</text>
      <path class="track" d="M80 288 H144" />
      <circle v-for="i in 3" :key="i" :class="['commit', { on: i <= commits }]" :cx="48 + i * 32" cy="288" r="7" />
      <text class="file" x="282" y="254">progress.md</text>
      <rect v-for="(w, i) in [150, 120, 140]" :key="i" :class="['line', { on: i < commits }]" x="282" :y="270 + i * 14" :width="w" height="6" rx="3" />
      <text class="file" x="496" y="254">task status</text>
      <text class="status" :class="{ done: frame.step === 'done' }" x="496" y="294">{{ frame.step === "done" ? "done" : "open" }}</text>

      <!-- The loop: the task status decides, the next run comes into Read from outside -->
      <path class="loop" :class="{ on: frame.step === 'wipe', off: frame.step === 'done' }" d="M580 306 V338 Q580 346 572 346 H26 Q18 346 18 338 V94 Q18 86 26 86 H44" />
      <path class="loop-head" :class="{ on: frame.step === 'wipe', off: frame.step === 'done' }" d="M42 80 L52 86 L42 92 Z" />
      <text class="sub mid loop-label" :class="{ on: frame.step === 'wipe' }" x="300" y="362">{{ frame.step === "done" ? "done: no next run" : "not done: same prompt, next run" }}</text>
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
.sub {
  font-size: 12.5px;
  fill: var(--vp-c-text-3);
}
.mid,
.title {
  text-anchor: middle;
}
.end {
  text-anchor: end;
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
.loop.off,
.loop-head.off {
  opacity: 0.35;
}
.loop-label {
  transition: fill 0.3s;
}
.loop-label.on {
  fill: var(--tui-run);
}
.run-frame {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.2;
  stroke-dasharray: 5 4;
}
.mem-frame {
  fill: var(--vp-c-bg);
  stroke: var(--vp-c-divider);
  stroke-width: 1.2;
}
.run-body {
  transition: opacity 0.45s;
}
.run-body.wiped {
  opacity: 0.18;
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
/* The judge is the validator: purple, as in JudgeDiagram */
.step.judge.on rect {
  fill: var(--tui-you-tint);
  stroke: var(--tui-you);
}
.step.judge.on .title {
  fill: var(--tui-you);
}
.head {
  fill: var(--vp-c-text-3);
}
.dash {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.4;
  stroke-dasharray: 4 4;
  transition: stroke 0.3s;
}
.io .head,
.io .sub {
  transition: fill 0.3s;
}
.io.on .dash {
  stroke: var(--tui-run);
}
.io.on .head,
.io.on .sub {
  fill: var(--tui-run);
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
