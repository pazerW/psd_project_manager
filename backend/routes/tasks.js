const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const matter = require("gray-matter");
const axios = require("axios");
const {
  ensureReadme,
  updateFileDescription,
  updateFileTags,
  removeFileDescription,
} = require("../utils/readme");

const router = express.Router();

// 获取任务级递增文件编号并持久化到 README.md 的 frontmatter.lastId
async function getNextFileId(taskPath) {
  const readmePath = path.join(taskPath, "README.md");
  try {
    await fs.ensureDir(taskPath);
    const matter = require("gray-matter");

    let content = "";
    let front = {};

    if (await fs.pathExists(readmePath)) {
      const fileContent = await fs.readFile(readmePath, "utf8");
      const parsed = matter(fileContent);
      content = parsed.content || "";
      front = parsed.data || {};
    }

    // 兼容已有项目：计算已存在的最大编号，初始值为9以便首次分配为10
    let maxExisting = 9;

    if (front.fileIds && typeof front.fileIds === "object") {
      for (const v of Object.values(front.fileIds)) {
        const n = parseInt(v, 10);
        if (!isNaN(n) && n > maxExisting) maxExisting = n;
      }
    }

    try {
      const files = await fs.readdir(taskPath);
      for (const f of files) {
        if (f === "README.md") continue;
        const m = f.match(/_(\d+)(?:\.[^.]+)?$/);
        if (m) {
          const n = parseInt(m[1], 10);
          if (!isNaN(n) && n > maxExisting) maxExisting = n;
        }
      }
    } catch (e) {
      // ignore
    }

    if (typeof front.lastId !== "number" || front.lastId < maxExisting) {
      front.lastId = maxExisting;
    }

    front.lastId = (front.lastId || 0) + 1;
    const newContent = matter.stringify(content, front);
    await fs.writeFile(readmePath, newContent, "utf8");

    return front.lastId;
  } catch (err) {
    console.error("getNextFileId 错误:", err.message);
    throw err;
  }
}

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
          downloadUrl: `/api/files/download/${projectName}/${taskName}/${encodeURIComponent(
            file
          )}`,
          thumbnailUrl: `/api/files/thumbnail/${projectName}/${taskName}/${encodeURIComponent(
            file
          )}`,
          tags: fileTags[file] || "", // 添加标签
        });
      }
    }

    res.json(designFiles);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 设置任务的默认文件（将 frontmatter.defaultFile 更新为指定文件名）
