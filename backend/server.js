const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");
const { createProxyMiddleware } = require("http-proxy-middleware");

const projectRoutes = require("./routes/projects");
const taskRoutes = require("./routes/tasks");
const uploadRoutes = require("./routes/upload");
const psdRoutes = require("./routes/psd");
const fileRoutes = require("./routes/files");
const downloadRoutes = require("./routes/download");
const aiProxyRoutes = require("./routes/ai-proxy");

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件：允许带凭证的跨域请求，前端 fetch 时使用 credentials: 'include'
app.use(
  cors({
    origin: true,
    credentials: true,
  })
);
// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 允许前端读取下载响应中的 Content-Disposition 等标题
app.use((req, res, next) => {
  const existing = res.getHeader("Access-Control-Expose-Headers") || "";
  const expose = String(existing);
  const headersToExpose = ["Content-Disposition", "Content-Length"];
  const merged = headersToExpose.reduce((acc, h) => {
    if (!acc.includes(h)) return acc ? `${acc}, ${h}` : h;
    return acc;
  }, expose);
  if (merged) res.setHeader("Access-Control-Expose-Headers", merged);
  next();
});

// 数据目录路径（将从Docker挂载或本地配置）
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, "../data");

// 确保数据目录存在
fs.ensureDirSync(DATA_PATH);

// 将数据路径传递给路由
app.use((req, res, next) => {
  req.dataPath = DATA_PATH;
  next();
});

// API 不应被浏览器或中间代理缓存：强制 no-store
app.use("/api", (req, res, next) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate, proxy-revalidate"
  );
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

// 路由
app.use("/api/projects", projectRoutes);

// 代理外部API - 必须在 /api/tasks 之前
app.get(
  "/api/tasks/active",
  createProxyMiddleware({
    target: "http://192.168.3.150:3001",
    changeOrigin: true,
    logLevel: "debug",
  })
);

// 代理外部最近任务列表
app.get(
  "/api/tasks/recent",
  createProxyMiddleware({
    target: "http://192.168.3.150:3001",
    changeOrigin: true,
    logLevel: "debug",
  })
);

app.use("/api/tasks", taskRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/psd", psdRoutes); // 保留向后兼容
app.use("/api/ai", aiProxyRoutes); // AI API 代理

// 文件变化通知（SSE）
const changesRoutes = require("./routes/changes")(DATA_PATH);
app.use("/api/changes", changesRoutes);
app.use("/api/files", fileRoutes); // 新的通用文件路由
app.use("/api/download", downloadRoutes); // 下载路由

// 静态文件服务（用于提供生成的缩略图）
app.use("/thumbnails", express.static(path.join(DATA_PATH, ".thumbnails")));

// 健康检查
app.get("/health", (req, res) => {
  res.json({ status: "OK", dataPath: DATA_PATH });
});

// 提供前端构建产物（生产环境）
const FRONTEND_DIST = path.join(__dirname, "../frontend/dist");
if (fs.existsSync(FRONTEND_DIST)) {
  app.use(express.static(FRONTEND_DIST));

  // SPA 路由支持 - 所有非 API 请求返回 index.html
  app.get("*", (req, res) => {
    if (
      !req.path.startsWith("/api") &&
      !req.path.startsWith("/thumbnails") &&
      req.path !== "/health"
    ) {
      res.sendFile(path.join(FRONTEND_DIST, "index.html"));
    }
  });
}

app.listen(PORT, () => {
  console.log(`PSD Project Manager Backend running on port ${PORT}`);
  console.log(`Data directory: ${DATA_PATH}`);

  console.log(`Version: ${process.env.VERSION}`);

  const frontendEnabled = fs.existsSync(
    path.join(__dirname, "../frontend/dist")
  );
  console.log(
    `Frontend: ${
      frontendEnabled
        ? "Enabled (serving from /frontend/dist)"
        : "Disabled (build frontend first)"
    }`
  );
});
