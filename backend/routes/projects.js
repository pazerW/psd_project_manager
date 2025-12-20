const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const matter = require("gray-matter");

const router = express.Router();

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

  return {
    name: projectName,
    path: projectPath,
    status: projectStatus,
    taskCount: tasks.length,
    totalPsdFiles,
    tasks,
    ...projectInfo,
  };
}

// 分析任务的辅助函数
async function analyzeTask(taskPath, taskName) {
  let psdFiles = 0;
  let status = "pending";
  let taskInfo = {};

  try {
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

    // 计算PSD文件数量
    const files = await fs.readdir(taskPath);
    psdFiles = files.filter(
      (file) => path.extname(file).toLowerCase() === ".psd"
    ).length;
  } catch (error) {
    console.error(`Error analyzing task ${taskName}:`, error);
  }

  return {
    name: taskName,
    path: taskPath,
    status,
    psdFiles,
    ...taskInfo,
  };
}

module.exports = router;