router.post("/:projectName/:taskName/default-file", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    const { fileName } = req.body || {};

    if (!fileName)
      return res.status(400).json({ error: "fileName is required" });

    const taskPath = path.join(req.dataPath, projectName, taskName);
    const readmePath = path.join(taskPath, "README.md");

    if (!(await fs.pathExists(taskPath))) {
      return res.status(404).json({ error: "Task not found" });
    }

    // 验证文件存在
    const filePath = path.join(taskPath, fileName);
    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: "File not found" });
    }

    await fs.ensureFile(readmePath);
    const content = await fs.readFile(readmePath, "utf8");
    const parsed = matter(content);
    const front = parsed.data || {};

    front.defaultFile = fileName;
    front.updatedAt = Date.now();

    const updated = matter.stringify(parsed.content || "", front);
    await fs.writeFile(readmePath, updated, "utf8");

    // 返回更新后的 frontmatter
    res.json({ success: true, defaultFile: front.defaultFile });
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
          const tmpPath = `${readmePath}.tmp.${Date.now()}.${Math.floor(
            Math.random() * 100000
          )}`;
          await fs.writeFile(tmpPath, fullContent, "utf8");

          // 尝试 fsync 确保已写入磁盘（若可用）再重命名
          try {
            // 使用 fs.promises.open 获取 FileHandle（含 sync/close 方法）
            const handle = await fs.promises.open(tmpPath, "r+");
            try {
              await handle.sync();
            } finally {
              await handle.close();
            }
          } catch (err) {
            // 如果 fsync 不可用或失败，记录但继续（rename 仍能保证原子替换）
            console.warn(
              `[Status Update] fsync failed for ${tmpPath}: ${err.message}`
            );
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
          return {
            success: true,
            status,
            oldStatus,
            lastUpdated: frontmatter.updatedAt,
          };
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

// 从远程 URL 下载图片并保存到任务目录
router.post("/:projectName/:taskName/save-image", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    const { url, filename } = req.body || {};

    if (!url) return res.status(400).json({ error: "url is required" });
    // 仅允许 http/https
    if (!/^https?:\/\//i.test(url))
      return res
        .status(400)
        .json({ error: "Only http/https URLs are allowed" });

    const taskPath = path.join(req.dataPath, projectName, taskName);
    if (!(await fs.pathExists(taskPath)))
      return res.status(404).json({ error: "Task not found" });

    // 推断文件名
    let saveName =
      filename && String(filename).trim() ? String(filename).trim() : null;
    if (!saveName) {
      try {
        const parsed = new URL(url);
        saveName = path.basename(parsed.pathname) || `image-${Date.now()}.png`;
      } catch (e) {
        saveName = `image-${Date.now()}.png`;
      }
    }

    // 防止路径穿越
    if (
      saveName.includes("..") ||
      saveName.includes("/") ||
      saveName.includes("\\")
    ) {
      return res.status(400).json({ error: "Invalid filename" });
    }

    // 使用任务级递增 ID 生成文件名，保持与上传/合并时相同规则
    const fileExt = path.extname(saveName) || ".png";
    // 目标目录
    const targetDir = taskPath;
    await fs.ensureDir(targetDir);

    // 获取递增文件编号并生成新文件名
    const fileId = await getNextFileId(targetDir);
    const newFileName = `${projectName}_${taskName}_${fileId}${fileExt}`;
    const destPath = path.join(targetDir, newFileName);

    // 下载流并写入文件
    const response = await axios.get(url, {
      responseType: "stream",
      timeout: 20000,
    });
    const writer = fs.createWriteStream(destPath);
    await new Promise((resolve, reject) => {
      response.data.pipe(writer);
      let errored = false;
      writer.on("error", (err) => {
        errored = true;
        reject(err);
      });
      writer.on("close", () => {
        if (!errored) resolve();
      });
    });

    // 将编号写入 README frontmatter 的 fileIds
    try {
      await saveFileIdToReadme(
        req.dataPath,
        projectName,
        taskName,
        newFileName,
        fileId
      );
    } catch (e) {
      console.error("保存文件编号到 README 失败:", e.message);
    }

    // 异步预生成缩略图
    setImmediate(() => {
      try {
        pregen缩略图(req.dataPath, projectName, taskName, newFileName).catch(
          (err) => console.error("预生成缩略图失败:", err.message)
        );
      } catch (e) {
        console.error("启动缩略图任务失败:", e.message);
      }
    });

    // 返回保存后的信息和下载链接
    const downloadUrl = `/api/files/download/${projectName}/${taskName}/${encodeURIComponent(
      newFileName
    )}`;
    res.json({ success: true, filename: newFileName, downloadUrl });
  } catch (error) {
    console.error("save-image error:", error);
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
          downloadUrl: `/api/files/download/${projectName}/${taskName}/${encodeURIComponent(
            file
          )}`,
          thumbnailUrl: `/api/files/thumbnail/${projectName}/${taskName}/${encodeURIComponent(
            file
          )}`,
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
    const readmePath = path.join(taskPath, "README.md");
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

// 添加留言到任务README
router.post("/:projectName/:taskName/comment", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    const { title, content } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: "标题和内容不能为空" });
    }

    const taskPath = path.join(req.dataPath, projectName, taskName);
    const readmePath = path.join(taskPath, "README.md");

    if (!(await fs.pathExists(readmePath))) {
      return res.status(404).json({ error: "任务README文件不存在" });
    }

    // 读取现有内容
    let existingContent = await fs.readFile(readmePath, "utf8");

    // 构建留言内容：### {标题}\n\n{内容}\n\n
    const commentSection = `\n\n### ${title}\n\n${content}\n`;

    // 追加到文件末尾
    const newContent = existingContent + commentSection;

    // 写入文件
    await fs.writeFile(readmePath, newContent, "utf8");

    // 广播数据变更事件
    if (req.app && req.app.locals && req.app.locals.broadcastDataChange) {
      req.app.locals.broadcastDataChange(
        `${projectName}/${taskName}/README.md`
      );
    }

    res.json({ success: true, message: "留言添加成功" });
  } catch (error) {
    console.error("添加留言失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 保存AI任务日志
router.post("/:projectName/:taskName/ai-log", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    const logData = req.body;

    const taskPath = path.join(req.dataPath, projectName, taskName);
    const logPath = path.join(taskPath, "task_log.md");

    // 确保任务目录存在
    if (!(await fs.pathExists(taskPath))) {
      return res.status(404).json({ error: "任务目录不存在" });
    }

    // 构建日志条目
    const timestamp =
      logData.time ||
      new Date().toISOString().replace("T", " ").substring(0, 16);
    let logEntry = `\n### ${timestamp}\n\n`;
    logEntry += `**job_id**: ${logData.job_id}\n\n`;
    logEntry += `**template_id**: ${logData.template_id}\n\n`;
    logEntry += `**template_name**: ${logData.template_name}\n\n`;
    logEntry += `**prompt**: ${logData.prompt}\n\n`;

    if (logData.image) {
      logEntry += `**image**: ${logData.image}\n\n`;
    }

    if (logData.status) {
      logEntry += `**status**: ${logData.status}\n\n`;
    }

    if (logData.result) {
      logEntry += `**result**:\n\n\`\`\`json\n${JSON.stringify(
        logData.result,
        null,
        2
      )}\n\`\`\`\n\n`;
    }

    logEntry += `---\n`;

    // 追加到日志文件
    await fs.appendFile(logPath, logEntry, "utf8");

    res.json({ success: true, message: "日志保存成功" });
  } catch (error) {
    console.error("保存AI日志失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 读取AI任务日志
router.get("/:projectName/:taskName/ai-log", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    const taskPath = path.join(req.dataPath, projectName, taskName);
    const logPath = path.join(taskPath, "task_log.md");

    if (!(await fs.pathExists(logPath))) {
      return res.json({ logs: [] });
    }

    const logContent = await fs.readFile(logPath, "utf8");

    // 解析日志文件
    const logs = [];
    const sections = logContent.split("###").filter((s) => s.trim());

    for (const section of sections) {
      const lines = section.trim().split("\n");
      if (lines.length === 0) continue;

      const log = {
        time: lines[0].trim(),
      };

      // 解析各个字段
      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith("**job_id**:")) {
          log.job_id = line.replace("**job_id**:", "").trim();
        } else if (line.startsWith("**template_id**:")) {
          log.template_id = line.replace("**template_id**:", "").trim();
        } else if (line.startsWith("**template_name**:")) {
          log.template_name = line.replace("**template_name**:", "").trim();
        } else if (line.startsWith("**prompt**:")) {
          log.prompt = line.replace("**prompt**:", "").trim();
        } else if (line.startsWith("**image**:")) {
          log.image = line.replace("**image**:", "").trim();
        } else if (line.startsWith("**status**:")) {
          log.status = line.replace("**status**:", "").trim();
        } else if (line.startsWith("**result**:")) {
          // 结果可能是多行的JSON
          let resultStart = i + 1;
          let resultLines = [];
          while (
            resultStart < lines.length &&
            !lines[resultStart].startsWith("---")
          ) {
            resultLines.push(lines[resultStart]);
            resultStart++;
          }
          log.result = resultLines.join("\n").trim();
        }
      }

      if (log.job_id) {
        logs.push(log);
      }
    }

    res.json({ logs: logs.reverse() }); // 最新的在前面
  } catch (error) {
    console.error("读取AI日志失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 更新AI任务日志（用于更新任务结果）
router.put("/:projectName/:taskName/ai-log/:jobId", async (req, res) => {
  try {
    const { projectName, taskName, jobId } = req.params;
    const { status, result } = req.body;

    const taskPath = path.join(req.dataPath, projectName, taskName);
    const logPath = path.join(taskPath, "task_log.md");

    if (!(await fs.pathExists(logPath))) {
      return res.status(404).json({ error: "日志文件不存在" });
    }

    let logContent = await fs.readFile(logPath, "utf8");

    // 使用简单的字符串查找和替换方法
    const lines = logContent.split("\n");
    let inTargetSection = false;
    let sectionStartIndex = -1;
    let statusLineIndex = -1;
    let resultStartIndex = -1;
    let resultEndIndex = -1;

    // 查找目标job_id所在的section
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith("### ")) {
        if (inTargetSection) {
          // 遇到下一个section，结束当前section
          break;
        }
        sectionStartIndex = i;
        inTargetSection = false;
      }

      if (line.includes(`**job_id**: ${jobId}`)) {
        inTargetSection = true;
      }

      if (inTargetSection) {
        if (line.startsWith("**status**:")) {
          statusLineIndex = i;
        }
        if (line.startsWith("**result**:")) {
          resultStartIndex = i;
        }
        if (resultStartIndex !== -1 && line.trim() === "---") {
          resultEndIndex = i;
          break;
        }
        if (line.trim() === "---" && resultStartIndex === -1) {
          resultEndIndex = i;
          break;
        }
      }
    }

    if (!inTargetSection) {
      return res.status(404).json({ error: "未找到对应的任务记录" });
    }

    // 更新状态
    if (statusLineIndex !== -1) {
      lines[statusLineIndex] = `**status**: ${status}`;
    }

    // 更新或添加结果
    if (result) {
      const resultLines = [
        "",
        "**result**:",
        "",
        "```json",
        JSON.stringify(result, null, 2),
        "```",
        "",
      ];

      if (resultStartIndex !== -1) {
        // 替换现有结果
        lines.splice(
          resultStartIndex,
          resultEndIndex - resultStartIndex,
          ...resultLines
        );
      } else {
        // 在---之前插入结果
        lines.splice(resultEndIndex, 0, ...resultLines);
      }
    }

    logContent = lines.join("\n");
    await fs.writeFile(logPath, logContent, "utf8");

    res.json({ success: true, message: "日志更新成功" });
  } catch (error) {
    console.error("更新AI日志失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 删除AI任务日志条目
router.delete("/:projectName/:taskName/ai-log/:jobId", async (req, res) => {
  try {
    const { projectName, taskName, jobId } = req.params;
    const taskPath = path.join(req.dataPath, projectName, taskName);
    const logPath = path.join(taskPath, "task_log.md");

    if (!(await fs.pathExists(logPath))) {
      return res.status(404).json({ error: "日志文件不存在" });
    }

    const content = await fs.readFile(logPath, "utf8");

    // 将文件按部分拆分，去除包含指定 jobId 的部分
    const parts = content.split("###");
    const header = parts.shift() || "";
    const kept = parts.filter((sec) => !sec.includes(`**job_id**: ${jobId}`));
    const newContent = header + kept.map((s) => "###" + s).join("");

    await fs.writeFile(logPath, newContent, "utf8");

    res.json({ success: true, message: "日志已删除" });
  } catch (error) {
    console.error("删除AI日志失败:", error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
