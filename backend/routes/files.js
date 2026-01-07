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
    const fileExt = path.extname(fileName).toLowerCase();

    // 根据客户端 Accept 头选择输出格式：优先 webp，否则回退 png
    const accept = req.headers.accept || "";
    const outFormat = accept.includes("image/webp") ? "webp" : "png";

    // 缓存路径，使用文件名基础名（不含原始扩展）作为缩略图名，避免双扩展名
    const thumbnailDir = path.join(
      req.dataPath,
      ".thumbnails",
      projectName,
      taskName
    );
    const fileBaseName = path.basename(fileName, fileExt); // 去掉原始扩展名
    const thumbnailPath = path.join(
      thumbnailDir,
      `${fileBaseName}.${outFormat}`
    );

    console.log(
      "Checking thumbnail cache:",
      thumbnailPath,
      "(outFormat:",
      outFormat + ")"
    );

    // 检查缓存是否存在
    if (await fs.pathExists(thumbnailPath)) {
      console.log("Thumbnail cache found, serving file");
      const stats = await fs.stat(thumbnailPath);
      res.set({
        "Content-Type": outFormat === "webp" ? "image/webp" : "image/png",
        "Content-Length": stats.size,
        "Cache-Control": "public, max-age=86400", // 24小时缓存
      });
      return fs.createReadStream(thumbnailPath).pipe(res);
    }

    // 如果客户端接受 webp，但 webp 缓存不存在，且已存在 png 缓存，则直接回落并返回 png（避免生成失败导致前端显示占位符）
    if (outFormat === "webp") {
      const pngFallback = path.join(thumbnailDir, `${fileBaseName}.png`);
      if (await fs.pathExists(pngFallback)) {
        console.log(
          "WebP cache missing; serving existing PNG fallback:",
          pngFallback
        );
        const stats = await fs.stat(pngFallback);
        res.set({
          "Content-Type": "image/png",
          "Content-Length": stats.size,
          "Cache-Control": "public, max-age=86400",
        });
        return fs.createReadStream(pngFallback).pipe(res);
      }
    }

    // 原始文件路径
    const filePath = path.join(req.dataPath, projectName, taskName, fileName);
    console.log("Checking file:", filePath);

    if (!(await fs.pathExists(filePath))) {
      console.log("File not found:", filePath);
      return res.status(404).json({ error: "File not found" });
    }

    console.log("Generating thumbnail for:", filePath);

    // 根据文件类型生成缩略图（支持输出格式）
    await generateThumbnail(filePath, thumbnailPath, fileExt, outFormat);

    // 返回生成的缩略图
    if (await fs.pathExists(thumbnailPath)) {
      const stats = await fs.stat(thumbnailPath);
      res.set({
        "Content-Type": outFormat === "webp" ? "image/webp" : "image/png",
        "Content-Length": stats.size,
        "Cache-Control": "public, max-age=86400",
      });
      fs.createReadStream(thumbnailPath).pipe(res);
    } else {
      console.log("Thumbnail generation failed");
      res.status(500).json({ error: "Thumbnail generation failed" });
    }
  } catch (error) {
    console.error("Thumbnail generation error:", error);
    res.status(500).json({ error: error.message });
  }
});

