<script setup lang="ts">
// Lab 12: the pipeline's branches. Research, design and plan come onto your branch at each checkpoint. After you
// approve, the tasks and the review branch start from the same commit, each finished task is merged into the
// review branch, and after the review your branch is fast-forwarded to it.
const LANES = [
  { y: 52, name: "your branch", sub: "where flows start ran" },
  { y: 112, name: "agent/<slug>/plan", sub: "research, design, plan" },
  { y: 162, name: "agent/<slug>/review", sub: "tasks merge here, review runs here" },
  { y: 206, name: "agent/<slug>/task-1", sub: "Ralph loop, own worktree" },
  { y: 246, name: "agent/<slug>/task-2", sub: "same base, same time" },
  { y: 286, name: "agent/<slug>/task-3", sub: "same base, same time" },
];
const STEPS = [
  { x: 290, label: "research" },
  { x: 350, label: "design" },
  { x: 410, label: "plan" },
];
// Each task: its lane, and where it merges into the review branch
const TASKS = [
  { y: 206, at: 630 },
  { y: 246, at: 665 },
  { y: 286, at: 700 },
];
const COMMITS = [510, 550, 590];
</script>

<template>
  <figure class="diagram">
    <svg viewBox="0 0 830 320" role="img" aria-label="The pipeline's branches: plan, tasks and review branch off your branch, the tasks merge into the review branch, and your branch fast-forwards to it after the review">
      <g v-for="lane in LANES" :key="lane.name">
        <text class="lane" x="12" :y="lane.y - 2">{{ lane.name }}</text>
        <text class="sub start" x="12" :y="lane.y + 13">{{ lane.sub }}</text>
      </g>

      <!-- your branch -->
      <path class="line" d="M215 52 H815" />
      <text class="title" x="240" y="16">your request</text>
      <text class="sub" x="240" y="30">base commit</text>
      <text class="title" x="460" y="16">you approve</text>
      <text class="sub" x="460" y="30">specification, design, tasks</text>
      <text class="title" x="755" y="16">merge</text>
      <text class="sub" x="755" y="30">fast-forward after review</text>

      <!-- plan: off the base commit, onto your branch at each checkpoint -->
      <path class="line" d="M240 52 C260 52 255 112 280 112 H420 C440 112 440 52 460 52" />
      <text class="sub" x="350" y="78">at each checkpoint,</text>
      <text class="sub" x="350" y="92">fast-forward onto your branch</text>
      <g v-for="step in STEPS" :key="step.label">
        <circle class="agent" :cx="step.x" cy="112" r="8" />
        <text class="sub" :x="step.x" y="136">{{ step.label }}</text>
      </g>

      <!-- review branch and tasks: all off the approved commit -->
      <path class="line" d="M460 52 C485 52 480 162 505 162 H735 C750 162 745 52 755 52" />
      <path v-for="t in TASKS" :key="t.y" class="line" :d="`M460 52 C480 52 475 ${t.y} 495 ${t.y} H${t.at - 30} C${t.at - 10} ${t.y} ${t.at - 10} 162 ${t.at} 162`" />
      <text class="sub start" x="510" y="80">tasks and review branch off here,</text>
      <text class="sub start" x="510" y="94">all from the same commit</text>
      <g v-for="t in TASKS" :key="`c${t.y}`">
        <circle v-for="x in COMMITS" :key="x" class="agent" :cx="x" :cy="t.y" r="8" />
      </g>
      <text class="sub" x="550" y="229">one commit per loop</text>
      <circle v-for="t in TASKS" :key="`m${t.y}`" class="agent" :cx="t.at" cy="162" r="8" />
      <text class="sub" x="665" y="146">tasks merge in</text>
      <path class="review" d="M722 140 V186" />
      <text class="title" x="722" y="132">review</text>

      <circle class="you" cx="240" cy="52" r="9" />
      <circle class="you" cx="460" cy="52" r="9" />
      <circle class="you" cx="755" cy="52" r="9" />
    </svg>
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
.start {
  text-anchor: start;
}
.lane {
  text-anchor: start;
  font-size: 12.5px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
}
.title {
  font-size: 12.5px;
  font-weight: 600;
  fill: var(--vp-c-text-1);
}
.sub {
  font-size: 11.5px;
  fill: var(--vp-c-text-3);
}
.line {
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 1.4;
}
.review {
  stroke: var(--vp-c-text-2);
  stroke-width: 1.4;
  stroke-dasharray: 4 3;
}
.agent {
  fill: var(--tui-run-tint);
  stroke: var(--tui-run);
  stroke-width: 1.6;
}
.you {
  fill: var(--tui-you-tint);
  stroke: var(--tui-you);
  stroke-width: 1.8;
}
</style>
