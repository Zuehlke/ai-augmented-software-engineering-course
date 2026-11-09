import DefaultTheme from "vitepress/theme";
import "./zuhlke.css";
import ContentTabs from "./components/ContentTabs.vue";
import CourseAccessOverlay from "./components/CourseAccessOverlay.vue";
import DownloadLink from "./components/DownloadLink.vue";
import OnlyOn from "./components/OnlyOn.vue";
// TEMPORARY FIX for false 404s after the GitLab Pages session expires — see session-reload.ts.
import { reloadOnExpiredSession } from "./session-reload";

// Zühlke-branded theme with custom components.
export default {
  extends: DefaultTheme,
  Layout: CourseAccessOverlay,
  enhanceApp({ app, router }) {
    reloadOnExpiredSession(router); // TEMPORARY FIX, see session-reload.ts
    app.component("ContentTabs", ContentTabs);
    app.component("DownloadLink", DownloadLink);
    app.component("OnlyOn", OnlyOn);
  },
};
