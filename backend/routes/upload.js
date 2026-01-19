const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

// README文件锁：防止并发写入冲突
const readmeLocks = new Map(); // taskPath -> Promise

function acquireReadmeLock(taskPath) {
  if (!readmeLocks.has(taskPath)) {
    readmeLocks.set(taskPath, Promise.resolve());
  }

  const currentLock = readmeLocks.get(taskPath);
  let releaseLock;

  const newLock = new Promise((resolve) => {
    releaseLock = resolve;
  });

  readmeLocks.set(
    taskPath,
    currentLock.then(() => newLock),
  );

  return async (fn) => {
    try {
      await currentLock;
      return await fn();
    } finally {
      releaseLock();
    }
  };
}

// 配置multer用于分片上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const tempDir = path.join(req.dataPath, ".temp");
    fs.ensureDirSync(tempDir);
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    // 使用时间戳作为临时文件名，避免访问req.body
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(7);
    cb(null, `chunk_${timestamp}_${random}`);
  },
});

const upload = multer({ storage });

// 分片上传接口
router.post(
  "/chunk/:projectName/:taskName",
  upload.single("chunk"),
  async (req, res) => {
    console.log("Upload chunk request received:", {
      projectName: req.params.projectName,
      taskName: req.params.taskName,
      hasFile: !!req.file,
      body: req.body,
    });

    try {
      const { projectName, taskName } = req.params;
      const { uploadId, chunkIndex, totalChunks, fileName, fileSize } =
        req.body;

      if (!req.file) {
        console.error("No chunk uploaded in request");
        return res.status(400).json({ error: "No chunk uploaded" });
      }

      console.log("Processing chunk:", {
        uploadId,
        chunkIndex,
        totalChunks,
        fileName,
        fileSize,
        chunkSize: req.file.size,
      });

      // 记录分片信息，包含原始文件名
      const uploadInfo = {
        projectName,
        taskName,
        fileName,
        fileSize: parseInt(fileSize),
        totalChunks: parseInt(totalChunks),
        uploadedChunks: [],
        chunkFiles: [], // 存储分片文件名
        uploadId,
        timestamp: Date.now(),
        tags: req.body.tags || "", // 添加标签信息
      };

      const infoPath = path.join(req.dataPath, ".temp", `${uploadId}.json`);

      // 读取现有上传信息或创建新的
      if (await fs.pathExists(infoPath)) {
        const existingInfo = await fs.readJson(infoPath);
        uploadInfo.uploadedChunks = existingInfo.uploadedChunks || [];
        uploadInfo.chunkFiles = existingInfo.chunkFiles || [];
      }

      // 记录当前分片和对应的文件名
      const currentChunk = parseInt(chunkIndex);
      if (!uploadInfo.uploadedChunks.includes(currentChunk)) {
        uploadInfo.uploadedChunks.push(currentChunk);
        uploadInfo.chunkFiles.push({
          chunkIndex: currentChunk,
          fileName: req.file.filename,
        });
      }

      // 保存上传信息
      await fs.writeJson(infoPath, uploadInfo);

      // 检查是否所有分片都已上传
      const allChunksUploaded =
        uploadInfo.uploadedChunks.length === parseInt(totalChunks);

      if (allChunksUploaded) {
        console.log(
          `所有分片已上传完成，开始合并文件: ${fileName} (uploadId: ${uploadId})`,
        );

        // 合并分片（同步等待完成）
        await mergeChunks(req.dataPath, uploadInfo);

        console.log(`文件合并和保存完成: ${fileName} (uploadId: ${uploadId})`);

        // 清理临时文件
        await cleanupTempFiles(req.dataPath, uploadId);

        res.json({
          success: true,
          complete: true,
          message: "File uploaded and merged successfully",
        });
      } else {
        res.json({
          success: true,
          complete: false,
          uploadedChunks: uploadInfo.uploadedChunks.length,
          totalChunks: parseInt(totalChunks),
        });
      }
    } catch (error) {
      console.error("Chunk upload error:", {
        error: error.message,
        stack: error.stack,
        uploadId: req.body?.uploadId,
        fileName: req.body?.fileName,
      });
      res.status(500).json({ error: error.message });
    }
  },
);

