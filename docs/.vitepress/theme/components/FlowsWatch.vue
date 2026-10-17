<script setup lang="ts">
// Lab 12: `flows watch` as it runs, frame by frame. The frames are recorded with the real renderer of
// `flows watch` (see flows-watch/record.mts), so they show exactly what the terminal shows. The colours
// are the ones `flows watch` uses on a light and on a dark terminal, following the page's theme.
import { computed, onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

type Run = [string, number];
interface Recording {
  width: number;
  height: number;
  styles: string[]; // "fg|bg|b"
  rows: Run[][];
  frames: { rows: number[]; ms: number; key?: string; caption?: string }[];
}

// A note highlights parts of the screen in purple ([x, y, w, h] in cells) and explains them in a label at
// (lx, ly). In its text, `code` is set as code and a line break starts a new line. With notes, the recording is a
// still of its last frame, and the notes show one after the other.
interface Note {
  boxes: [number, number, number, number][];
  lx: number;
  ly: number;
  label: string;
  text: string;
}

// A note's text in parts, every other one code
const parts = (text: string) => text.split("`").map((part, i) => ({ part, code: i % 2 === 1 }));

const props = defineProps<{ scene: string; title?: string; notes?: Note[] }>();

const recordings = import.meta.glob<Recording>("./flows-watch/*.json", { import: "default" });

const data = shallowRef<Recording>();
const index = ref(0);
const noteIndex = ref(0);
const playing = ref(false);
const expanded = ref(false);
const key = ref<{ label: string; id: number }>();
const root = ref<HTMLElement>();
const screen = ref<HTMLElement>();
// How wide one character of the monospace font is, in em: measured, since fonts differ
const cellWidth = ref(0.6);

let timer: ReturnType<typeof setTimeout> | undefined;
let keyTimer: ReturnType<typeof setTimeout> | undefined;
let keyId = 0;
let visible = false;
let observer: IntersectionObserver | undefined;

const KEY_NAMES: Record<string, string> = { "⏎": "⏎ Enter", "⌘V": "Paste" };
const LAST_FRAME_PAUSE = 2500;
const NOTE_MS = 6000;

const frame = computed(() => data.value?.frames[index.value]);
const caption = computed(() => {
  const frames = data.value?.frames ?? [];
  for (let i = index.value; i >= 0; i--) if (frames[i]?.caption) return frames[i].caption;
  return "";
});
const note = computed(() => props.notes?.[noteIndex.value]);
// How many steps there are to play: the notes, or else the frames
const steps = computed(() => props.notes?.length ?? data.value?.frames.length ?? 0);
const step = computed(() => (props.notes ? noteIndex.value : index.value));
const progress = computed(() => (steps.value ? (step.value + 1) / steps.value : 0));

// Each run of a row in spans. Characters that some fonts draw wider than a cell (⚑, ✓, braille, …) get a
// cell of their own, so the boxes stay aligned.
const NARROW = /^[\x20-\x7e─│╭╮╰╯▌›·…]$/;
const lines = computed(() => {
  const d = data.value;
  const f = frame.value;
  if (!d || !f) return [];
  return f.rows.map((r) =>
    d.rows[r].map(([text, style]) => {
      const [fg, bg, bold] = d.styles[style].split("|");
      const cls = [fg && `fg-${fg}`, bg && `bg-${bg}`, bold && "bold"].filter(Boolean).join(" ");
      const parts: { text: string; cell: boolean }[] = [];
      for (const ch of text) {
        const cell = !NARROW.test(ch);
        const last = parts[parts.length - 1];
        if (!cell && last && !last.cell) last.text += ch;
        else parts.push({ text: ch, cell });
      }
      return { cls, parts };
    }),
  );
});

function showKey(label?: string) {
  if (!label) return;
  key.value = { label: KEY_NAMES[label] ?? label, id: ++keyId };
  clearTimeout(keyTimer);
  keyTimer = setTimeout(() => (key.value = undefined), 1100);
}

function schedule() {
  clearTimeout(timer);
  const d = data.value;
  if (!d || !playing.value || !visible) return;
  if (props.notes) {
    timer = setTimeout(() => {
      noteIndex.value = (noteIndex.value + 1) % steps.value;
      schedule();
    }, NOTE_MS);
    return;
  }
  const last = index.value === d.frames.length - 1;
  timer = setTimeout(() => {
    index.value = last ? 0 : index.value + 1;
    showKey(frame.value?.key);
    schedule();
  }, d.frames[index.value].ms + (last ? LAST_FRAME_PAUSE : 0));
}

function toggle() {
  playing.value = !playing.value;
  if (playing.value && !props.notes && data.value && index.value === data.value.frames.length - 1) index.value = 0;
  schedule();
}

function restart() {
  if (props.notes) noteIndex.value = 0;
  else index.value = 0;
  playing.value = true;
  schedule();
}

// Click on the progress bar: jump to that frame, or that note
function seek(event: MouseEvent) {
  if (!steps.value) return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  const to = Math.min(steps.value - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * steps.value)));
  if (props.notes) noteIndex.value = to;
  else index.value = to;
  schedule();
}

