import { createApp } from "vue";
import { createRouter, createWebHistory } from "vue-router";
import App from "./App.vue";

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
