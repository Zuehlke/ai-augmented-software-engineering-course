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

const props = defineProps<{ scene: string; title?: string }>();

const recordings = import.meta.glob<Recording>("./flows-watch/*.json", { import: "default" });

const data = shallowRef<Recording>();
const index = ref(0);
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

const frame = computed(() => data.value?.frames[index.value]);
const caption = computed(() => {
  const frames = data.value?.frames ?? [];
  for (let i = index.value; i >= 0; i--) if (frames[i]?.caption) return frames[i].caption;
  return "";
});
const progress = computed(() => (data.value ? (index.value + 1) / data.value.frames.length : 0));

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
  const last = index.value === d.frames.length - 1;
  timer = setTimeout(() => {
    index.value = last ? 0 : index.value + 1;
    showKey(frame.value?.key);
    schedule();
  }, d.frames[index.value].ms + (last ? LAST_FRAME_PAUSE : 0));
}

function toggle() {
  playing.value = !playing.value;
  if (playing.value && data.value && index.value === data.value.frames.length - 1) index.value = 0;
  schedule();
}

function restart() {
  index.value = 0;
  playing.value = true;
  schedule();
}

// Click on the progress bar: jump to that frame
function seek(event: MouseEvent) {
  const d = data.value;
  if (!d) return;
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect();
  index.value = Math.min(d.frames.length - 1, Math.max(0, Math.floor(((event.clientX - box.left) / box.width) * d.frames.length)));
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
  // With reduced motion, it starts paused on the last frame, where the step ends
  index.value = still ? data.value.frames.length - 1 : 0;
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
      <div ref="screen" class="screen" :style="data ? { '--cols': data.width, '--rows': data.height, '--cell': cellWidth } : undefined" role="img" :aria-label="`flows watch: ${caption}`">
        <template v-if="data">
          <div v-for="(line, y) in lines" :key="y" class="line">
            <span v-for="(run, i) in line" :key="i" :class="run.cls"><template v-for="(part, j) in run.parts" :key="j"><span v-if="part.cell" class="cell">{{ part.text }}</span><template v-else>{{ part.text }}</template></template></span>
          </div>
        </template>
        <Transition name="key">
          <kbd v-if="key" :key="key.id" class="key">{{ key.label }}</kbd>
        </Transition>
      </div>
      <div class="progress" role="presentation" @click="seek"><span :style="{ transform: `scaleX(${progress})` }"></span></div>
    </div>
    <figcaption>
      <span class="dot" :class="{ paused: !playing }"></span>
      <span>{{ caption }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
/* The palettes of `flows watch` (.harness/flows/src/watch/grid.ts), plus a terminal's own text and background */
.flows-watch {
  --tui-bg: #ffffff;
  --tui-text: #1f1f1f;
  --tui-muted: #8c8c8c;
  --tui-line: #e2e2e2;
  --tui-run: #0099cc;
  --tui-you: #985b9c;
  --tui-you-tint: #f6f0f6;
  --tui-raised: #fbfafb;
  --tui-selected: #efe7f0;
  --tui-chrome: #f3f2f4;
  container-type: inline-size;
  margin: 24px 0;
}
:root.dark .flows-watch {
  --tui-bg: #1b1a1d;
  --tui-text: #e6e6e6;
  --tui-muted: #8c8c8c;
  --tui-line: #3a3a3a;
  --tui-run: #40b3d9;
  --tui-you: #b284b5;
  --tui-you-tint: #2b2430;
  --tui-raised: #252427;
  --tui-selected: #332e37;
  --tui-chrome: #242326;
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
