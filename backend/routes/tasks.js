const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const matter = require("gray-matter");

const router = express.Router();

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

      await updatePsdDescription(
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

// 更新PSD文件描述（保留向后兼容）
router.put(
  "/:projectName/:taskName/psd/:fileName/description",
  async (req, res) => {
    try {
      const { projectName, taskName, fileName } = req.params;
      const { description } = req.body;

      await updatePsdDescription(
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

// 分析任务详情的辅助函数
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
        });
      }
    }
  } catch (error) {
    console.error(`Error analyzing task details ${taskName}:`, error);
  }

  return {
    name: taskName,
    path: taskPath,
    readmeContent,
    frontmatter,
    psdFiles,
    psdCount: psdFiles.length,
  };
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

// 更新PSD文件描述到README
async function updatePsdDescription(
  dataPath,
  projectName,
  taskName,
  fileName,
  description
) {
  const taskPath = path.join(dataPath, projectName, taskName);
  const readmePath = path.join(taskPath, "README.md");

  let content = "";
  let frontmatter = {};

  // 读取现有README
  if (await fs.pathExists(readmePath)) {
    const fileContent = await fs.readFile(readmePath, "utf8");
    const parsed = matter(fileContent);
    content = parsed.content;
    frontmatter = parsed.data;
  }

  // 更新文件描述部分
  content = updatePsdSectionInReadme(content, fileName, description);

  // 写回README文件
  const fullContent = matter.stringify(content, frontmatter);
  await fs.writeFile(readmePath, fullContent);
}

// 在README内容中更新PSD文件描述段落
function updatePsdSectionInReadme(content, fileName, description) {
  const lines = content.split("\n");
  let psdSectionIndex = -1;
  let psdSectionEndIndex = -1;
  let fileLineIndex = -1;

  // 查找PSD文件说明段落
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (
      line === "## PSD文件说明" ||
      line === "## PSD Files" ||
      line === "## 设计文件说明" ||
      line === "## Design Files"
    ) {
      psdSectionIndex = i;
      continue;
    }

    if (psdSectionIndex !== -1 && line.startsWith("##")) {
      psdSectionEndIndex = i;
      break;
    }

    if (psdSectionIndex !== -1 && line.includes(`**${fileName}**`)) {
      fileLineIndex = i;
    }
  }

  // 如果没有PSD文件说明段落，创建一个
  if (psdSectionIndex === -1) {
    lines.push("");
    lines.push("## 设计文件说明");
    lines.push("");
    psdSectionIndex = lines.length - 2;
  }

  // 更新或添加文件描述
  const descriptionLine = `- **${fileName}**：${description || "暂无描述"}`;

  if (fileLineIndex !== -1) {
    // 更新现有描述
    if (description) {
      lines[fileLineIndex] = descriptionLine;
    } else {
      // 如果描述为空，删除这行
      lines.splice(fileLineIndex, 1);
    }
  } else if (description) {
    // 添加新的文件描述
    const insertIndex =
      psdSectionEndIndex !== -1 ? psdSectionEndIndex : lines.length;
    lines.splice(insertIndex, 0, descriptionLine);
  }

  return lines.join("\n");
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
