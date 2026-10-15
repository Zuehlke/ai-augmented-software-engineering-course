<script setup lang="ts">
// Lab 10: the Ralph loop, run by run, in the look of `flows watch`. The agent does one step and commits, then
// the judge checks it (code, tests, the judge skill) and its verdict decides the next run.
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

type Check = "todo" | "running" | "ok" | "fail";
type RunResult = "running" | "pass" | "retry" | "done";
interface Frame {
  runs: RunResult[]; // one per run so far, the last is the current one
  agent: { state: "running" | "done" | "idle"; lines: string[]; status: string };
  judge?: { checks: Check[]; status: string; verdict?: "pass" | "retry" };
  decision?: { kind: "pass" | "retry" | "done"; text: string };
  flow?: "commits" | "verdict"; // which arrow carries something
  caption: string;
  ms: number;
}

const RUNS = [
  { step: "Store airlines apart from delays", verdict: "pass" as const },
  { step: "Link delay events to flights", verdict: "retry" as const, why: "the migration loses the delays of cancelled flights" },
  { step: "Keep the delays of cancelled flights", verdict: "pass" as const, done: true },
];
// What the judge checks, in this order: plain code first, then the tests, then a second agent
const CHECKS = [
  ["1 rules", "Is the step committed, with nothing left over?"],
  ["2 tests", "Do all tests pass?"],
  ["3 review", "A read-only agent reads the commit: does it fit the ticket?"],
];
const CHECK_CAPTIONS = [
  "Check 1: plain code checks the commit",
  "Check 2: all tests must pass",
  "Check 3: a second agent reviews the commit. It didn't write it, so it has no reason to defend it",
];

// The whole story, frame by frame
const frames: Frame[] = (() => {
  const out: Frame[] = [];
  const runs: RunResult[] = [];
  RUNS.forEach((run, r) => {
    const n = r + 1;
    const feedback = r > 0 && RUNS[r - 1].verdict === "retry";
    runs.push("running");
    const lines = ["starts with an empty context", "reads where the last run stopped"];
    if (feedback) lines.push("reads what the judge wants fixed");
    const at = (status: string, caption: string, ms: number) =>
      out.push({ runs: [...runs], agent: { state: "running", lines: [...lines], status }, caption, ms });

    at(
      `run ${n} · starts`,
      feedback
        ? `Run ${n}: a new agent reads the progress file and the judge's feedback`
        : `Run ${n}: a new agent reads the progress file to see where to go on`,
      2400,
    );
    lines.push(`does one step: ${run.step}`);
    at(`run ${n} · working`, "It does one small step of the ticket", 2000);
    lines.push("commits the step");
    out.push({ runs: [...runs], agent: { state: "done", lines: [...lines], status: "✓ step committed" }, flow: "commits", caption: "It commits the step and hands it to the judge", ms: 1800 });

    // The judge: the checks one after the other
    const checks: Check[] = ["todo", "todo", "todo"];
    const judged = (status: string, caption: string, ms: number, verdict?: "pass" | "retry") =>
      out.push({ runs: [...runs], agent: { state: "idle", lines: [...lines], status: "waits for the verdict" }, judge: { checks: [...checks], status, verdict }, caption, ms });
    for (let c = 0; c < CHECKS.length; c++) {
      checks[c] = "running";
      judged("⚖ judge is checking", CHECK_CAPTIONS[c], c === 2 ? 2800 : 1800);
      checks[c] = run.verdict === "retry" && c === 2 ? "fail" : "ok";
    }
    const pass = run.verdict === "pass";
    const verdictText = pass ? "PASS: the step is good" : `RETRYABLE: ${run.why}`;
    judged(verdictText, pass ? "Verdict PASS: the step is good" : "Verdict RETRYABLE: the step needs a fix, and the judge says which", 2200, run.verdict);

    runs[r] = run.done ? "done" : pass ? "pass" : "retry";
    const decision = run.done
      ? { kind: "done" as const, text: "The ticket is done, so the loop stops" }
      : pass
        ? { kind: "pass" as const, text: "So the next run does the next step" }
        : { kind: "retry" as const, text: "So the next run gets the judge's feedback and fixes the step first" };
    out.push({
      runs: [...runs],
      agent: { state: "idle", lines: [...lines], status: run.done ? "✓ ticket done" : `✓ run ${n} over` },
      judge: { checks: [...checks], status: verdictText, verdict: run.verdict },
      decision,
      flow: "verdict",
      caption: decision.text,
      ms: run.done ? 5000 : 2800,
    });
  });
  return out;
})();

const index = ref(0);
const tick = ref(0);
const playing = ref(false);
const root = ref<HTMLElement>();
let timer: ReturnType<typeof setTimeout> | undefined;
let spinner: ReturnType<typeof setInterval> | undefined;
let visible = false;
let observer: IntersectionObserver | undefined;

