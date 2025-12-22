import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";

// KaTeX 和 代码高亮样式
import "katex/dist/katex.min.css";
import "highlight.js/styles/github.css";

// 引入页面组件
import ProjectList from "./pages/ProjectList.vue";
import ProjectDetail from "./pages/ProjectDetail.vue";
import TaskDetail from "./pages/TaskDetail.vue";

// 配置路由
const routes = [
  { path: "/", component: ProjectList },
  { path: "/project/:projectName", component: ProjectDetail, props: true },
  {
    path: "/project/:projectName/task/:taskName",
    component: TaskDetail,
    props: true,
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

const app = createApp(App);
app.use(router);
app.mount("#app");
