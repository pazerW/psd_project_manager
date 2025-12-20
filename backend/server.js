const express = require("express");
const cors = require("cors");
const path = require("path");
const fs = require("fs-extra");

const projectRoutes = require("./routes/projects");
const taskRoutes = require("./routes/tasks");
const uploadRoutes = require("./routes/upload");
const psdRoutes = require("./routes/psd");
const fileRoutes = require("./routes/files");

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// 数据目录路径（将从Docker挂载或本地配置）
const DATA_PATH = process.env.DATA_PATH || path.join(__dirname, "../data");

// 确保数据目录存在
fs.ensureDirSync(DATA_PATH);

// 将数据路径传递给路由
app.use((req, res, next) => {
  req.dataPath = DATA_PATH;
  next();
});

// 路由
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/psd", psdRoutes); // 保留向后兼容
app.use("/api/files", fileRoutes); // 新的通用文件路由

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