function measure() {
  if (!screen.value) return;
  const probe = document.createElement("span");
  probe.textContent = "─".repeat(50) + "x".repeat(50);
  probe.style.cssText = "position:absolute;visibility:hidden;font-size:100px;white-space:pre;";
  screen.value.appendChild(probe);
  cellWidth.value = probe.getBoundingClientRect().width / 100 / 100 || 0.6;
  probe.remove();
}

function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && expanded.value) expanded.value = false;
}

watch(expanded, (on) => document.documentElement.classList.toggle("flows-watch-expanded", on));

onMounted(async () => {
  const load = recordings[`./flows-watch/${props.scene}.json`];
  if (!load) return;
  data.value = await load();
  measure();
  document.fonts?.ready.then(measure);
  const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // With reduced motion, it starts paused on the last frame, where the step ends, or on the first note
  index.value = still || props.notes ? data.value.frames.length - 1 : 0;
  playing.value = !still;
  observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  if (root.value) observer.observe(root.value);
  window.addEventListener("keydown", onKeydown);
});

onBeforeUnmount(() => {
  clearTimeout(timer);
  clearTimeout(keyTimer);
  observer?.disconnect();
  window.removeEventListener("keydown", onKeydown);
  document.documentElement.classList.remove("flows-watch-expanded");
});
</script>