// 下载文件
router.get("/download/:projectName/:taskName/:fileName", async (req, res) => {
  try {
    const { projectName, taskName } = req.params;
    let { fileName } = req.params;

    // 有时候客户端可能会对路径片段进行双重编码，尝试解码一次以获得文件系统上的真实名称
    try {
      fileName = decodeURIComponent(fileName);
    } catch (e) {
      // ignore and keep original if decode fails
    }

    // 记录调试信息（便于在 NAS 环境排查编码/路径问题）
    console.log("[Download] params:", {
      projectName,
      taskName,
      fileName: req.params.fileName,
    });

    // 防止路径遍历
    if (
      fileName.includes("..") ||
      fileName.includes("/") ||
      fileName.includes("\\")
    ) {
      return res.status(400).json({ error: "Invalid file name" });
    }

    const filePath = path.join(req.dataPath, projectName, taskName, fileName);
    const resolved = path.resolve(filePath);
    console.log("[Download] resolvedPath:", resolved);
    console.log("[Download] dataPath base:", path.resolve(req.dataPath));
    const base = path.resolve(req.dataPath) + path.sep;
    if (!resolved.startsWith(base)) {
      return res.status(403).json({ error: "Access denied" });
    }

    let exists = await fs.pathExists(resolved);
    console.log("[Download] file exists:", exists);

    // 如果直接路径不存在，尝试在目录中匹配 Unicode 正规化差异（NFC/NFD）或相似名称（NAS 与 macOS 常见问题）
    if (!exists) {
      try {
        const dir = path.dirname(resolved);
        console.log(
          "[Download] attempting fallback filename match in dir:",
          dir
        );
        const entries = await fs.readdir(dir);
        const requested = fileName;
        const normalizedRequested =
          requested && requested.normalize
            ? requested.normalize("NFC")
            : requested;

        let matched = entries.find((entry) => {
          if (entry === requested) return true;
          if (entry.normalize) {
            const eNFC = entry.normalize("NFC");
            const eNFD = entry.normalize("NFD");
            if (eNFC === normalizedRequested || eNFD === normalizedRequested)
              return true;
          }
          return false;
        });

        if (matched) {
          const oldResolved = resolved;
          resolved = path.join(dir, matched);
          console.log(
            "[Download] fallback matched file:",
            matched,
            "oldResolved=",
            oldResolved,
            "newResolved=",
            resolved
          );
          exists = await fs.pathExists(resolved);
        } else {
          console.log(
            "[Download] no fallback match found in directory entries"
          );
        }
      } catch (err) {
        console.error("[Download] fallback readdir error:", err);
      }
    }

    if (!exists) {
      return res.status(404).json({ error: "File not found" });
    }

    const stats = await fs.stat(resolved);

    // 为非 ASCII 名称兼容浏览器，使用 filename*（RFC5987）
    // filename 参数只能使用 ASCII，对于中文文件名使用 encodeURIComponent 后的值或简化名称
    const hasNonAscii = /[^\x00-\x7F]/.test(fileName);
    const fallbackName = hasNonAscii
      ? "file" + path.extname(fileName)
      : fileName.replace(/\"/g, '\\"');
    const disposition = `attachment; filename="${fallbackName}"; filename*=UTF-8''${encodeURIComponent(
      fileName
    )}`;

    res.set({
      "Content-Type": "application/octet-stream",
      "Content-Disposition": disposition,
      "Content-Length": stats.size,
    });

    const stream = fs.createReadStream(resolved);
    stream.on("error", (err) => {
      console.error("File stream error:", err);
      if (!res.headersSent) {
        res.status(500).json({ error: "Failed to read file" });
      } else {
        res.destroy();
      }
    });
    stream.pipe(res);
  } catch (error) {
    console.error("Download error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message });
    }
  }
});

// 删除文件
router.delete("/:projectName/:taskName/:fileName", async (req, res) => {
  try {
    const { projectName, taskName, fileName } = req.params;
    const filePath = path.join(req.dataPath, projectName, taskName, fileName);

    if (!(await fs.pathExists(filePath))) {
      return res.status(404).json({ error: "File not found" });
    }

    // 删除原文件
    await fs.remove(filePath);

    // 删除对应的缩略图（同时删除 webp 与 png 缓存），使用基础名
    const fileExtToRemove = path.extname(fileName).toLowerCase();
    const fileBaseToRemove = path.basename(fileName, fileExtToRemove);
    const thumbnailPathWebp = path.join(
      req.dataPath,
      ".thumbnails",
      projectName,
      taskName,
      `${fileBaseToRemove}.webp`
    );
    const thumbnailPathPng = path.join(
      req.dataPath,
      ".thumbnails",
      projectName,
      taskName,
      `${fileBaseToRemove}.png`
    );
    if (await fs.pathExists(thumbnailPathWebp)) {
      await fs.remove(thumbnailPathWebp);
    }
    if (await fs.pathExists(thumbnailPathPng)) {
      await fs.remove(thumbnailPathPng);
    }

    // 删除README中对应的文件描述
    await removeFileDescriptionFromReadme(
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

// 生成缩略图的主函数
async function generateThumbnail(
  filePath,
  thumbnailPath,
  fileExt,
  outFormat = "webp"
) {
  await fs.ensureDir(path.dirname(thumbnailPath));

  try {
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
      // 普通图片文件，使用Sharp直接处理
      console.log(`Processing image file: ${filePath} (${fileExt})`);
      await generateImageThumbnail(filePath, thumbnailPath, outFormat);
    } else if (fileExt === ".psd") {
      // PSD文件，使用Sharp或ImageMagick
      await generatePsdThumbnail(filePath, thumbnailPath, outFormat);
    } else if (fileExt === ".ai") {
      // AI文件，使用ImageMagick
      await generateAiThumbnail(filePath, thumbnailPath, outFormat);
    } else if (fileExt === ".svg") {
      // SVG文件，使用Sharp
      await generateSvgThumbnail(filePath, thumbnailPath, outFormat);
    } else {
      // 不支持的格式，生成占位符
      await generatePlaceholderThumbnail(thumbnailPath, fileExt, outFormat);
    }

    // 验证缩略图是否生成成功
    if (!(await fs.pathExists(thumbnailPath))) {
      console.error(`Thumbnail file not created at: ${thumbnailPath}`);
      throw new Error("Thumbnail file was not created");
    }

    const stats = await fs.stat(thumbnailPath);
    if (stats.size === 0) {
      console.error(`Thumbnail file is empty: ${thumbnailPath}`);
      throw new Error("Thumbnail file is empty");
    }

    console.log(
      `Thumbnail successfully generated: ${thumbnailPath} (${stats.size} bytes)`
    );
  } catch (error) {
    console.error("Thumbnail generation failed:", error);
    // 如果生成失败，创建占位符
    try {
      await generatePlaceholderThumbnail(thumbnailPath, fileExt);
      console.log(`Created placeholder thumbnail for ${fileExt}`);
    } catch (placeholderError) {
      console.error("Failed to create placeholder:", placeholderError);
      throw placeholderError;
    }
  }
}

// 生成普通图片缩略图
async function generateImageThumbnail(filePath, thumbnailPath) {
  console.log(`Generating image thumbnail for ${filePath}`);
  try {
    const pipeline = sharp(filePath)
      .rotate()
      .resize(800, 800, { fit: "inside", withoutEnlargement: true });
    if (path.extname(thumbnailPath).toLowerCase() === ".webp") {
      pipeline.webp({ quality: 85 });
    } else {
      pipeline.png({ quality: 85 });
    }
    await pipeline.toFile(thumbnailPath);
    console.log(`Image thumbnail generated successfully: ${thumbnailPath}`);
  } catch (error) {
    console.error(
      `Failed to generate image thumbnail with Sharp: ${error.message}`
    );
    // 如果 Sharp 不能处理某些图片（例如缺少 JPEG delegate），尝试使用 ImageMagick 回退
    try {
      console.log("Falling back to ImageMagick for image thumbnail generation");
      await generateThumbnailWithImageMagick(filePath, thumbnailPath);
      console.log(
        `Image thumbnail generated successfully with ImageMagick: ${thumbnailPath}`
      );
    } catch (magickError) {
      console.error(`ImageMagick fallback also failed: ${magickError.message}`);
      throw magickError;
    }
  }
}

// 生成PSD缩略图
async function generatePsdThumbnail(filePath, thumbnailPath) {
  console.log(`Generating PSD thumbnail for ${filePath}`);
  try {
    // 首先尝试Sharp，只读取PSD保存状态下的静态合成图像
    const pipeline = sharp(filePath, { page: 0, animated: false, density: 150 })
      .flatten({ background: { r: 255, g: 255, b: 255 } })
      .resize(800, 800, { fit: "inside", withoutEnlargement: true });
    if (path.extname(thumbnailPath).toLowerCase() === ".webp") {
      pipeline.webp({ quality: 85 });
    } else {
      pipeline.png({ quality: 85 });
    }
    await pipeline.toFile(thumbnailPath);
    console.log(
      `PSD thumbnail generated successfully with Sharp: ${thumbnailPath}`
    );
  } catch (sharpError) {
    console.log(
      "Sharp failed for PSD, trying ImageMagick:",
      sharpError.message
    );
    // Sharp失败，尝试ImageMagick，使用[0]只取第一个合成图像
    await generateThumbnailWithImageMagick(filePath, thumbnailPath, "[0]");
  }
}

// 生成AI文件缩略图
async function generateAiThumbnail(filePath, thumbnailPath) {
  try {
    // AI文件是矢量格式，需要特殊处理以获得最佳质量
    await generateAiThumbnailWithImageMagick(filePath, thumbnailPath);
  } catch (error) {
    console.log("ImageMagick failed for AI file:", error.message);
    await generatePlaceholderThumbnail(thumbnailPath, ".ai");
  }
}

// 生成SVG缩略图
async function generateSvgThumbnail(filePath, thumbnailPath) {
  console.log(`Generating SVG thumbnail for ${filePath}`);
  try {
    const pipeline = sharp(filePath).resize(800, 800, {
      fit: "inside",
      withoutEnlargement: true,
    });
    if (path.extname(thumbnailPath).toLowerCase() === ".webp") {
      pipeline.webp({ quality: 85 });
    } else {
      pipeline.png({ quality: 85 });
    }
    await pipeline.toFile(thumbnailPath);
    console.log(`SVG thumbnail generated successfully: ${thumbnailPath}`);
  } catch (error) {
    console.error(`Failed to generate SVG thumbnail: ${error.message}`);
    throw error;
  }
}

// 使用ImageMagick生成缩略图
async function generateThumbnailWithImageMagick(
  filePath,
  thumbnailPath,
  pageSelector = ""
) {
  console.log(`Generating thumbnail with ImageMagick for ${filePath}`);
  return new Promise((resolve, reject) => {
    const inputFile = filePath + pageSelector;
    const args = [
      inputFile,
      "-coalesce",
      "-flatten",
      "-background",
      "white",
      "-thumbnail",
      "800x800>",
      "-quality",
      "85",
      "-strip",
    ];
    // 如果输出不是 webp，ImageMagick 会根据输出后缀决定格式（例如 .png）
    args.push(thumbnailPath);

    const magick = spawn("magick", args);

    let stderr = "";

    magick.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    magick.on("close", (code) => {
      if (code === 0) {
        console.log("ImageMagick thumbnail generated successfully");
        resolve();
      } else {
        reject(new Error(`ImageMagick failed with code ${code}: ${stderr}`));
      }
    });

    magick.on("error", (error) => {
      reject(new Error(`Failed to spawn ImageMagick: ${error.message}`));
    });
  });
}

// 生成占位符缩略图，支持根据输出路径后缀选择格式
async function generatePlaceholderThumbnail(thumbnailPath, fileExt, outFormat) {
  console.log(`Generating placeholder thumbnail for ${fileExt}`);
  const placeholderText = getFileTypeText(fileExt);

  const pipeline = sharp({
    create: {
      width: 800,
      height: 600,
      channels: 4,
      background: { r: 240, g: 240, b: 240, alpha: 1 },
    },
  }).composite([
    {
      input: Buffer.from(`
      <svg width="800" height="600">
        <rect width="800" height="600" fill="#f0f0f0" stroke="#ddd" stroke-width="2"/>
        <text x="400" y="280" font-family="Arial, sans-serif" font-size="24" text-anchor="middle" fill="#666">
          ${placeholderText}
        </text>
        <text x="400" y="340" font-family="Arial, sans-serif" font-size="48" text-anchor="middle" fill="#999">
          ${fileExt.toUpperCase()}
        </text>
      </svg>
    `),
      top: 0,
      left: 0,
    },
  ]);

  const ext =
    outFormat || path.extname(thumbnailPath).replace(".", "").toLowerCase();
  if (ext === "webp") {
    pipeline.webp({ quality: 85 });
  } else {
    pipeline.png({ quality: 85 });
  }

  await pipeline.toFile(thumbnailPath);
  console.log(`Placeholder thumbnail generated: ${thumbnailPath}`);
}

// 获取文件类型显示文本
function getFileTypeText(fileExt) {
  const typeMap = {
    ".psd": "Photoshop文档",
    ".ai": "Illustrator文档",
    ".svg": "SVG矢量图",
    ".jpg": "图片文件",
    ".jpeg": "图片文件",
    ".png": "图片文件",
    ".gif": "动图文件",
    ".bmp": "位图文件",
    ".webp": "图片文件",
    ".tiff": "图片文件",
    ".tif": "图片文件",
  };
  return typeMap[fileExt] || "文件";
}

// 从README中删除文件描述
async function removeFileDescriptionFromReadme(
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

  // 删除文件描述
  content = removeFileFromReadmeContent(content, fileName);

  // 写回README文件
  const fullContent = matter.stringify(content, frontmatter);
  await fs.writeFile(readmePath, fullContent);
}

// 从README内容中删除指定文件的描述
function removeFileFromReadmeContent(content, fileName) {
  const lines = content.split("\n");
  const filteredLines = [];

  for (const line of lines) {
    const trimmedLine = line.trim();
    // 跳过包含指定文件名的描述行
    if (trimmedLine.includes(`**${fileName}**`)) {
      continue;
    }
    filteredLines.push(line);
  }

  return filteredLines.join("\n");
}

// 专门处理AI文件的ImageMagick函数
async function generateAiThumbnailWithImageMagick(filePath, thumbnailPath) {
  return new Promise((resolve, reject) => {
    // AI文件专用处理参数
    const magick = spawn("magick", [
      `${filePath}[0]`, // 只读取第一个页面/画板
      "-density",
      "150", // 设置较高的分辨率以保持矢量图清晰度
      "-colorspace",
      "sRGB", // 确保颜色空间正确
      "-flatten", // 将所有图层合并为单一图像
      "-background",
      "white", // 设置透明背景为白色
      "-resize",
      "800x800>", // 调整大小
      "-quality",
      "85", // 稍高的质量以保持细节
      "-strip", // 移除元数据
      "-sharpen",
      "0x0.5", // 轻微锐化以增强矢量图的清晰度
      thumbnailPath,
    ]);

    let stderr = "";
    let stdout = "";

    magick.stderr.on("data", (data) => {
      stderr += data.toString();
    });

    magick.stdout.on("data", (data) => {
      stdout += data.toString();
    });

    magick.on("close", (code) => {
      if (code === 0) {
        console.log("AI file thumbnail generated successfully");
        resolve();
      } else {
        console.log("ImageMagick stderr:", stderr);
        console.log("ImageMagick stdout:", stdout);
        reject(new Error(`ImageMagick failed with code ${code}: ${stderr}`));
      }
    });

    magick.on("error", (error) => {
      reject(
        new Error(`Failed to spawn ImageMagick for AI file: ${error.message}`)
      );
    });
  });
}

module.exports = router;
