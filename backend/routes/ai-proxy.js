const express = require("express");
const axios = require("axios");
const FormData = require("form-data");
const multer = require("multer");
const router = express.Router();

const AI_API_BASE = process.env.AI_API_BASE || "http://192.168.3.150:3001";

// 配置multer用于内存存储
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB限制
});

// 获取所有模板
router.get("/templates", async (req, res) => {
  try {
    const response = await axios.get(`${AI_API_BASE}/api/templates`);
    res.json(response.data);
  } catch (error) {
    console.error("Failed to fetch templates:", error.message);
    res.status(error.response?.status || 500).json({
      error:
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch templates",
    });
  }
});

// 应用模板
router.post(
  "/templates/:templateId/apply",
  upload.single("image"),
  async (req, res) => {
    try {
      const { templateId } = req.params;

      // 检查是否有文件上传
      if (req.file) {
        // 处理multipart数据
        const formData = new FormData();

        // 添加文本字段
        if (req.body.task_context) {
          formData.append("task_context", req.body.task_context);
        }
        if (req.body.custom_data) {
          formData.append("custom_data", req.body.custom_data);
        }
        if (req.body.metadata) {
          formData.append("metadata", req.body.metadata);
        }

        // 添加文件
        formData.append("image", req.file.buffer, {
          filename: req.file.originalname,
          contentType: req.file.mimetype,
        });

        const response = await axios.post(
          `${AI_API_BASE}/api/templates/${templateId}/apply`,
          formData,
          {
            headers: formData.getHeaders(),
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }
        );

        res.status(response.status).json(response.data);
      } else {
        // 处理JSON数据
        const response = await axios.post(
          `${AI_API_BASE}/api/templates/${templateId}/apply`,
          req.body,
          {
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        res.status(response.status).json(response.data);
      }
    } catch (error) {
      console.error("Failed to apply template:", error.message);
      res.status(error.response?.status || 500).json({
        error:
          error.response?.data?.error ||
          error.message ||
          "Failed to apply template",
      });
    }
  }
);

// 查询任务状态
router.get("/jobs/:jobId", async (req, res) => {
  try {
    const { jobId } = req.params;
    const response = await axios.get(
      `${AI_API_BASE}/api/templates/jobs/${jobId}`
    );
    res.json(response.data);
  } catch (error) {
    console.error("Failed to fetch job status:", error.message);
    res.status(error.response?.status || 500).json({
      error:
        error.response?.data?.error ||
        error.message ||
        "Failed to fetch job status",
    });
  }
});

module.exports = router;
