const express = require("express");
const chokidar = require("chokidar");
const path = require("path");

module.exports = function (DATA_PATH) {
  const router = express.Router();

  // Keep a single watcher and list of clients
  let watcher = null;
  const clients = new Set();

  const fs = require("fs-extra");
  const matter = require("gray-matter");

  // simple debounced emitter map: relPath -> timeoutId
  const pendingEmits = new Map();

  function scheduleEmit(type, filePath) {
    const rel = path.relative(DATA_PATH, filePath);

    // clear existing timeout if any
    if (pendingEmits.has(rel)) {
      clearTimeout(pendingEmits.get(rel));
    }

    // debounce for 200ms to allow editors to finish writes
    const id = setTimeout(async () => {
      pendingEmits.delete(rel);

      // prepare payload
      let status = null;
      let frontmatter = null;
      let mtime = null;
      let lastUpdated = null;
      try {
        if (type !== "readme-removed" && (await fs.pathExists(filePath))) {
          const content = await fs.readFile(filePath, "utf8");
          const parsed = matter(content);
          frontmatter = parsed.data || null;
          status =
            parsed.data && parsed.data.status !== undefined
              ? parsed.data.status
              : null;

          // get file mtime and a best-effort lastUpdated (frontmatter.updatedAt or mtime)
          const stat = await fs.stat(filePath);
          mtime = stat.mtimeMs;
          lastUpdated = (frontmatter && frontmatter.updatedAt) || mtime;
        }
      } catch (err) {
        console.error(
          "[changes] Failed to read README for status:",
          filePath,
          err
        );
      }

      const payload = JSON.stringify({
        type,
        path: rel,
        status,
        frontmatter,
        mtime,
        lastUpdated,
      });

      console.log(`[changes] Emitting ${type} for ${rel} status=${status}`);

      for (const res of clients) {
        try {
          res.write(`event: readme\n`);
          res.write(`data: ${payload}\n\n`);
        } catch (err) {
          console.error("[changes] Failed to write SSE to a client", err);
        }
      }
    }, 200);

    pendingEmits.set(rel, id);
  }

  function ensureWatcher() {
    if (watcher) return;

    watcher = chokidar.watch(DATA_PATH, {
      ignored: /(^|[\/\\])\../, // ignore dotfiles
      persistent: true,
      ignoreInitial: true,
    });

    // Watch README.md changes and additions
    watcher.on("change", (filePath) => {
      if (path.basename(filePath).toLowerCase() === "readme.md") {
        scheduleEmit("readme-changed", filePath);
      }
    });

    watcher.on("add", (filePath) => {
      if (path.basename(filePath).toLowerCase() === "readme.md") {
        scheduleEmit("readme-added", filePath);
      }
    });

    watcher.on("unlink", (filePath) => {
      if (path.basename(filePath).toLowerCase() === "readme.md") {
        scheduleEmit("readme-removed", filePath);
      }
    });
  }

  // SSE endpoint
  router.get("/stream", (req, res) => {
    // Headers for SSE
    res.writeHead(200, {
      Connection: "keep-alive",
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
    });

    // Send a comment to keep the connection alive initially
    res.write(": connected\n\n");

    clients.add(res);
    ensureWatcher();

    // Clean up when client disconnects
    req.on("close", () => {
      clients.delete(res);
    });
  });

  return router;
};
