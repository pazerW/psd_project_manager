const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const matter = require("gray-matter");
const {
  ensureReadme,
  updateFileDescription,
  updateFileTags,
  removeFileDescription,
} = require("../utils/readme");

const router = express.Router();

// 任务状态更新互斥锁映射
const taskUpdateLocks = new Map();

// 获取任务更新锁
function getTaskLock(projectName, taskName) {
  const key = `${projectName}:${taskName}`;
  if (!taskUpdateLocks.has(key)) {
    taskUpdateLocks.set(key, Promise.resolve());
  }
  return key;
}

// 获取特定项目的所有任务
router.get("/:projectName", async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(req.dataPath, projectName);

    if (!(await fs.pathExists(projectPath))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const tasks = [];
    const items = await fs.readdir(projectPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const taskPath = path.join(projectPath, item.name);
        // 确保任务 README.md 存在
        await ensureReadme(taskPath, item.name, "task");
        const task = await analyzeTaskDetails(taskPath, item.name, projectName);
        tasks.push(task);
      }
    }

    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取特定任务的详情
router.get("/:projectName/:taskName", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    const taskPath = path.join(req.dataPath, projectName, taskName);

    if (!(await fs.pathExists(taskPath))) {
      return res.status(404).json({ error: "Task not found" });
    }

    // 确保任务 README.md 存在
    await ensureReadme(taskPath, taskName, "task");
    const task = await analyzeTaskDetails(taskPath, taskName, projectName);

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取任务的设计文件列表
router.get("/:projectName/:taskName/files", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    const taskPath = path.join(req.dataPath, projectName, taskName);

    if (!(await fs.pathExists(taskPath))) {
      return res.status(404).json({ error: "Task not found" });
    }

    // 读取README获取标签信息
    let fileTags = {};
    const readmePath = path.join(taskPath, "README.md");
    if (await fs.pathExists(readmePath)) {
      const content = await fs.readFile(readmePath, "utf8");
      const parsed = matter(content);
      fileTags = parsed.data.fileTags || {};
    }

    const files = await fs.readdir(taskPath);
    const designFiles = [];
    const validExtensions = [
      ".psd",
      ".ai",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
      ".tiff",
      ".tif",
    ];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (validExtensions.includes(ext)) {
        const filePath = path.join(taskPath, file);
        const stats = await fs.stat(filePath);

        designFiles.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          type: getFileType(ext),
          downloadUrl: `/api/files/download/${projectName}/${taskName}/${file}`,
          thumbnailUrl: `/api/files/thumbnail/${projectName}/${taskName}/${file}`,
          tags: fileTags[file] || "", // 添加标签
        });
      }
    }

    res.json(designFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新文件描述
router.put(
  "/:projectName/:taskName/files/:fileName/description",
  async (req, res) => {
    try {
      const { projectName, taskName, fileName } = req.params;
      const { description } = req.body;

      await updateFileDescription(
        req.dataPath,
        projectName,
        taskName,
        fileName,
        description
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// 更新文件标签
router.put("/:projectName/:taskName/files/:fileName/tags", async (req, res) => {
  try {
    const { projectName, taskName, fileName } = req.params;
    const { tags } = req.body;

    await updateFileTags(req.dataPath, projectName, taskName, fileName, tags);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新PSD文件描述（保留向后兼容）
router.put(
  "/:projectName/:taskName/psd/:fileName/description",
  async (req, res) => {
    try {
      const { projectName, taskName, fileName } = req.params;
      const { description } = req.body;

      await updateFileDescription(
        req.dataPath,
        projectName,
        taskName,
        fileName,
        description
      );

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// 更新任务的README.md
router.put("/:projectName/:taskName/readme", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    const { content, frontmatter } = req.body;

    const taskPath = path.join(req.dataPath, projectName, taskName);
    const readmePath = path.join(taskPath, "README.md");

    if (!(await fs.pathExists(taskPath))) {
      return res.status(404).json({ error: "Task not found" });
    }

    // 组合frontmatter和content
    const fullContent = matter.stringify(content || "", frontmatter || {});

    await fs.writeFile(readmePath, fullContent);

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 更新任务状态
router.put("/:projectName/:taskName/status", async (req, res) => {
  const { projectName, taskName } = req.params;
  let { status } = req.body;

  if (status === undefined || status === null) {
    return res.status(400).json({ error: "Status is required" });
  }

  status = String(status).trim();
  const lockKey = getTaskLock(projectName, taskName);
  const requestId = Date.now().toString();

  console.log(
    `[Status Update Start] ${projectName}/${taskName} -> ${status} [${requestId}]`
  );

  try {
    // 使用任务级别的互斥锁，确保返回结果
    const result = await (taskUpdateLocks.set(
      lockKey,
      taskUpdateLocks.get(lockKey).then(async () => {
        try {
          const taskPath = path.join(req.dataPath, projectName, taskName);
          const readmePath = path.join(taskPath, "README.md");

          if (!(await fs.pathExists(taskPath))) {
            throw new Error("Task not found");
          }

          // 读取现有README
          let content = "";
          let frontmatter = {};

          if (await fs.pathExists(readmePath)) {
            const fileContent = await fs.readFile(readmePath, "utf8");
            const parsed = matter(fileContent);
            content = parsed.content;
            frontmatter = parsed.data;
          }

          // 更新status字段并设置更新时间
          const oldStatus = frontmatter.status;
          frontmatter.status = status;
          frontmatter.updatedAt = Date.now();

          // 写入文件（原子替换：先写入临时文件，再重命名）
          const fullContent = matter.stringify(content, frontmatter);
          const tmpPath = `${readmePath}.tmp.${Date.now()}.${Math.floor(Math.random() * 100000)}`;
          await fs.writeFile(tmpPath, fullContent, "utf8");

          // 尝试 fsync 确保已写入磁盘（若可用）再重命名
          try {
            // 使用 fs.promises.open 获取 FileHandle（含 sync/close 方法）
            const handle = await fs.promises.open(tmpPath, 'r+');
            try {
              await handle.sync();
            } finally {
              await handle.close();
            }
          } catch (err) {
            // 如果 fsync 不可用或失败，记录但继续（rename 仍能保证原子替换）
            console.warn(`[Status Update] fsync failed for ${tmpPath}: ${err.message}`);
          }

          await fs.rename(tmpPath, readmePath);

          // 验证写入结果：重试几次，等待短暂时间，适应并发写入场景
          let actualStatus = null;
          let attempts = 0;
          while (attempts < 5) {
            const verifyContent = await fs.readFile(readmePath, "utf8");
            const verifyParsed = matter(verifyContent);
            actualStatus = verifyParsed.data.status;
            if (actualStatus === status) break;
            attempts++;
            await new Promise((resolve) => setTimeout(resolve, 20));
          }

          if (actualStatus !== status) {
            console.error(
              `[Status Update Error] ${projectName}/${taskName} 验证失败 [${requestId}]: 期望=${status}, 实际=${actualStatus}`
            );
            throw new Error(
              `Status verification failed: expected ${status}, got ${actualStatus}`
            );
          }

          console.log(
            `[Status Update Success] ${projectName}/${taskName}: ${oldStatus} -> ${status} [${requestId}]`
          );
          return { success: true, status, oldStatus, lastUpdated: frontmatter.updatedAt };
        } catch (error) {
          console.error(
            `[Status Update Error] ${projectName}/${taskName} [${requestId}]: ${error.message}`
          );
          throw error;
        }
      })
    ),
    taskUpdateLocks.get(lockKey));

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取项目中所有已使用的状态
router.get("/:projectName/statuses/list", async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(req.dataPath, projectName);

    if (!(await fs.pathExists(projectPath))) {
      return res.status(404).json({ error: "Project not found" });
    }

    let allowedStatuses = [];

    // 首先尝试从项目 README 中读取定义的状态列表
    const projectReadmePath = path.join(projectPath, "README.md");
    if (await fs.pathExists(projectReadmePath)) {
      const content = await fs.readFile(projectReadmePath, "utf8");
      const parsed = matter(content);

      // 如果项目 README 中定义了 allowedStatuses，则使用它作为基础
      if (
        parsed.data.allowedStatuses &&
        Array.isArray(parsed.data.allowedStatuses)
      ) {
        allowedStatuses = [...parsed.data.allowedStatuses];
      }
    }

    // 收集所有任务中实际使用的状态
    const statusSet = new Set(allowedStatuses);
    const items = await fs.readdir(projectPath, { withFileTypes: true });

    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const taskPath = path.join(projectPath, item.name);
        const readmePath = path.join(taskPath, "README.md");

        if (await fs.pathExists(readmePath)) {
          const content = await fs.readFile(readmePath, "utf8");
          const parsed = matter(content);

          if (parsed.data.status) {
            statusSet.add(parsed.data.status);
          }
        }
      }
    }

    // 返回合并后的状态列表（保持配置的状态在前，实际使用的状态在后）
    const result = [...new Set([...allowedStatuses, ...Array.from(statusSet)])];
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 分析任务详情的辅助函数（不使用缓存）
async function analyzeTaskDetails(taskPath, taskName, projectName) {
  let readmeContent = "";
  let frontmatter = {};
  let psdFiles = [];

  try {
    // 读取README.md
    const readmePath = path.join(taskPath, "README.md");
    if (await fs.pathExists(readmePath)) {
      const content = await fs.readFile(readmePath, "utf8");
      const parsed = matter(content);
      readmeContent = parsed.content;
      frontmatter = parsed.data;
    }

    // 获取设计文件信息
    const files = await fs.readdir(taskPath);
    const psdDescriptions = getPsdDescriptionsFromReadme(readmeContent);
    const fileTags = frontmatter.fileTags || {}; // 从frontmatter获取标签
    const validExtensions = [
      ".psd",
      ".ai",
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
      ".tiff",
      ".tif",
    ];

    for (const file of files) {
      const ext = path.extname(file).toLowerCase();
      if (validExtensions.includes(ext)) {
        const filePath = path.join(taskPath, file);
        const stats = await fs.stat(filePath);

        psdFiles.push({
          name: file,
          size: stats.size,
          modified: stats.mtime,
          type: getFileType(ext),
          downloadUrl: `/api/files/download/${projectName}/${taskName}/${file}`,
          thumbnailUrl: `/api/files/thumbnail/${projectName}/${taskName}/${file}`,
          description: psdDescriptions[file] || "",
          tags: fileTags[file] || "", // 添加标签
        });
      }
    }
  } catch (error) {
    console.error(`Error analyzing task details ${taskName}:`, error);
  }

  // 尝试获取 README 的 mtime 作为最后更新时间的后备
  let lastUpdated = null;
  try {
    const readmePath = path.join(taskPath, 'README.md');
    if (await fs.pathExists(readmePath)) {
      const st = await fs.stat(readmePath);
      lastUpdated = st.mtimeMs;
    }
  } catch (err) {
    // ignore
  }

  const result = {
    name: taskName,
    path: taskPath,
    readmeContent,
    frontmatter,
    psdFiles,
    psdCount: psdFiles.length,
    lastUpdated: (frontmatter && frontmatter.updatedAt) || lastUpdated,
  };
  return result;
}

// 从README内容中提取PSD文件描述
function getPsdDescriptionsFromReadme(readmeContent) {
  const descriptions = {};
  const lines = readmeContent.split("\n");
  let inPsdSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (
      line === "## PSD文件说明" ||
      line === "## PSD Files" ||
      line === "## 设计文件说明" ||
      line === "## Design Files"
    ) {
      inPsdSection = true;
      continue;
    }

    if (inPsdSection && line.startsWith("##")) {
      break; // 遇到其他二级标题，结束PSD部分
    }

    if (inPsdSection && line.startsWith("- **")) {
      const match = line.match(
        /- \*\*(.+\.(psd|ai|jpg|jpeg|png|gif|bmp|webp|svg|tiff|tif))\*\*[：:] (.+)/
      );
      if (match) {
        descriptions[match[1]] = match[3];
      }
    }
  }

  return descriptions;
}

// 获取文件类型
function getFileType(ext) {
  if (ext === ".psd") return "psd";
  if (ext === ".ai") return "ai";
  if (
    [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".tiff",
      ".tif",
    ].includes(ext)
  )
    return "image";
  if (ext === ".svg") return "svg";
  return "other";
}

module.exports = router;
