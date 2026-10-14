<script setup lang="ts">
// Lab 12: the pipeline as four stages, as in `flows watch`. Each stage can have a judge and a human gateway at its edge.
// Pass `step` (1-4) to highlight where you are in the lab's "Your Task" steps.
import { computed } from "vue";

type Phase = {
  role: string;
  title: string;
  text: string;
  judge?: string;
  checkpoint?: string;
};

const props = defineProps<{ step?: 1 | 2 | 3 | 4 }>();

const phases: Phase[] = [
  {
    role: "Research agent",
    title: "Specification",
    text: "Turns the feature request into a specification.",
    judge: "Covers the request, with its assumptions written down?",
  },
  {
    role: "Plan agent & dispatch",
    title: "Plan",
    text: "Slices the specification into tickets. Code picks the ready ones.",
    judge: "Vertical slices, and each ready ticket independent?",
    checkpoint: "approve",
  },
  {
    role: "Implement loops",
    title: "Implementation",
    text: "One Ralph loop per ticket, each in its own worktree.",
    judge: "Tests pass, and the commit fits the ticket?",
  },
  {
    role: "Review agent & merge",
    title: "Review and merge",
    text: "A read-only agent reviews every branch. Code merges the approved ones.",
    checkpoint: "decide",
  },
];

// The one stage (and checkpoint) each lab step is about
const steps: Record<number, { phase: number; checkpoint?: boolean; label: string }> = {
  1: { phase: 0, label: "1. Start the pipeline" },
  2: { phase: 1, checkpoint: true, label: "2. Approve the tickets" },
  3: { phase: 2, label: "3. Wait for the implement loops and the review agent" },
  4: { phase: 3, checkpoint: true, label: "4. Decide whether to merge" },
};

const current = computed(() => (props.step ? steps[props.step] : undefined));
const isActive = (i: number) => !current.value || current.value.phase === i;
</script>

<template>
  <figure class="pipeline-diagram" :class="{ focused: current }">
    <div class="phases">
      <template v-for="(phase, i) in phases" :key="phase.title">
        <div v-if="i > 0" class="arrow" aria-hidden="true">
          <svg viewBox="0 0 24 12"><path d="M0 6h18M14 1l6 5-6 5" /></svg>
        </div>
        <div class="phase" :class="{ active: current && isActive(i), dim: !isActive(i) }">
          <span class="role">{{ phase.role }}</span>
          <strong>{{ phase.title }}</strong>
          <p>{{ phase.text }}</p>
          <div class="boxes">
            <div v-if="phase.judge" class="box judge">
              <b>Judge</b> {{ phase.judge }}
            </div>
          </div>
          <div
            v-if="phase.checkpoint"
            class="gate"
            :class="{ here: current?.checkpoint && current.phase === i }"
            :title="`Human gateway: you ${phase.checkpoint}`"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>
          </div>
        </div>
      </template>
    </div>
    <figcaption>
      <span v-if="current" class="here-label"><span class="dot"></span>You are here: {{ current.label }}</span>
      <span class="legend">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5" /><path d="M5 20c0-3.9 3.1-7 7-7s7 3.1 7 7" /></svg>
        Human gateway: the pipeline waits for you
      </span>
    </figcaption>
  </figure>
</template>

<style scoped>
.pipeline-diagram {
  container-type: inline-size;
  margin: 24px 0;
  padding: 24px 16px 16px;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.phases {
  display: flex;
  align-items: stretch;
  gap: 4px;
}
.phase {
  position: relative;
  display: flex;
  flex: 1 1 0;
  flex-direction: column;
  min-width: 0;
  padding: 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--vp-c-bg);
  transition: opacity 0.2s;
}
.phase.active {
  border-color: var(--z-purple);
  box-shadow: 0 0 0 1px var(--z-purple);
}
.phase.dim {
  opacity: 0.45;
}
.role {
  font-size: 11.5px;
  line-height: 1.3;
  color: var(--vp-c-text-3);
}
.phase strong {
  margin-top: 4px;
  font-size: 15px;
  line-height: 1.25;
}
.phase p {
  margin: 6px 0 0;
  font-size: 12.5px;
  line-height: 1.45;
  color: var(--vp-c-text-2);
}
.boxes {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: auto;
  padding-top: 10px;
}
.box {
  padding: 7px 9px;
  border-radius: 6px;
  font-size: 12px;
  line-height: 1.4;
}
.box b {
  margin-right: 2px;
}
.judge {
  background: rgba(152, 91, 156, 0.14);
}
.judge b {
  color: var(--vp-c-brand-1);
}
.gate {
  position: absolute;
  top: 0;
  right: -14px;
  z-index: 1;
  transform: translateY(-50%);
}
.gate svg,
.legend svg {
  fill: none;
  stroke: var(--vp-c-text-2);
  stroke-width: 1.8;
  stroke-linecap: round;
}
.gate svg {
  display: block;
  box-sizing: border-box;
  width: 28px;
  height: 28px;
  padding: 4px;
  border: 1.5px solid var(--vp-c-text-3);
  border-radius: 50%;
  background: var(--vp-c-bg);
}
.gate.here svg {
  border-color: var(--z-purple);
  background: var(--z-purple);
  stroke: #fff;
}
.arrow {
  display: flex;
  flex: 0 0 22px;
  align-items: center;
  justify-content: center;
}
.arrow svg {
  width: 18px;
  fill: none;
  stroke: var(--vp-c-text-3);
  stroke-width: 2;
}
figcaption {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px 16px;
  margin-top: 12px;
  font-size: 12px;
  color: var(--vp-c-text-2);
}
.here-label {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.legend {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-left: auto;
}
.legend svg {
  width: 16px;
  height: 16px;
}
.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--z-purple);
}
@container (max-width: 560px) {
  .phases {
    flex-direction: column;
    gap: 10px;
  }
  .arrow {
    justify-content: center;
    flex-basis: 16px;
    transform: rotate(90deg);
  }
}
</style>
