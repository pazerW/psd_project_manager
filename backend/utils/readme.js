const fs = require("fs-extra");
const path = require("path");
const matter = require("gray-matter");

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

`;
    }

    await fs.writeFile(readmePath, content, "utf8");
    console.log(`Created README.md for ${type}: ${name}`);
  }
}

async function updateFileDescription(
  dataPath,
  projectName,
  taskName,
  fileName,
  description
) {
  const readmePath = path.join(dataPath, projectName, taskName, "README.md");
  await fs.ensureFile(readmePath);
  const content = await fs.readFile(readmePath, "utf8");
  const parsed = matter(content);
  if (!parsed.data.fileDescriptions) parsed.data.fileDescriptions = {};
  parsed.data.fileDescriptions[fileName] = description;
  const updated = matter.stringify(parsed.content, parsed.data);
  await fs.writeFile(readmePath, updated, "utf8");
}

async function updateFileTags(dataPath, projectName, taskName, fileName, tags) {
  const readmePath = path.join(dataPath, projectName, taskName, "README.md");
  await fs.ensureFile(readmePath);
  const content = await fs.readFile(readmePath, "utf8");
  const parsed = matter(content);
  if (!parsed.data.fileTags) parsed.data.fileTags = {};
  parsed.data.fileTags[fileName] = tags;
  const updated = matter.stringify(parsed.content, parsed.data);
  await fs.writeFile(readmePath, updated, "utf8");
}

async function removeFileDescription(
  dataPath,
  projectName,
  taskName,
  fileName
) {
  const readmePath = path.join(dataPath, projectName, taskName, "README.md");
  if (!(await fs.pathExists(readmePath))) return;
  const content = await fs.readFile(readmePath, "utf8");
  const parsed = matter(content);
  if (parsed.data.fileDescriptions && parsed.data.fileDescriptions[fileName]) {
    delete parsed.data.fileDescriptions[fileName];
    const updated = matter.stringify(parsed.content, parsed.data);
    await fs.writeFile(readmePath, updated, "utf8");
  }
}

module.exports = {
  ensureReadme,
  updateFileDescription,
  updateFileTags,
  removeFileDescription,
};