const SPINNER = "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏";
const spin = computed(() => SPINNER[tick.value % SPINNER.length]);
const frame = computed(() => frames[index.value]);
const RUN_GLYPH: Record<RunResult, string> = { running: "", pass: "✓", retry: "↺", done: "✓ done" };
const CHECK_GLYPH: Record<Check, string> = { todo: "·", running: "", ok: "✓", fail: "✗" };

function schedule() {
  clearTimeout(timer);
  if (!playing.value || !visible) return;
  timer = setTimeout(() => {
    index.value = (index.value + 1) % frames.length;
    schedule();
  }, frame.value.ms);
}

function toggle() {
  playing.value = !playing.value;
  schedule();
}

function restart() {
  index.value = 0;
  playing.value = true;
  schedule();
}

onMounted(() => {
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // With reduced motion, it starts paused where the ticket is done
  index.value = still ? frames.length - 1 : 0;
  playing.value = !still;
  if (!still) spinner = setInterval(() => tick.value++, 120);
  observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  if (root.value) observer.observe(root.value);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  clearInterval(spinner);
  observer?.disconnect();
});
</script>

<template>
  <figure ref="root" class="ralph">
    <div class="panel" role="img" :aria-label="`Ralph loop: ${frame.caption}`">
      <div class="head">
        <span><b>Ralph loop</b> <span class="muted">TICKET-1</span></span>
        <span class="runs">
          <span v-for="(result, i) in frame.runs" :key="i" :class="['run', result]">
            run {{ i + 1 }} {{ result === "running" ? spin : RUN_GLYPH[result] }}
          </span>
        </span>
      </div>

      <div class="stage">
        <div class="box agent" :class="frame.agent.state">
          <span class="chip">skills/implement</span>
          <strong>Agent</strong>
          <ul>
            <li v-for="line in frame.agent.lines" :key="line" :class="{ strong: line.startsWith('reads what the judge') }">{{ line }}</li>
          </ul>
          <span class="status">{{ frame.agent.state === "running" ? `${spin} ` : "" }}{{ frame.agent.status }}</span>
        </div>

        <div class="arrows" aria-hidden="true">
          <span :class="{ on: frame.flow === 'commits' }">commit <i>──›</i></span>
          <span :class="{ on: frame.flow === 'verdict' }"><i>‹──</i> verdict</span>
        </div>

        <div v-if="frame.judge" class="box judge" :class="{ running: !frame.judge.verdict }">
          <span class="chip">skills/judge</span>
          <strong>Judge</strong>
          <ul>
            <li v-for="(check, i) in frame.judge.checks" :key="i" :class="['check', check]">
              <span class="glyph">{{ check === "running" ? spin : CHECK_GLYPH[check] }}</span>
              <span><b>{{ CHECKS[i][0] }}</b> <span class="muted">{{ CHECKS[i][1] }}</span></span>
            </li>
          </ul>
          <span class="status" :class="frame.judge.verdict">{{ frame.judge.status }}</span>
        </div>
        <div v-else class="box placeholder">
          <span class="chip">skills/judge</span>
          <strong>Judge</strong>
          <span class="status">waits for a commit</span>
        </div>
      </div>

      <div class="decision" :class="frame.decision?.kind">
        <template v-if="frame.decision"><span class="glyph">{{ frame.decision.kind === "retry" ? "↺" : "✓" }}</span>{{ frame.decision.text }}</template>
      </div>
    </div>

    <figcaption>
      <span class="dot" :class="{ paused: !playing }"></span>
      <span class="caption">{{ frame.caption }}</span>
      <span class="tools">
        <button type="button" :aria-label="playing ? 'Pause' : 'Play'" :title="playing ? 'Pause' : 'Play'" @click="toggle">
          <svg v-if="playing" viewBox="0 0 16 16"><path d="M5 3v10M11 3v10" /></svg>
          <svg v-else viewBox="0 0 16 16"><path d="M5 3l8 5-8 5z" class="solid" /></svg>
        </button>
        <button type="button" aria-label="Start over" title="Start over" @click="restart">
          <svg viewBox="0 0 16 16"><path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3 2.5v3h3" /></svg>
        </button>
      </span>
    </figcaption>
    <p class="note">
      When the judge can't decide alone, its verdict is <code>AMBIGUOUS</code> and the loop
      <span class="you">⚑ needs you</span>: <code>flows watch</code> shows its question, and the next run gets your answer.
    </p>
  </figure>
</template>

<style scoped>
.ralph {
  container-type: inline-size;
  margin: 24px 0;
}
.panel {
  padding: 14px 16px 12px;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--tui-bg);
  color: var(--tui-text);
  font-family: var(--vp-font-family-mono);
  font-size: 12.5px;
  line-height: 1.5;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.muted {
  color: var(--tui-muted);
}
.head {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 4px 16px;
  padding-bottom: 8px;
  border-bottom: 1px solid var(--tui-line);
}
.runs {
  display: flex;
  gap: 14px;
}
.run {
  color: var(--tui-muted);
}
.run.running {
  color: var(--tui-run);
  font-weight: 700;
}
.run.done {
  color: var(--tui-text);
  font-weight: 700;
}

