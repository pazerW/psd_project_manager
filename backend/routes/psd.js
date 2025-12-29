const express = require("express");
const fs = require("fs-extra");
const path = require("path");
const sharp = require("sharp");
const { spawn } = require("child_process");
const matter = require("gray-matter");

const router = express.Router();

// 获取文件缩略图
router.get("/thumbnail/:projectName/:taskName/:fileName", async (req, res) => {
  console.log("Thumbnail request:", req.params);

  try {
    const { projectName, taskName, fileName } = req.params;

    // 缓存路径
    const thumbnailDir = path.join(
      req.dataPath,
      ".thumbnails",
      projectName,
      taskName
    );
    const thumbnailPath = path.join(thumbnailDir, `${fileName}.webp`);

    console.log("Checking thumbnail cache:", thumbnailPath);

    // 检查缓存是否存在
    if (await fs.pathExists(thumbnailPath)) {
      console.log("Thumbnail cache found, serving file");
      const stats = await fs.stat(thumbnailPath);
      res.set({
        "Content-Type": "image/webp",
        "Content-Length": stats.size,
        "Cache-Control": "public, max-age=86400", // 24小时缓存
      });
      return fs.createReadStream(thumbnailPath).pipe(res);
    }

    // 原始PSD文件路径
    const psdPath = path.join(req.dataPath, projectName, taskName, fileName);
    console.log("Checking PSD file:", psdPath);

    if (!(await fs.pathExists(psdPath))) {
      console.log("PSD file not found:", psdPath);
      return res.status(404).json({ error: "PSD file not found" });
    }

    console.log("Generating thumbnail for:", psdPath);

    // 生成缩略图
    await generateThumbnail(psdPath, thumbnailPath);

    console.log("Thumbnail generated successfully");

    // 返回生成的缩略图
    const stats = await fs.stat(thumbnailPath);
    res.set({
      "Content-Type": "image/webp",
      "Content-Length": stats.size,
      "Cache-Control": "public, max-age=86400",
    });

    fs.createReadStream(thumbnailPath).pipe(res);
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    res.status(500).json({ error: "Failed to generate thumbnail" });
  }
});

