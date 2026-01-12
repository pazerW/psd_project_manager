const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const matter = require("gray-matter");

const router = express.Router();

// 确保 README.md 存在的工具函数
async function ensureReadme(dirPath, name, type = "project") {
  const readmePath = path.join(dirPath, "README.md");

  if (!(await fs.pathExists(readmePath))) {
    const timestamp = new Date().toLocaleString("zh-CN", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });

    let content;
    if (type === "project") {
      content = `---
title: ${name}
created: ${timestamp}
status: active
allowedStatuses: ["pending", "in-progress", "review", "completed", "cancelled"]
allowedTags: ["初稿", "定稿", "客户审核", "最终版"]
---

# ${name}

## 项目信息

- 创建时间: ${timestamp}
- 状态: 进行中

## 项目描述

<!-- 在这里添加项目描述 -->

## 任务状态说明

本项目支持以下任务状态（在上方 allowedStatuses 中定义）：
- **pending**: 待处理
- **in-progress**: 进行中
- **review**: 审核中
- **completed**: 已完成
- **cancelled**: 已取消

## 文件标签说明

本项目支持以下文件标签（在上方 allowedTags 中定义）：
- **初稿**: 设计初稿
- **定稿**: 设计定稿
- **客户审核**: 提交客户审核的版本
- **最终版**: 最终确认版本

## 任务列表

<!-- 任务会自动列出 -->

## 备注

<!-- 其他备注信息 -->
`;
    } else {
      content = `---
title: ${name}
created: ${timestamp}
status: pending
---

# ${name}

## 任务信息

- 创建时间: ${timestamp}
- 状态: 待处理

## 设计文件说明

<!-- 上传文件后，在这里添加说明 -->

## 备注

<!-- 其他备注信息 -->
`;
    }

    await fs.writeFile(readmePath, content, "utf-8");
    console.log(`Created README.md for ${type}: ${name}`);
  }
}