.stage {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  gap: 10px;
  margin-top: 20px;
}
.box {
  position: relative;
  display: flex;
  flex-direction: column;
  min-height: 200px;
  padding: 14px 14px 10px;
  border: 1px solid var(--tui-line);
  border-radius: 7px;
  transition: border-color 0.3s;
}
.box.running {
  border-color: var(--tui-run);
}
.box strong {
  transition: color 0.3s;
}
.box.running strong {
  color: var(--tui-run);
}
.chip {
  position: absolute;
  top: -0.8em;
  left: 10px;
  padding: 0 6px;
  background: var(--tui-bg);
  color: var(--tui-muted);
}
.box ul {
  flex: 1;
  margin: 6px 0 8px;
  padding: 0;
  list-style: none;
}
.box li {
  margin: 0;
  color: var(--tui-muted);
}
/* A wrapped line starts under the text, not under the › */
.agent li {
  padding-left: 2ch;
  text-indent: -2ch;
}
.agent li::before {
  content: "› ";
}
.agent li.strong {
  color: var(--tui-text);
  font-weight: 700;
}
.status {
  color: var(--tui-muted);
}
.box.running .status {
  color: var(--tui-run);
  font-weight: 700;
}
.status.pass,
.status.retry {
  color: var(--tui-text);
  font-weight: 700;
}
.check {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
}
.check .glyph {
  flex: 0 0 1ch;
}
.check b {
  color: var(--tui-muted);
}
.check.running .glyph,
.check.running b {
  color: var(--tui-run);
}
.check.ok .glyph,
.check.ok b,
.check.fail b {
  color: var(--tui-text);
}
.check.fail .glyph {
  color: var(--tui-you);
  font-weight: 700;
}
.placeholder {
  border-style: dashed;
  color: var(--tui-muted);
}
.placeholder strong {
  font-weight: 400;
}
.placeholder .status {
  margin-top: auto;
}

.arrows {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 28px;
  color: var(--tui-muted);
  white-space: nowrap;
}
.arrows span {
  transition: color 0.3s;
}
.arrows span:last-child {
  text-align: right;
}
.arrows i {
  font-style: normal;
  color: var(--tui-line);
  transition: color 0.3s;
}
.arrows .on,
.arrows .on i {
  color: var(--tui-run);
  font-weight: 700;
}

.decision {
  min-height: 1.5em;
  margin-top: 12px;
  padding: 4px 10px;
  border-radius: 4px;
  font-weight: 700;
  transition: background 0.3s;
}
.decision .glyph {
  margin-right: 8px;
}
.decision.pass,
.decision.done {
  background: var(--tui-raised);
}
.decision.retry {
  background: var(--tui-selected);
}

/* The judge fades in when there's a commit to check, each new line of the agent too */
.judge {
  animation: judge-in 0.4s ease-out;
}
.agent li {
  animation: line-in 0.3s ease-out;
}
@keyframes judge-in {
  from {
    opacity: 0;
    transform: translateX(-12px);
  }
}
@keyframes line-in {
  from {
    opacity: 0;
    transform: translateY(-3px);
  }
}
@media (prefers-reduced-motion: reduce) {
  .judge,
  .agent li {
    animation: none;
  }
}

figcaption {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
}
.caption {
  flex: 1;
}
.dot {
  flex: none;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--z-purple);
}
.dot.paused {
  background: var(--vp-c-text-3);
}
.tools {
  display: flex;
  gap: 2px;
}
.tools button {
  display: flex;
  padding: 3px;
  border-radius: 5px;
  color: var(--vp-c-text-3);
}
.tools button:hover {
  background: var(--vp-c-bg-soft);
  color: var(--vp-c-text-1);
}
.tools svg {
  width: 15px;
  height: 15px;
  fill: none;
  stroke: currentColor;
  stroke-width: 1.6;
  stroke-linecap: round;
  stroke-linejoin: round;
}
.tools svg .solid {
  fill: currentColor;
}
.note {
  margin: 6px 0 0;
  font-size: 13px;
  line-height: 1.5;
  color: var(--vp-c-text-2);
}
.you {
  color: var(--tui-you);
  font-weight: 700;
}

@container (max-width: 560px) {
  .stage {
    grid-template-columns: 1fr;
    gap: 6px;
  }
  .box {
    min-height: 0;
  }
  .arrows {
    flex-direction: row;
    justify-content: center;
    gap: 20px;
    padding: 8px 0;
  }
  .arrows i {
    display: inline-block;
    transform: rotate(90deg);
  }
}
</style>
