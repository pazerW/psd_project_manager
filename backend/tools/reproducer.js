#!/usr/bin/env node
/**
 * reproducer.js
 * 快速连续写入 README.md 并轮询 API，记录文件内容与 API 返回的不一致情况
 * Usage: node tools/reproducer.js [project] [task] [iterations] [delayMs]
 */

const fs = require("fs-extra");
const path = require("path");
const matter = require("gray-matter");

const SERVER = process.env.SERVER || "http://localhost:3000";
const DATA_ROOT =
  process.env.DATA_ROOT || path.join(__dirname, "..", "..", "data");

async function writeReadmeAtomic(
  filePath,
  frontmatter,
  content,
  useTemp = true
) {
  const text = matter.stringify(content || "", frontmatter || {});
  if (!useTemp) {
    await fs.writeFile(filePath, text, "utf8");
    return;
  }
  const tmp = `${filePath}.tmp.${Date.now()}.${Math.floor(
    Math.random() * 100000
  )}`;
  await fs.writeFile(tmp, text, "utf8");
  // Ensure write is flushed by reading back
  await fs.readFile(tmp, "utf8");
  await fs.rename(tmp, filePath);
}

async function pollApi(
  project,
  task,
  expectedStatus,
  timeoutMs = 3000,
  pollInterval = 50
) {
  const url = `${SERVER}/api/tasks/${encodeURIComponent(
    project
  )}/${encodeURIComponent(task)}`;
  const end = Date.now() + timeoutMs;
  let attempts = 0;
  let last = null;

  while (Date.now() < end) {
    attempts++;
    try {
      const resp = await fetch(url, { cache: "no-store" });
      if (!resp.ok) {
        last = { error: `HTTP ${resp.status}` };
      } else {
        const json = await resp.json();
        // The API returns full task object including frontmatter
        const actual =
          (json.frontmatter && json.frontmatter.status) || json.status || null;
        if (actual === expectedStatus) {
          return { ok: true, attempts, actual };
        }
        last = { actual };
      }
    } catch (err) {
      last = { error: err.message };
    }
    await new Promise((r) => setTimeout(r, pollInterval));
  }

  return { ok: false, attempts, last };
}

async function readFileStatus(filePath) {
  try {
    const content = await fs.readFile(filePath, "utf8");
    const parsed = matter(content);
    return parsed.data.status;
  } catch (err) {
    return null;
  }
}

async function main() {
  const project = process.argv[2] || "测试项目";
  const task = process.argv[3] || "设计任务";
  const iterations = parseInt(process.argv[4], 10) || 50;
  const delayMs = parseInt(process.argv[5], 10) || 0; // time between writes
  const filePath = path.join(DATA_ROOT, project, task, "README.md");

  const statuses = ["待办", "进行中", "已完成", "456", "已上线"];

  console.log("Reproducer starting", {
    SERVER,
    DATA_ROOT,
    project,
    task,
    iterations,
    delayMs,
    filePath,
  });

  // Optionally start a concurrent API-based status updater (to simulate mixed sources)
  let _stopConcurrent = false;
  async function callStatusUpdateApi(project, task, status) {
    const url = `${SERVER}/api/tasks/${encodeURIComponent(
      project
    )}/${encodeURIComponent(task)}/status`;
    try {
      const resp = await fetch(url, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status }),
        cache: "no-store",
      });
      if (!resp.ok) return { ok: false, status: resp.status };
      return { ok: true, body: await resp.json() };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  }

  if (process.env.CONCURRENT === "true") {
    (async () => {
      console.log("[concurrent] starting API updater");
      while (!_stopConcurrent) {
        const s = statuses[Math.floor(Math.random() * statuses.length)];
        const r = await callStatusUpdateApi(project, task, s);
        console.log("[concurrent] api-update", s, r.ok ? "ok" : r);
        await new Promise((r) => setTimeout(r, Math.floor(Math.random() * 40)));
      }
      console.log("[concurrent] api updater stopped");
    })();
  }

  for (let i = 0; i < iterations; i++) {
    const status = statuses[i % statuses.length];
    const content = `自动化复现写入 #${i + 1}`;
    const fm = { status, updatedAt: Date.now() };

    const start = Date.now();

    try {
      const useAtomic = process.env.USE_ATOMIC !== "false";
      await writeReadmeAtomic(filePath, fm, content, useAtomic);
    } catch (err) {
      console.error(`[${i}] write error:`, err.message);
      continue;
    }

    const afterWrite = Date.now();
    const fileStatus = await readFileStatus(filePath);

    const poll = await pollApi(project, task, status, 3000, 50);

    const ok = poll.ok && fileStatus === status;

    console.log(
      `[${i}] status=${status} wroteAt=${
        afterWrite - start
      }ms fileStatus=${fileStatus} apiOk=${poll.ok} apiActual=${
        poll.last ? JSON.stringify(poll.last) : "match"
      } attempts=${poll.attempts}`
    );

    if (!ok) {
      const record = {
        iteration: i,
        status,
        fileStatus,
        api: poll,
        timestamp: new Date().toISOString(),
      };
      const logPath = path.join(
        __dirname,
        "..",
        "..",
        "logs",
        `reproducer-${Date.now()}.json`
      );
      await fs.ensureDir(path.dirname(logPath));
      await fs.appendFile(logPath, JSON.stringify(record) + "\n", "utf8");
      console.warn("[Mismatch] recorded to", logPath);
    }

    if (delayMs > 0) await new Promise((r) => setTimeout(r, delayMs));
  }

  // Stop concurrent worker (if started)
  _stopConcurrent = true;

  console.log("Reproducer finished");
}

// Quick check for global fetch (Node 18+). If absent, require node-fetch.
(async () => {
  if (typeof fetch === "undefined") {
    global.fetch = (await import("node-fetch")).default;
  }
  await main();
})();