// 获取所有项目列表
router.get("/", async (req, res) => {
  try {
    const dataPath = req.dataPath;
    const projects = [];

    const dirs = await fs.readdir(dataPath, { withFileTypes: true });

    for (const dir of dirs) {
      if (dir.isDirectory() && !dir.name.startsWith(".")) {
        const projectPath = path.join(dataPath, dir.name);
        const project = await analyzeProject(projectPath, dir.name);
        projects.push(project);
      }
    }

    res.json(projects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取全局状态配置
router.get("/config/statuses", async (req, res) => {
  try {
    const dataPath = req.dataPath;
    const readmePath = path.join(dataPath, "README.md");

    if (!(await fs.pathExists(readmePath))) {
      // 如果不存在，返回默认配置
      return res.json({
        projectStatuses: [
          { value: "active", label: "active" },
          { value: "pending", label: "pending" },
          { value: "in-progress", label: "in-progress" },
          { value: "review", label: "review" },
          { value: "completed", label: "completed" },
          { value: "cancelled", label: "cancelled" },
          { value: "paused", label: "paused" },
        ],
        statusOrder: [
          { value: "active", label: "active" },
          { value: "in-progress", label: "in-progress" },
          { value: "review", label: "review" },
          { value: "pending", label: "pending" },
          { value: "paused", label: "paused" },
          { value: "completed", label: "completed" },
          { value: "cancelled", label: "cancelled" },
        ],
      });
    }

    const content = await fs.readFile(readmePath, "utf8");
    const parsed = matter(content);

    res.json({
      projectStatuses: parsed.data.projectStatuses || [],
      statusOrder: parsed.data.statusOrder || [],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新全局状态配置
router.put("/config/statuses", async (req, res) => {
  try {
    const dataPath = req.dataPath;
    const readmePath = path.join(dataPath, "README.md");
    const { projectStatuses, statusOrder } = req.body;

    if (!Array.isArray(projectStatuses) || !Array.isArray(statusOrder)) {
      return res
        .status(400)
        .json({ error: "projectStatuses and statusOrder must be arrays" });
    }

    let content = "";
    let parsed;

    if (await fs.pathExists(readmePath)) {
      content = await fs.readFile(readmePath, "utf8");
      parsed = matter(content);
    } else {
      parsed = { content: "# 数据目录\n\n项目数据存储目录。", data: {} };
    }

    // 更新配置
    parsed.data.projectStatuses = projectStatuses;
    parsed.data.statusOrder = statusOrder;

    // 写回文件
    const updated = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(readmePath, updated, "utf8");

    res.json({ success: true, projectStatuses, statusOrder });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新项目的允许状态列表（必须在 /:projectName 之前）
router.put("/:projectName/allowed-statuses", async (req, res) => {
  try {
    const { projectName } = req.params;
    const { allowedStatuses } = req.body;

    if (!Array.isArray(allowedStatuses) || allowedStatuses.length === 0) {
      return res
        .status(400)
        .json({ error: "allowedStatuses must be a non-empty array" });
    }

    const projectPath = path.join(req.dataPath, projectName);
    const readmePath = path.join(projectPath, "README.md");

    if (!(await fs.pathExists(readmePath))) {
      return res.status(404).json({ error: "Project README not found" });
    }

    // 读取现有内容
    const content = await fs.readFile(readmePath, "utf8");
    const parsed = matter(content);

    // 更新 allowedStatuses
    parsed.data.allowedStatuses = allowedStatuses;

    // 写回文件
    const updated = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(readmePath, updated, "utf8");

    res.json({ success: true, allowedStatuses });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新项目状态
router.put("/:projectName/status", async (req, res) => {
  try {
    const { projectName } = req.params;
    const { status } = req.body;

    if (!status || typeof status !== "string") {
      return res
        .status(400)
        .json({ error: "status must be a non-empty string" });
    }

    const projectPath = path.join(req.dataPath, projectName);
    const readmePath = path.join(projectPath, "README.md");

    if (!(await fs.pathExists(readmePath))) {
      return res.status(404).json({ error: "Project README not found" });
    }

    // 读取现有内容
    const content = await fs.readFile(readmePath, "utf8");
    const parsed = matter(content);

    // 更新状态
    parsed.data.status = status;

    // 写回文件
    const updated = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(readmePath, updated, "utf8");

    res.json({ success: true, status });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新项目的允许标签列表
router.put("/:projectName/allowed-tags", async (req, res) => {
  try {
    const { projectName } = req.params;
    const { allowedTags } = req.body;

    if (!Array.isArray(allowedTags) || allowedTags.length === 0) {
      return res
        .status(400)
        .json({ error: "allowedTags must be a non-empty array" });
    }

    const projectPath = path.join(req.dataPath, projectName);
    const readmePath = path.join(projectPath, "README.md");

    if (!(await fs.pathExists(readmePath))) {
      return res.status(404).json({ error: "Project README not found" });
    }

    // 读取现有内容
    const content = await fs.readFile(readmePath, "utf8");
    const parsed = matter(content);

    // 更新 allowedTags
    parsed.data.allowedTags = allowedTags;

    // 写回文件
    const updated = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(readmePath, updated, "utf8");

    res.json({ success: true, allowedTags });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取单个项目详情
router.get("/:projectName", async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(req.dataPath, projectName);

    if (!(await fs.pathExists(projectPath))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const project = await analyzeProject(projectPath, projectName);

    res.json(project);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 分析项目结构的辅助函数
async function analyzeProject(projectPath, projectName) {
  const tasks = [];
  let totalPsdFiles = 0;
  let projectStatus = "active";
  let projectInfo = {}; // 移到函数顶部，确保在任何情况下都可用

  try {
    // 确保项目 README.md 存在
    await ensureReadme(projectPath, projectName, "project");

    const items = await fs.readdir(projectPath, { withFileTypes: true });

    // 检查是否有项目级别的README
    const projectReadme = path.join(projectPath, "README.md");
    if (await fs.pathExists(projectReadme)) {
      const content = await fs.readFile(projectReadme, "utf8");
      const parsed = matter(content);
      projectInfo = parsed.data;
      if (projectInfo.status) {
        projectStatus = projectInfo.status;
      }
    }

    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const taskPath = path.join(projectPath, item.name);
        const task = await analyzeTask(taskPath, item.name);
        tasks.push(task);
        totalPsdFiles += task.psdFiles || 0;
      }
    }
  } catch (error) {
    console.error(`Error analyzing project ${projectName}:`, error);
  }

  // 尝试获取项目 README 的 mtime 作为 lastUpdated 后备
  let projectMtime = null;
  try {
    const projectReadme = path.join(projectPath, "README.md");
    if (await fs.pathExists(projectReadme)) {
      const st = await fs.stat(projectReadme);
      projectMtime = st.mtimeMs;
    }
  } catch (err) {
    // ignore
  }

  return {
    name: projectName,
    path: projectPath,
    status: projectStatus,
    taskCount: tasks.length,
    totalPsdFiles,
    tasks,
    lastUpdated: (projectInfo && projectInfo.updatedAt) || projectMtime,
    ...projectInfo,
  };
}

// 分析任务的辅助函数
async function analyzeTask(taskPath, taskName) {
  let psdFiles = 0;
  let status = "pending";
  let taskInfo = {};

  try {
    // 确保任务 README.md 存在
    await ensureReadme(taskPath, taskName, "task");

    // 检查README.md
    const readmePath = path.join(taskPath, "README.md");
    if (await fs.pathExists(readmePath)) {
      const content = await fs.readFile(readmePath, "utf8");
      const parsed = matter(content);
      taskInfo = parsed.data;
      if (taskInfo.status) {
        status = taskInfo.status;
      }
    }

    // 计算任务中存在的设计文件数量（包括 PSD/AI/图片 等常见格式）
    // 同时计算所有文件总数（包括隐藏文件和MD文件，但不包括README.md和目录）
    const files = await fs.readdir(taskPath);
    const validExtensions = [
      ".psd",
      ".ai",
      ".sketch",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
      ".tiff",
      ".tif",
      ".pdf",
      ".doc",
      ".docx",
      ".xls",
      ".xlsx",
      ".txt",
      ".zip",
      ".rar",
      ".7z",
    ];
    
    let designFileCount = 0;
    let totalFileCount = 0;
    
    for (const file of files) {
      // 跳过所有.md文件（包括README.md）
      if (file.toLowerCase().endsWith(".md")) {
        continue;
      }
      
      // 跳过以点开头的隐藏文件（在计数时）
      if (file.startsWith(".")) {
        continue;
      }
      
      const filePath = path.join(taskPath, file);
      const stats = await fs.stat(filePath);
      
      // 跳过目录
      if (stats.isDirectory()) {
        continue;
      }
      
      // 计算总文件数（包括所有文件）
      totalFileCount++;
      
      // 计算设计文件数（只包含特定扩展名）
      const ext = path.extname(file).toLowerCase();
      if (validExtensions.includes(ext)) {
        designFileCount++;
      }
    }
    
    psdFiles = designFileCount;

  } catch (error) {
    console.error(`Error analyzing task ${taskName}:`, error);
  }

  return {
    name: taskName,
    path: taskPath,
    status,
    // 保持向后兼容：psdFiles 继续表示设计文件总数（以前为 PSD 数量，现在扩展为所有设计格式）
    psdFiles,
    fileCount: psdFiles,
    ...taskInfo,
  };
}

module.exports = router;