<template>
  <div v-if="expanded" class="backdrop" @click="expanded = false"></div>
  <figure ref="root" class="flows-watch" :class="{ expanded }">
    <div class="window">
      <div class="bar">
        <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="name">{{ title ?? "Terminal 1 — flows watch" }}</span>
        <span class="tools">
          <button type="button" :aria-label="playing ? 'Pause' : 'Play'" :title="playing ? 'Pause' : 'Play'" @click="toggle">
            <svg v-if="playing" viewBox="0 0 16 16"><path d="M5 3v10M11 3v10" /></svg>
            <svg v-else viewBox="0 0 16 16"><path d="M5 3l8 5-8 5z" class="solid" /></svg>
          </button>
          <button type="button" aria-label="Start over" title="Start over" @click="restart">
            <svg viewBox="0 0 16 16"><path d="M3.5 8a4.5 4.5 0 1 0 1.4-3.3M3 2.5v3h3" /></svg>
          </button>
          <button type="button" :aria-label="expanded ? 'Smaller' : 'Larger'" :title="expanded ? 'Smaller (Esc)' : 'Larger'" @click="expanded = !expanded">
            <svg v-if="expanded" viewBox="0 0 16 16"><path d="M6 2v4H2M10 14v-4h4M14 6h-4V2M2 10h4v4" /></svg>
            <svg v-else viewBox="0 0 16 16"><path d="M2 6V2h4M14 10v4h-4M10 2h4v4M6 14H2v-4" /></svg>
          </button>
        </span>
      </div>
      <div ref="screen" class="screen" :style="data ? { '--cols': data.width, '--rows': data.height, '--cell': cellWidth } : undefined" role="img" :aria-label="notes ? `flows watch: ${notes.map((n) => `${n.label}: ${n.text.replaceAll('`', '')}`).join(' ')}` : `flows watch: ${caption}`">
        <template v-if="data">
          <div v-for="(line, y) in lines" :key="y" class="line">
            <span v-for="(run, i) in line" :key="i" :class="run.cls"><template v-for="(part, j) in run.parts" :key="j"><span v-if="part.cell" class="cell">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></span>
          </div>
        </template>
        <Transition name="note" mode="out-in">
          <div v-if="note" :key="noteIndex" class="notes">
            <span v-for="([x, y, w, h], i) in note.boxes" :key="i" class="note-box" :style="{ '--x': x, '--y': y, '--w': w, '--h': h }"></span>
            <span class="note" :style="{ '--x': note.lx, '--y': note.ly }"><span><b>{{ note.label }}:</b> <template v-for="({ part, code }, i) in parts(note.text)" :key="i"><code v-if="code">{{ part }}</code><template v-else>{{ part }}</template></template></span></span>
          </div>
        </Transition>
        <Transition name="key">
          <kbd v-if="key" :key="key.id" class="key">{{ key.label }}</kbd>
        </Transition>
      </div>
      <div class="progress" role="presentation" @click="seek"><span :style="{ transform: `scaleX(${progress})` }"></span></div>
    </div>
    <figcaption>
      <span class="dot" :class="{ paused: !playing }"></span>
      <span v-if="note">{{ note.label }} ({{ noteIndex + 1 }} of {{ notes!.length }})</span>
      <span v-else>{{ caption }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
/* The palette of `flows watch` is in zuhlke.css (--tui-*), shared with RalphDiagram */
.flows-watch {
  container-type: inline-size;
  margin: 24px 0;
}
.window {
  overflow: hidden;
  border: 1px solid var(--vp-c-divider);
  border-radius: 10px;
  background: var(--tui-bg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}
.bar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 7px 10px;
  border-bottom: 1px solid var(--tui-line);
  background: var(--tui-chrome);
  font-size: 12px;
  color: var(--tui-muted);
}
.dots {
  display: flex;
  gap: 6px;
}
.dots i {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--tui-line);
}
.name {
  flex: 1;
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.tools {
  display: flex;
  gap: 2px;
}
.tools button {
  display: flex;
  padding: 3px;
  border-radius: 5px;
  color: var(--tui-muted);
}
.tools button:hover {
  background: var(--tui-selected);
  color: var(--tui-text);
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

/* The character grid fills the width: one cell is --cell em wide in the monospace font */
.screen {
  position: relative;
  padding: 10px 12px;
  font-family: var(--vp-font-family-mono);
  font-size: calc((100cqw - 26px) / (var(--cols, 120) * var(--cell, 0.6)));
  line-height: 1.2;
  color: var(--tui-text);
  white-space: pre;
  font-variant-ligatures: none;
  min-height: calc(var(--rows, 30) * 1.2em + 20px);
}
.line {
  height: 1.2em;
  overflow: hidden;
}
.cell {
  display: inline-block;
  width: calc(var(--cell, 0.6) * 1em);
  text-align: center;
  overflow: visible;
}
.bold {
  font-weight: 700;
}
.fg-text {
  color: var(--tui-text);
}
.fg-muted {
  color: var(--tui-muted);
}
.fg-line {
  color: var(--tui-line);
}
.fg-run {
  color: var(--tui-run);
}
.fg-you {
  color: var(--tui-you);
}
.bg-you {
  background: var(--tui-you-tint);
}
.bg-raised {
  background: var(--tui-raised);
}
.bg-selected {
  background: var(--tui-selected);
}

/* Notes: a purple highlight behind cells, and a label that explains them. One note at a time fades in and out. */
.notes {
  position: absolute;
  inset: 0;
  pointer-events: none;
}
.note-enter-active,
.note-leave-active {
  transition: opacity 0.4s;
}
.note-enter-from,
.note-leave-to {
  opacity: 0;
}
.note-box,
.note {
  position: absolute;
  left: calc(12px + var(--x) * var(--cell, 0.6) * 1em);
  top: calc(10px + var(--y) * 1.2em);
}
.note-box {
  width: calc(var(--w) * var(--cell, 0.6) * 1em);
  height: calc(var(--h) * 1.2em);
  margin: -0.15em -0.3em;
  padding: 0.15em 0.3em;
  box-sizing: content-box;
  border-radius: 5px;
  background: color-mix(in srgb, var(--z-purple-bright) 22%, transparent);
}
/* The label's font is larger than the screen's, so it's positioned in the screen's em, then styled inside */
.note {
  margin-top: 0.1em;
}
.note > span {
  display: inline-block;
  padding: 0.1em 0.6em;
  border-radius: 5px;
  background: var(--z-purple);
  color: #fff;
  font-family: var(--vp-font-family-base);
  font-size: max(12px, 1.1em);
  line-height: 1.25;
  white-space: pre;
}
.note code {
  padding: 0 0.25em;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.2);
  color: #fff;
  font-size: 0.95em;
}

/* The key that was just pressed */
.key {
  position: absolute;
  right: 16px;
  bottom: 14px;
  padding: 0.3em 0.8em;
  border: 1px solid var(--tui-you);
  border-bottom-width: 3px;
  border-radius: 7px;
  background: var(--tui-bg);
  font-family: var(--vp-font-family-base);
  font-size: max(13px, 1.25em);
  font-weight: 600;
  color: var(--tui-you);
  box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
}
.key-enter-active {
  transition: transform 0.12s ease-out, opacity 0.12s;
}
.key-leave-active {
  transition: opacity 0.3s;
}
.key-enter-from {
  transform: translateY(4px) scale(0.92);
  opacity: 0;
}
.key-leave-to {
  opacity: 0;
}

.progress {
  height: 3px;
  background: var(--tui-line);
  cursor: pointer;
}
.progress span {
  display: block;
  height: 100%;
  background: var(--tui-you);
  transform-origin: left;
  transition: transform 0.15s linear;
}
figcaption {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
  min-height: 1.5em;
  font-size: 13px;
  font-weight: 600;
  color: var(--vp-c-brand-1);
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

/* Larger: over the page, as wide as the window allows */
.flows-watch.expanded {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 100;
  width: min(96vw, calc((100vh - 150px) * 1.85));
  margin: 0;
  transform: translate(-50%, -50%);
}
.flows-watch.expanded figcaption {
  color: #fff;
}
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: rgba(0, 0, 0, 0.6);
}
</style>

<style>
/* While a recording is larger, the page behind it doesn't scroll */
html.flows-watch-expanded {
  overflow: hidden;
}
</style>
