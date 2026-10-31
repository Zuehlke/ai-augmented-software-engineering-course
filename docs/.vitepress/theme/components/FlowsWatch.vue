<script setup lang="ts">
// Labs 9 to 13: the page of `flows watch`, shot by shot. The screenshots are taken of the real page, fed scripted
// states (see flows-watch/record.mts), in a light and a dark version that follow the page's theme. A ring marks
// what to click next.
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useData } from "vitepress";
import scenes from "./flows-watch/scenes.json";

type Rect = [number, number, number, number]; // x, y, w, h in % of the screenshot
interface Shot {
  caption: string;
  click?: Rect;
  anchors?: Record<string, Rect>;
}

// A note points at a part of the last shot (`at`, one of its anchors, see ANCHORS in record.mts) and explains it.
// In its text, `code` is set as code and a line break starts a new line. With notes, the scene is a still of its last
// shot, and the notes show one after the other.
interface Note {
  at: string;
  label: string;
  text: string;
}

const props = defineProps<{ scene: string; title?: string; notes?: Note[] }>();

const images = import.meta.glob<string>("./flows-watch/*.webp", { eager: true, query: "?url", import: "default" });
const shots = computed<Shot[]>(() => (scenes as Record<string, Shot[]>)[props.scene] ?? []);

const { isDark } = useData();
const index = ref(0);
const playing = ref(false);
const expanded = ref(false);
const root = ref<HTMLElement>();
let timer: ReturnType<typeof setTimeout> | undefined;
let visible = false;
let observer: IntersectionObserver | undefined;

const SHOT_MS = 4500;
const NOTE_MS = 6000;

// What there is to step through: the notes, or else the shots
const steps = computed(() => props.notes?.length ?? shots.value.length);
const shotIndex = computed(() => (props.notes ? shots.value.length - 1 : index.value));
const shot = computed(() => shots.value[shotIndex.value]);
const note = computed(() => props.notes?.[index.value]);
const noteRect = computed(() => (note.value ? shot.value?.anchors?.[note.value.at] : undefined));
const src = (i: number) => images[`./flows-watch/${props.scene}-${i + 1}-${isDark.value ? "dark" : "light"}.webp`];
// A note's label goes under the part it points at, or over it when the part is low on the page
const notePlace = computed(() => {
  const r = noteRect.value;
  if (!r) return {};
  const left = Math.min(Math.max(r[0], 2), 58);
  return r[1] + r[3] > 70 ? { left: `${left}%`, bottom: `${100 - r[1] + 1.5}%` } : { left: `${left}%`, top: `${r[1] + r[3] + 1.5}%` };
});
const box = (r: Rect) => ({ left: `${r[0]}%`, top: `${r[1]}%`, width: `${r[2]}%`, height: `${r[3]}%` });
const ring = (r: Rect) => ({ left: `${r[0] + r[2] / 2}%`, top: `${r[1] + r[3] / 2}%` });
// A note's text in parts, every other one code
const parts = (text: string) => text.split("`").map((part, i) => ({ part, code: i % 2 === 1 }));

function schedule() {
  clearTimeout(timer);
  if (!playing.value || !visible || steps.value < 2) return;
  timer = setTimeout(() => {
    index.value = (index.value + 1) % steps.value;
    schedule();
  }, props.notes ? NOTE_MS : SHOT_MS);
}
function go(i: number) {
  index.value = (i + steps.value) % steps.value;
  schedule();
}
function toggle() {
  playing.value = !playing.value;
  schedule();
}
function onKeydown(event: KeyboardEvent) {
  if (event.key === "Escape" && expanded.value) expanded.value = false;
}
watch(expanded, (on) => document.documentElement.classList.toggle("flows-watch-expanded", on));
onMounted(() => {
  // With reduced motion, it starts paused
  playing.value = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  // The screenshots of both themes load early, so switching shots doesn't flicker
  for (let i = 0; i < shots.value.length; i++) new Image().src = src(i);
  observer = new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    schedule();
  });
  if (root.value) observer.observe(root.value);
  window.addEventListener("keydown", onKeydown);
});
onBeforeUnmount(() => {
  clearTimeout(timer);
  observer?.disconnect();
  window.removeEventListener("keydown", onKeydown);
  document.documentElement.classList.remove("flows-watch-expanded");
});
</script>

