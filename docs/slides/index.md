<script setup>
import { useData } from "vitepress";
const { theme } = useData();
</script>

# Slides

You can download the course slides here for reference and offline access.

<div style="display: flex; flex-wrap: wrap; gap: 12px">
<DownloadLink day="day1" v-if="theme.accessControl.day1LabsEnabled" href="/assets/ai-augmented-software-engineering-slides-day-1.pdf" label="Download Day 1 Slides (PDF)" />
</div>
