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

// 订阅后端的文件变化 SSE 流，页面在检测到 README.md 改动时会触发局部刷新
if (typeof window !== 'undefined' && window.EventSource) {
  try {
    const es = new EventSource('/api/changes/stream');

    es.addEventListener('readme', (e) => {
      try {
        const payload = JSON.parse(e.data);
        console.info('[SSE] readme event received:', payload);
        // 触发全局事件，组件可以选择监听并决定要刷新哪些数据
        window.dispatchEvent(new CustomEvent('dataChanged', { detail: payload }));
      } catch (err) {
        console.error('Failed to parse SSE readme event', err);
      }
    });

    es.onerror = (err) => {
      // 若连接失败，不阻塞应用；浏览器会自动尝试重连
      console.warn('SSE connection error:', err);
    };
  } catch (err) {
    console.warn('EventSource not available or connection failed', err);
  }
}
