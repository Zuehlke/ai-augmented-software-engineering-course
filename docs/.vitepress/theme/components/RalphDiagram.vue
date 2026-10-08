<script setup lang="ts">
// Lab 10: the agent does one step, the judge checks it, and the loop goes on or fixes the step.
const outcomes = [
  { mark: "✓", text: "OK: the next run does the next step. When the ticket is done, the loop stops." },
  { mark: "↺", text: "Problem: the next run gets the judge's feedback and fixes it first." },
];
</script>

<template>
  <figure class="ralph-diagram">
    <div class="stack">
      <div class="card agent">
        <span class="label">agent</span>
        <strong>Does one small step</strong>
        <p>Starts with a fresh context, works on the ticket, commits.</p>
      </div>
      <div class="down" aria-hidden="true">↓</div>
      <div class="card judge">
        <span class="label">judge</span>
        <strong>Tests, then a review</strong>
        <p>The tests must pass. Then a read-only agent checks the commit against a checklist.</p>
      </div>
    </div>
    <ul class="outcomes">
      <li v-for="o in outcomes" :key="o.mark">
        <span class="mark">{{ o.mark }}</span>
        <span>{{ o.text }}</span>
      </li>
    </ul>
  </figure>
</template>

<style scoped>
.ralph-diagram {
  display: flex;
  align-items: center;
  gap: 16px;
  margin: 24px 0;
  padding: 20px;
  border-radius: 12px;
  background: var(--vp-c-bg-soft);
}
.stack {
  flex: 0 0 46%;
}
.card {
  padding: 14px 16px;
  border-radius: 10px;
}
.card strong {
  display: block;
  font-size: 16px;
  line-height: 1.3;
}
.card p {
  margin: 4px 0 0;
  font-size: 13px;
  line-height: 1.45;
}
.label {
  font-size: 12px;
}
.agent {
  background: var(--vp-c-brand-soft);
}
.agent .label {
  color: var(--vp-c-brand-1);
}
.agent p {
  color: var(--vp-c-text-2);
}
.judge {
  background: var(--z-purple);
  color: #fff;
}
.judge .label {
  color: #f0dcf1;
}
.judge p {
  color: rgba(255, 255, 255, 0.88);
}
.down {
  margin: 4px 0;
  color: var(--vp-c-text-3);
  font-size: 18px;
  text-align: center;
}
.outcomes {
  flex: 1;
  list-style: none;
  margin: 0;
  padding: 0;
  font-size: 14px;
  line-height: 1.45;
  color: var(--vp-c-text-1);
}
.outcomes li {
  display: flex;
  gap: 10px;
  margin: 12px 0;
}
.mark {
  flex: 0 0 auto;
  color: var(--vp-c-brand-1);
  font-weight: 700;
}
@media (max-width: 640px) {
  .ralph-diagram {
    flex-direction: column;
    align-items: stretch;
  }
}
</style>
