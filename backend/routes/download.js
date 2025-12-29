const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const archiver = require("archiver");
const matter = require("gray-matter");

const router = express.Router();

// 获取项目中所有可用的标签
router.get("/tags/:projectName", async (req, res) => {
  try {
    const { projectName } = req.params;
    const projectPath = path.join(req.dataPath, projectName);

    if (!(await fs.pathExists(projectPath))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const tagsSet = new Set();
    const items = await fs.readdir(projectPath, { withFileTypes: true });

    // 遍历所有任务
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const taskPath = path.join(projectPath, item.name);
        const readmePath = path.join(taskPath, "README.md");

        if (await fs.pathExists(readmePath)) {
          const content = await fs.readFile(readmePath, "utf8");
          const parsed = matter(content);
          const fileTags = parsed.data.fileTags || {};

          // 收集所有标签
          Object.values(fileTags).forEach((tag) => {
            if (tag && tag.trim()) {
              tagsSet.add(tag.trim());
            }
          });
        }
      }
    }

    res.json(Array.from(tagsSet).sort());
  } catch (error) {
    console.error("获取标签列表失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 获取特定标签的所有文件
router.get("/files-by-tag/:projectName/:tag", async (req, res) => {
  try {
    const { projectName, tag } = req.params;
    const projectPath = path.join(req.dataPath, projectName);

    if (!(await fs.pathExists(projectPath))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const matchedFiles = [];
    const items = await fs.readdir(projectPath, { withFileTypes: true });

    // 遍历所有任务
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const taskName = item.name;
        const taskPath = path.join(projectPath, taskName);
        const readmePath = path.join(taskPath, "README.md");

        if (await fs.pathExists(readmePath)) {
          const content = await fs.readFile(readmePath, "utf8");
          const parsed = matter(content);
          const fileTags = parsed.data.fileTags || {};

          // 查找匹配标签的文件
          for (const [fileName, fileTag] of Object.entries(fileTags)) {
            if (fileTag && fileTag.trim() === tag) {
              const filePath = path.join(taskPath, fileName);
              if (await fs.pathExists(filePath)) {
                const stats = await fs.stat(filePath);
                matchedFiles.push({
                  fileName,
                  taskName,
                  filePath,
                  size: stats.size,
                  tag: fileTag,
                });
              }
            }
          }
        }
      }
    }

    res.json(matchedFiles);
  } catch (error) {
    console.error("获取标签文件列表失败:", error);
    res.status(500).json({ error: error.message });
  }
});

// 打包下载特定标签的所有文件
router.get("/download-by-tag/:projectName/:tag", async (req, res) => {
  try {
    const { projectName, tag } = req.params;
    const projectPath = path.join(req.dataPath, projectName);

    if (!(await fs.pathExists(projectPath))) {
      return res.status(404).json({ error: "Project not found" });
    }

    const matchedFiles = [];
    const items = await fs.readdir(projectPath, { withFileTypes: true });

    // 遍历所有任务，查找匹配标签的文件
    for (const item of items) {
      if (item.isDirectory() && !item.name.startsWith(".")) {
        const taskName = item.name;
        const taskPath = path.join(projectPath, taskName);
        const readmePath = path.join(taskPath, "README.md");

        if (await fs.pathExists(readmePath)) {
          const content = await fs.readFile(readmePath, "utf8");
          const parsed = matter(content);
          const fileTags = parsed.data.fileTags || {};

          // 查找匹配标签的文件
          for (const [fileName, fileTag] of Object.entries(fileTags)) {
            if (fileTag && fileTag.trim() === tag) {
              const filePath = path.join(taskPath, fileName);
              if (await fs.pathExists(filePath)) {
                matchedFiles.push({
                  fileName,
                  taskName,
                  filePath,
                });
              }
            }
          }
        }
      }
    }

    if (matchedFiles.length === 0) {
      return res.status(404).json({ error: "No files found with this tag" });
    }

    // 设置响应头，使用 RFC5987 filename* 并提供 ASCII 回退
    let zipFileName = `${projectName}_${tag}_${Date.now()}.zip`;
    // 移除可能的控制字符，防止 header 注入/非法字符
    zipFileName = zipFileName.replace(/[\r\n\t]/g, "_");
    res.setHeader("Content-Type", "application/zip");

    // 如果包含非 ASCII 字符，使用简单 ASCII 回退名
    const hasNonAscii = /[^\x00-\x7F]/.test(zipFileName);
    const fallbackName = hasNonAscii
      ? `download_${Date.now()}.zip`
      : zipFileName.replace(/"/g, '\\"');
    const disposition = `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(
      zipFileName
    )}`;
    res.setHeader("Content-Disposition", disposition);

    // 创建压缩包
    const archive = archiver("zip", {
      zlib: { level: 9 }, // 最高压缩级别
    });

    // 处理错误：如果 header 已发送，避免尝试写 JSON（会导致协议错误），改为销毁响应
    archive.on("error", (err) => {
      console.error("压缩文件错误:", err);
      try {
        archive.abort && archive.abort();
      } catch (e) {
        // ignore
      }
      if (!res.headersSent) {
        try {
          res.status(500).json({ error: err.message });
        } catch (e) {
          try { res.destroy(err); } catch (ee) {}
        }
      } else {
        try { res.destroy(err); } catch (e) {}
      }
    });

    // 将压缩包输出到响应流
    archive.pipe(res);

    // 添加文件到压缩包
    for (const file of matchedFiles) {
      // 在压缩包中使用 "任务名/文件名" 的结构
      const archivePath = `${file.taskName}/${file.fileName}`;
      archive.file(file.filePath, { name: archivePath });
    }

    // 完成压缩
    try {
      await archive.finalize();
    } catch (err) {
      console.error('archive finalize error:', err);
      // 已在 archive.on('error') 中处理
    }

    console.log(
      `已创建标签 "${tag}" 的压缩包，包含 ${matchedFiles.length} 个文件`
    );
  } catch (error) {
    console.error("打包下载失败:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

module.exports = router;
