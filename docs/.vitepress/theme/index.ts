import DefaultTheme from "vitepress/theme";
import "./zuhlke.css";
import ContentTabs from "./components/ContentTabs.vue";
import CourseAccessOverlay from "./components/CourseAccessOverlay.vue";
import DownloadLink from "./components/DownloadLink.vue";
import RalphDiagram from "./components/RalphDiagram.vue";
import FlowsWatch from "./components/FlowsWatch.vue";
import OnlyOn from "./components/OnlyOn.vue";

// Zühlke-branded theme with custom components.
export default {
  extends: DefaultTheme,
  Layout: CourseAccessOverlay,
  enhanceApp({ app }) {
    app.component("ContentTabs", ContentTabs);
    app.component("DownloadLink", DownloadLink);
    app.component("RalphDiagram", RalphDiagram);
    app.component("FlowsWatch", FlowsWatch);
    app.component("OnlyOn", OnlyOn);
  },
};