<template>
  <div v-if="expanded" class="backdrop" @click="expanded = false"></div>
  <figure v-if="shot" ref="root" class="flows-watch" :class="{ expanded }">
    <div class="window">
      <div class="bar">
        <span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="name">{{ title ?? "localhost:8234 — flows watch" }}</span>
        <span class="tools">
          <button type="button" aria-label="Back" title="Back" @click="go(index - 1)">
            <svg viewBox="0 0 16 16"><path d="M10 3L5 8l5 5" /></svg>
          </button>
          <button type="button" :aria-label="playing ? 'Pause' : 'Play'" :title="playing ? 'Pause' : 'Play'" @click="toggle">
            <svg v-if="playing" viewBox="0 0 16 16"><path d="M5 3v10M11 3v10" /></svg>
            <svg v-else viewBox="0 0 16 16"><path d="M5 3l8 5-8 5z" class="solid" /></svg>
          </button>
          <button type="button" aria-label="Next" title="Next" @click="go(index + 1)">
            <svg viewBox="0 0 16 16"><path d="M6 3l5 5-5 5" /></svg>
          </button>
          <button type="button" :aria-label="expanded ? 'Smaller' : 'Larger'" :title="expanded ? 'Smaller (Esc)' : 'Larger'" @click="expanded = !expanded">
            <svg v-if="expanded" viewBox="0 0 16 16"><path d="M6 2v4H2M10 14v-4h4M14 6h-4V2M2 10h4v4" /></svg>
            <svg v-else viewBox="0 0 16 16"><path d="M2 6V2h4M14 10v4h-4M10 2h4v4M6 14H2v-4" /></svg>
          </button>
        </span>
      </div>
      <div class="screen">
        <img :src="src(shotIndex)" :alt="note ? `flows watch: ${note.label}: ${note.text.replaceAll('`', '')}` : `flows watch: ${shot.caption}`" />
        <span v-if="!note && shot.click" :key="`${scene}-${index}`" class="ring" :style="ring(shot.click)"></span>
        <Transition name="note" mode="out-in">
          <div v-if="note && noteRect" :key="index" class="notes">
            <span class="note-box" :style="box(noteRect)"></span>
            <span class="note" :style="notePlace"><b>{{ note.label }}:</b> <template v-for="({ part, code }, i) in parts(note.text)" :key="i"><code v-if="code">{{ part }}</code><template v-else>{{ part }}</template></template></span>
          </div>
        </Transition>
      </div>
      <div v-if="steps > 1" class="progress">
        <button v-for="i in steps" :key="i" type="button" :class="{ on: i - 1 === index }" :aria-label="`Step ${i} of ${steps}`" @click="go(i - 1)"></button>
      </div>
    </div>
    <figcaption>
      <span v-if="steps > 1" class="count">{{ index + 1 }} / {{ steps }}</span>
      <span v-if="note">{{ note.label }}</span>
      <span v-else>{{ shot.caption }}</span>
    </figcaption>
  </figure>
</template>

<style scoped>
/* The window's colours are in zuhlke.css (--tui-*), shared with RalphDiagram */
.flows-watch {
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
.screen {
  position: relative;
  line-height: 0;
}
.screen img {
  display: block;
  width: 100%;
  height: auto;
}
/* What to click next */
.ring {
  position: absolute;
  width: 34px;
  height: 34px;
  margin: -17px 0 0 -17px;
  border: 3px solid var(--tui-you);
  border-radius: 50%;
  box-shadow: 0 0 0 4px color-mix(in srgb, var(--tui-you) 25%, transparent);
  pointer-events: none;
  animation: ring 1.6s ease-out 1;
}
@keyframes ring {
  0% {
    transform: scale(1.8);
    opacity: 0;
  }
  40% {
    transform: scale(1);
    opacity: 1;
  }
}
.notes {
  position: absolute;
  inset: 0;
  line-height: 1.45;
}
.note-box {
  position: absolute;
  border: 2px solid var(--tui-you);
  border-radius: 6px;
  box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.18);
}
.note {
  position: absolute;
  max-width: 40%;
  padding: 8px 12px;
  border-radius: 8px;
  background: var(--tui-you);
  color: #fff;
  font-size: 13px;
  white-space: pre-line;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.2);
}
.note code {
  background: rgba(255, 255, 255, 0.18);
  color: #fff;
  font-size: 12px;
}
.note-enter-active,
.note-leave-active {
  transition: opacity 0.25s;
}
.note-enter-from,
.note-leave-to {
  opacity: 0;
}
.progress {
  display: flex;
  gap: 4px;
  padding: 6px 10px;
  border-top: 1px solid var(--tui-line);
  background: var(--tui-chrome);
}
.progress button {
  flex: 1;
  height: 4px;
  border-radius: 2px;
  background: var(--tui-line);
}
.progress button.on {
  background: var(--tui-you);
}
figcaption {
  display: flex;
  gap: 10px;
  margin-top: 8px;
  font-size: 14px;
  color: var(--vp-c-text-2);
}
.count {
  color: var(--vp-c-text-3);
  font-variant-numeric: tabular-nums;
}
/* Larger: over the page, as wide as the window allows */
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 99;
  background: rgba(0, 0, 0, 0.6);
}
.flows-watch.expanded {
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 100;
  width: min(96vw, calc(92vh * 1360 / 780));
  margin: 0;
  transform: translate(-50%, -50%);
}
.flows-watch.expanded figcaption {
  color: #fff;
}
</style>