// 下载PSD文件
router.get("/download/:projectName/:taskName/:fileName", async (req, res) => {
  try {
    const { projectName, taskName, fileName } = req.params;
    const filePath = path.join(req.dataPath, projectName, taskName, fileName);

    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: "File not found" });
    }

    const stats = await fs.stat(filePath);

    // 为非 ASCII 名称兼容浏览器，使用 filename*（RFC5987）并提供 ASCII 回退
    const hasNonAscii = /[^\x00-\x7F]/.test(fileName);
    const fallbackName = hasNonAscii
      ? "file" + path.extname(fileName)
      : fileName.replace(/"/g, '\\"');
    const disposition = `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`;

    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": disposition,
      "Content-Length": stats.size,
    });

    // 使用流式传输处理大文件
    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);

    readStream.on("error", (error) => {
      console.error("Download stream error:", error);
      if (!res.headersSent) {
        res.status(500).json({ error: "Download failed" });
      }
    });
  } catch (error) {
    console.error("Download error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 删除PSD文件
router.delete("/:projectName/:taskName/:fileName", async (req, res) => {
  try {
    const { projectName, taskName, fileName } = req.params;
    const filePath = path.join(req.dataPath, projectName, taskName, fileName);

    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: "File not found" });
    }

    // 删除原文件
    await fs.remove(filePath);

    // 删除对应的缩略图
    const thumbnailPath = path.join(
      req.dataPath,
      ".thumbnails",
      projectName,
      taskName,
      `${fileName}.webp`
    );
    if (await fs.pathExists(thumbnailPath)) {
      await fs.remove(thumbnailPath);
    }

    // 删除README中对应的PSD文件描述
    await removePsdDescriptionFromReadme(
      req.dataPath,
      projectName,
      taskName,
      fileName
    );

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 生成缩略图的辅助函数
async function generateThumbnail(psdPath, thumbnailPath) {
  try {
    // 确保缩略图目录存在
    await fs.ensureDir(path.dirname(thumbnailPath));

    console.log("Attempting to process PSD with Sharp:", psdPath);

    // 尝试多种方法处理PSD文件
    try {
      // 方法1: 直接读取PSD的静态保存状态合成图像
      await sharp(psdPath, {
        page: 0, // 只读取第一页（合成预览图）
        animated: false, // 禁用动图处理
        density: 150, // 设置DPI提高质量
        limitInputPixels: false, // 允许处理大图像
      })
        .flatten({ background: { r: 255, g: 255, b: 255 } }) // 将透明背景合并为白色
        .resize(800, 800, {
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toFile(thumbnailPath);

      console.log("PSD static composite processing successful");
    } catch (psdError) {
      console.log(
        "PSD composite preview failed, trying flattened approach:",
        psdError.message
      );

      // 方法2: 尝试使用flatten合并所有图层为单一预览图
      try {
        await sharp(psdPath, {
          page: 0, // 获取第一页/图层
          density: 150,
          limitInputPixels: false, // 允许处理大图像
        })
          .flatten() // 将透明背景合并为白色
          .resize(800, 800, {
            fit: "inside",
            withoutEnlargement: true,
          })
          .webp({ quality: 85 })
          .toFile(thumbnailPath);

        console.log("Alternative PSD processing successful");
      } catch (altError) {
        console.log(
          "Alternative PSD processing also failed, trying ImageMagick:",
          altError.message
        );

        // 方法3: 使用ImageMagick作为备选方案
        await generateThumbnailWithImageMagick(psdPath, thumbnailPath);
        console.log("ImageMagick processing successful");
      }
    }
  } catch (error) {
    console.error("All thumbnail generation methods failed:", error.message);

    // 如果所有方法都失败，创建一个增强的占位符
    const fileName = path.basename(psdPath, ".psd");
    const placeholderSvg = `
      <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#f8f9fa;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#e9ecef;stop-opacity:1" />
          </linearGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <circle cx="400" cy="200" r="60" fill="#dee2e6" opacity="0.5"/>
        <rect x="340" y="160" width="120" height="80" fill="#adb5bd" opacity="0.3" rx="10"/>
        <polygon points="370,190 430,190 400,230" fill="#6c757d" opacity="0.4"/>
        <text x="400" y="320" text-anchor="middle" fill="#495057" font-size="24" font-family="Arial, sans-serif">
          PSD 文件预览
        </text>
        <text x="400" y="360" text-anchor="middle" fill="#6c757d" font-size="18" font-family="Arial, sans-serif">
          ${fileName}
        </text>
        <text x="400" y="420" text-anchor="middle" fill="#adb5bd" font-size="14" font-family="Arial, sans-serif">
          无法生成缩略图，请下载查看完整文件
        </text>
        <text x="400" y="450" text-anchor="middle" fill="#ced4da" font-size="12" font-family="Arial, sans-serif">
          文件路径: ${psdPath.split("/").slice(-3).join("/")}
        </text>
      </svg>
    `;

    console.log("Creating enhanced placeholder thumbnail");

    await sharp(Buffer.from(placeholderSvg))
      .webp({ quality: 85 })
      .toFile(thumbnailPath);

    console.log("Enhanced placeholder thumbnail created");
  }
}

// 使用ImageMagick生成缩略图的辅助函数
function generateThumbnailWithImageMagick(psdPath, thumbnailPath) {
  return new Promise((resolve, reject) => {
    const tempPath = thumbnailPath + ".tmp.webp";

    // 使用ImageMagick处理PSD文件，获取保存状态下的合成图像
    // [0] 表示获取第一个合成图像（保存时的静态状态）
    const magick = spawn("magick", [
      `${psdPath}[0]`, // PSD文件的第一个合成图像
      "-coalesce", // 确保获取完整的合成图像
      "-flatten", // 将所有图层合并为单一图像
      "-background",
      "white", // 设置透明背景为白色
      "-resize",
      "800x800>", // 限制最大尺寸为800x800
      "-quality",
      "85",
      "-strip", // 移除元数据以减小文件大小
      tempPath,
    ]);

    let stderr = "";

    magick.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    magick.on("close", async (code) => {
      if (code === 0 && (await fs.pathExists(tempPath))) {
        try {
          // 移动临时文件到最终位置
          await fs.move(tempPath, thumbnailPath);
          console.log("ImageMagick successfully processed PSD");
          resolve();
        } catch (moveError) {
          reject(new Error(`Failed to move thumbnail: ${moveError.message}`));
        }
      } else {
        const errorMsg = `ImageMagick failed with code ${code}: ${stderr}`;
        console.error(errorMsg);
        reject(new Error(errorMsg));
      }
    });

    magick.on("error", (error) => {
      reject(new Error(`Failed to spawn ImageMagick: ${error.message}`));
    });
  });
}

// 从README中删除PSD文件描述
async function removePsdDescriptionFromReadme(
  dataPath,
  projectName,
  taskName,
  fileName
) {
  const taskPath = path.join(dataPath, projectName, taskName);
  const readmePath = path.join(taskPath, "README.md");

  if (!(await fs.pathExists(readmePath))) {
    return; // README不存在，无需处理
  }

  let content = "";
  let frontmatter = {};

  // 读取现有README
  const fileContent = await fs.readFile(readmePath, "utf8");
  const parsed = matter(fileContent);
  content = parsed.content;
  frontmatter = parsed.data;

  // 删除PSD描述
  content = removePsdFromReadmeContent(content, fileName);

  // 写回README文件
  const fullContent = matter.stringify(content, frontmatter);
  await fs.writeFile(readmePath, fullContent);
}

// 从README内容中删除指定PSD文件的描述
function removePsdFromReadmeContent(content, fileName) {
  const lines = content.split("\n");
  const filteredLines = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    // 跳过包含指定PSD文件名的描述行
    if (trimmedLine.includes(`**${fileName}**`)) {
      continue;
    }
    filteredLines.push(line);
  }

  return filteredLines.join("\n");
}

module.exports = router;
