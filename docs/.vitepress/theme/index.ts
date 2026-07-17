import DefaultTheme from "vitepress/theme";
import "./zuhlke.css";
import ContentTabs from "./components/ContentTabs.vue";
import CourseAccessOverlay from "./components/CourseAccessOverlay.vue";

// Zühlke-branded theme with custom components.
export default {
  extends: DefaultTheme,
  Layout: CourseAccessOverlay,
  enhanceApp({ app }) {
    app.component("ContentTabs", ContentTabs);
  },
};
