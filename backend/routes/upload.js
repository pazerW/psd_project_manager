const express = require("express");
const multer = require("multer");
const fs = require("fs-extra");
const path = require("path");

const router = express.Router();

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
        // 合并分片
        await mergeChunks(req.dataPath, uploadInfo);

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
  }
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

  // 统计当前任务目录下已有的文件数量
  const existingFiles = await fs.readdir(targetDir);
  const designFileExtensions = [
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
  const existingDesignFiles = existingFiles.filter((file) => {
    const ext = path.extname(file).toLowerCase();
    return designFileExtensions.includes(ext);
  });

  // 生成新文件名：Project名称_Task名称_序号.扩展名
  const fileNumber = existingDesignFiles.length + 1;
  const newFileName = `${projectName}_${taskName}_${fileNumber}${fileExt}`;
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

    // 文件合并完成后，异步预生成缩略图（不阻塞响应）
    const finalFileName = uploadInfo.renamedFileName || fileName;
    setImmediate(() => {
      pregen缩略图(dataPath, projectName, taskName, finalFileName).catch(
        (err) => {
          console.error("缩略图预生成失败:", err.message);
        }
      );
    });
  } catch (error) {
    writeStream.destroy();
    throw error;
  }
}

// 预生成缩略图的辅助函数
async function pregen缩略图(dataPath, projectName, taskName, fileName) {
  const fileExt = path.extname(fileName).toLowerCase();

  // 只为支持的文件类型预生成缩略图
  const supportedTypes = [
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

  if (!supportedTypes.includes(fileExt)) {
    return;
  }

  console.log(`开始为 ${fileName} 预生成缩略图...`);

  const filePath = path.join(dataPath, projectName, taskName, fileName);
  const thumbnailDir = path.join(
    dataPath,
    ".thumbnails",
    projectName,
    taskName
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

module.exports = router;
