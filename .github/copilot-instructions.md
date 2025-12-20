# PSD项目管理器 - GitHub Copilot 指令

## 项目概述
这是一个本地优先的PSD项目管理系统，采用Node.js + Express后端和Vue 3前端，支持Docker部署。

## 技术栈
- **后端**: Node.js, Express, Sharp (图像处理), gray-matter (Markdown解析)
- **前端**: Vue 3, Vue Router, Axios
- **部署**: Docker, Docker Compose

## 项目结构
- `backend/` - Node.js后端API
- `frontend/` - Vue 3前端应用
- `data/` - 文件系统数据存储
- `docker-compose.yml` - Docker部署配置

## 核心功能
- 三级架构：Project → Task → PSD文件
- PSD缩略图生成和预览
- 分片文件上传支持大文件
- Markdown文档集成（AI提示词等）
- SMB协议文件共享支持

## 开发指南
- 使用 `npm run dev` 启动开发服务器
- 前端: http://localhost:5173
- 后端API: http://localhost:3000
- 文档参考: README.md

所有任务已完成，项目可正常运行！