// 检查上传状态
router.get("/status/:uploadId", async (req, res) => {
  try {
    const { uploadId } = req.params;
    const infoPath = path.join(req.dataPath, ".temp", `${uploadId}.json`);

    if (!(await fs.pathExists(infoPath))) {
      return res.status(404).json({ error: "Upload not found" });
    }

    const uploadInfo = await fs.readJson(infoPath);

    res.json({
      uploadedChunks: uploadInfo.uploadedChunks.length,
      totalChunks: uploadInfo.totalChunks,
      complete: uploadInfo.uploadedChunks.length === uploadInfo.totalChunks,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 取消上传
router.delete("/cancel/:uploadId", async (req, res) => {
  try {
    const { uploadId } = req.params;
    await cleanupTempFiles(req.dataPath, uploadId);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 合并分片的辅助函数
async function mergeChunks(dataPath, uploadInfo) {
  const { projectName, taskName, fileName, chunkFiles } = uploadInfo;

  // 目标文件路径
  const targetDir = path.join(dataPath, projectName, taskName);
  await fs.ensureDir(targetDir);

  // 获取文件扩展名
  const fileExt = path.extname(fileName);
  // 使用任务级持久自增 ID 生成文件序号，保证编号只增不减
  const fileId = await getNextFileId(targetDir);
  const newFileName = `${projectName}_${taskName}_${fileId}${fileExt}`;
  const targetPath = path.join(targetDir, newFileName);

  console.log(`文件将被重命名为: ${newFileName} (原文件名: ${fileName})`);

  // 更新 uploadInfo 中的文件名，以便后续缩略图生成使用
  uploadInfo.renamedFileName = newFileName;

  // 创建写入流
  const writeStream = fs.createWriteStream(targetPath);

  try {
    // 按照chunkIndex排序分片文件
    const sortedChunks = chunkFiles.sort((a, b) => a.chunkIndex - b.chunkIndex);

    // 按顺序合并分片
    for (const chunkInfo of sortedChunks) {
      const chunkPath = path.join(dataPath, ".temp", chunkInfo.fileName);

      if (await fs.pathExists(chunkPath)) {
        const chunkData = await fs.readFile(chunkPath);
        writeStream.write(chunkData);
      } else {
        throw new Error(`Missing chunk file ${chunkInfo.fileName}`);
      }
    }

    writeStream.end();

    await new Promise((resolve, reject) => {
      writeStream.on("finish", resolve);
      writeStream.on("error", reject);
    });

    console.log(`文件合并完成: ${targetPath}`);

    // 文件合并完成后，立即保存文件ID到README（使用文件锁保证原子性）
    const finalFileName = uploadInfo.renamedFileName || fileName;
    const tags = uploadInfo.tags || "";

    console.log(`开始保存文件ID: ${finalFileName} -> ${fileId}`);

    // 先保存文件ID，这是最重要的，必须同步完成
    try {
      await saveFileIdToReadme(
        dataPath,
        projectName,
        taskName,
        finalFileName,
        fileId,
      );
      console.log(`文件ID已保存: ${finalFileName} -> ${fileId}`);
    } catch (err) {
      console.error(`保存文件ID失败: ${finalFileName}`, err);
      // 这是关键错误，必须抛出
      throw new Error(`保存文件ID失败: ${err.message}`);
    }

    // 异步执行非关键操作：缩略图和标签
    setImmediate(() => {
      pregen缩略图(dataPath, projectName, taskName, finalFileName).catch(
        (err) => {
          console.error("缩略图预生成失败:", err.message);
        },
      );
      // 如果有标签，保存到README
      if (tags) {
        saveFileTagsToReadme(
          dataPath,
          projectName,
          taskName,
          finalFileName,
          tags,
        ).catch((err) => {
          console.error("保存标签失败:", err.message);
        });
      }
    });
  } catch (error) {
    writeStream.destroy();
    throw error;
  }
}

// 获取任务级递增文件编号并持久化到 .meta.json
async function getNextFileId(taskPath) {
  // 持久化到 taskPath/README.md 的 frontmatter.lastId 字段
  const readmePath = path.join(taskPath, "README.md");

  const withLock = acquireReadmeLock(taskPath);

  return await withLock(async () => {
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

      // 兼容已有项目：计算已存在的最大编号
      let maxExisting = 9; // 目标：首次分配为 10

      // 来自 front.fileIds 的编号
      if (front.fileIds && typeof front.fileIds === "object") {
        for (const v of Object.values(front.fileIds)) {
          const n = parseInt(v, 10);
          if (!isNaN(n) && n > maxExisting) maxExisting = n;
        }
      }

      // 来自目录中文件名的编号（匹配尾部 _<number>）
      try {
        const files = await fs.readdir(taskPath);
        for (const f of files) {
          // 跳过 README.md
          if (f === "README.md") continue;
          const m = f.match(/_(\d+)(?:\.[^.]+)?$/);
          if (m) {
            const n = parseInt(m[1], 10);
            if (!isNaN(n) && n > maxExisting) maxExisting = n;
          }
        }
      } catch (e) {
        // 忽略读取目录错误
      }

      // 确保 front.lastId 至少为 maxExisting（这样不会回退）
      if (typeof front.lastId !== "number" || front.lastId < maxExisting) {
        front.lastId = maxExisting;
      }

      // 递增并持久化，返回新值（首次返回为 maxExisting+1，默认首次为 10）
      front.lastId = (front.lastId || 0) + 1;

      const newContent = matter.stringify(content, front);
      await fs.writeFile(readmePath, newContent, "utf8");

      return front.lastId;
    } catch (err) {
      console.error("getNextFileId 错误:", err.message);
      throw err;
    }
  });
}

// 将文件编号写入 README.md 的 frontmatter（字段名为 fileIds）
async function saveFileIdToReadme(
  dataPath,
  projectName,
  taskName,
  fileName,
  id,
) {
  const taskPath = path.join(dataPath, projectName, taskName);
  const readmePath = path.join(taskPath, "README.md");

  const withLock = acquireReadmeLock(taskPath);

  return await withLock(async () => {
    try {
      const matter = require("gray-matter");
      let content = "";
      let frontmatter = {};

      if (await fs.pathExists(readmePath)) {
        const fileContent = await fs.readFile(readmePath, "utf8");
        const parsed = matter(fileContent);
        content = parsed.content;
        frontmatter = parsed.data || {};
      }

      if (!frontmatter.fileIds) frontmatter.fileIds = {};

      frontmatter.fileIds[fileName] = id;

      // 如果没有默认文件字段，则将第一个上传的文件设为默认
      if (!frontmatter.defaultFile) {
        frontmatter.defaultFile = fileName;
      }

      const newContent = matter.stringify(content, frontmatter);
      await fs.writeFile(readmePath, newContent, "utf8");

      console.log(`已为文件 ${fileName} 分配编号: ${id}`);
    } catch (error) {
      console.error("保存文件编号失败:", error.message);
      throw error;
    }
  });
}

// 预生成缩略图的辅助函数
async function pregen缩略图(dataPath, projectName, taskName, fileName) {
  const fileExt = path.extname(fileName).toLowerCase();

  // 只为支持的文件类型预生成缩略图
  const supportedTypes = [
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
  ];

  if (!supportedTypes.includes(fileExt)) {
    return;
  }

  console.log(`开始为 ${fileName} 预生成缩略图...`);

  const filePath = path.join(dataPath, projectName, taskName, fileName);
  const thumbnailDir = path.join(
    dataPath,
    ".thumbnails",
    projectName,
    taskName,
  );
  await fs.ensureDir(thumbnailDir);
  const thumbnailPath = path.join(thumbnailDir, `${fileName}.webp`);

  // 引入文件处理模块的生成函数
  const filesRouter = require("./files.js");

  try {
    // 调用缩略图生成逻辑
    const sharp = require("sharp");
    const { spawn } = require("child_process");

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
      ].includes(fileExt)
    ) {
      await sharp(filePath)
        .resize(300, 300, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    } else if (fileExt === ".psd") {
      await sharp(filePath, {
        page: 0,
        animated: false,
        density: 72,
      })
        .flatten({ background: { r: 255, g: 255, b: 255 } })
        .resize(300, 300, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    } else if (fileExt === ".ai") {
      await new Promise((resolve, reject) => {
        const magick = spawn("magick", [
          `${filePath}[0]`,
          "-density",
          "150",
          "-colorspace",
          "sRGB",
          "-flatten",
          "-background",
          "white",
          "-resize",
          "300x300>",
          "-quality",
          "85",
          "-strip",
          "-sharpen",
          "0x0.5",
          thumbnailPath,
        ]);

        let stderr = "";
        magick.stderr.on("data", (data) => {
          stderr += data.toString();
        });
        magick.on("close", (code) => {
          if (code === 0) {
            console.log(`AI文件 ${fileName} 缩略图生成成功`);
            resolve();
          } else {
            reject(new Error(`ImageMagick failed: ${stderr}`));
          }
        });
        magick.on("error", (error) => reject(error));
      });
    } else if (fileExt === ".sketch") {
      // Sketch文件暂不支持缩略图生成，跳过
      console.log(`Sketch文件 ${fileName} 暂不支持缩略图生成`);
      return;
    } else if (fileExt === ".svg") {
      await sharp(filePath)
        .resize(300, 300, { fit: "inside", withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(thumbnailPath);
    }

    console.log(`${fileName} 缩略图预生成完成`);
  } catch (error) {
    console.error(`${fileName} 缩略图预生成失败:`, error.message);
    // 失败不影响上传流程，缩略图会在首次访问时按需生成
  }
}

// 清理临时文件的辅助函数
async function cleanupTempFiles(dataPath, uploadId) {
  const tempDir = path.join(dataPath, ".temp");

  try {
    // 读取上传信息以获取分片文件列表
    const infoPath = path.join(tempDir, `${uploadId}.json`);

    if (await fs.pathExists(infoPath)) {
      const uploadInfo = await fs.readJson(infoPath);

      // 删除所有分片文件
      if (uploadInfo.chunkFiles) {
        for (const chunkInfo of uploadInfo.chunkFiles) {
          const chunkPath = path.join(tempDir, chunkInfo.fileName);
          if (await fs.pathExists(chunkPath)) {
            await fs.remove(chunkPath);
          }
        }
      }

      // 删除信息文件
      await fs.remove(infoPath);
    }

    // 兜底：删除可能遗留的文件
    const files = await fs.readdir(tempDir);
    for (const file of files) {
      if (file.includes(uploadId)) {
        await fs.remove(path.join(tempDir, file));
      }
    }
  } catch (error) {
    console.error("Error cleaning up temp files:", error);
  }
}

// 保存文件标签到README
async function saveFileTagsToReadme(
  dataPath,
  projectName,
  taskName,
  fileName,
  tags,
) {
  const taskPath = path.join(dataPath, projectName, taskName);
  const readmePath = path.join(taskPath, "README.md");

  const withLock = acquireReadmeLock(taskPath);

  return await withLock(async () => {
    try {
      const matter = require("gray-matter");
      let content = "";
      let frontmatter = {};

      if (await fs.pathExists(readmePath)) {
        const fileContent = await fs.readFile(readmePath, "utf8");
        const parsed = matter(fileContent);
        content = parsed.content;
        frontmatter = parsed.data;
      }

      // 初始化fileTags对象
      if (!frontmatter.fileTags) {
        frontmatter.fileTags = {};
      }

      // 保存标签
      frontmatter.fileTags[fileName] = tags;

      // 重新组合README内容
      const newContent = matter.stringify(content, frontmatter);
      await fs.writeFile(readmePath, newContent, "utf8");

      console.log(`已保存文件 ${fileName} 的标签: ${tags}`);
    } catch (error) {
      console.error("保存文件标签失败:", error);
      throw error;
    }
  });
}

module.exports = router;
