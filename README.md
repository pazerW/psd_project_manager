# 设计文件项目管理器

[![Docker Build](https://github.com/YOUR_USERNAME/psd_project_manager/actions/workflows/docker-publish.yml/badge.svg)](https://github.com/YOUR_USERNAME/psd_project_manager/actions/workflows/docker-publish.yml)
[![Aliyun ACR](https://img.shields.io/badge/Aliyun-ACR-orange?logo=alibabacloud)](https://cr.console.aliyun.com/)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

一个本地优先的轻量级设计文件项目管理系统，专为设计工作流优化。支持 PSD、AI、图片等多种文件格式。

## 项目特性

### 🎯 核心功能
- **三级架构**：Project → Task → 设计文件的清晰层级管理
- **文件预览**：自动生成缩略图，支持Web端快速预览
- **分片上传**：支持大文件稳定上传，自动断点续传
- **Markdown集成**：任务说明、AI提示词等信息结构化管理
- **本地优先**：无需云端账户，基于文件系统的数据存储
- **多格式支持**：支持 PSD、AI、JPG、PNG、GIF、WebP、SVG、TIFF 等设计文件

### 🛠 技术架构
- **后端**：Node.js + Express
- **前端**：Vue 3 + Vue Router
- **图像处理**：Sharp + ImageMagick (支持 PSD/AI 缩略图生成)
- **文档解析**：gray-matter (Markdown frontmatter)
- **部署**：Docker + Docker Compose

### 📁 目录结构示例
```
data/
├── 项目A/
│   ├── README.md          # 项目级说明
│   ├── 任务1/
│   │   ├── README.md      # 任务说明和AI提示词
│   │   ├── design_v1.psd
│   │   └── design_v2.psd
│   └── 任务2/
│       ├── README.md
│       └── layout.psd
└── 项目B/
    └── ...
```

## 快速开始

### ⚡ 方式一：使用启动脚本（推荐）

使用智能启动脚本，一键启动整个开发环境：

```bash
# 启动完整开发环境（前端+后端）
./start.sh

# 或指定具体服务
./start.sh backend    # 仅启动后端
./start.sh frontend   # 仅启动前端
./start.sh build      # 构建项目
./start.sh docker     # Docker部署
./start.sh stop       # 停止所有服务
./start.sh status     # 查看服务状态
./start.sh restart    # 重启服务
```

**Windows用户：**
```cmd
start.bat            # 启动开发环境
start.bat help       # 查看帮助
```

**功能特性：**
- 🔍 自动依赖检查和安装
- 🚀 智能端口检测和占用处理
- 📊 服务状态监控和健康检查
- 🔄 一键重启和停止服务
- 📋 彩色日志输出和状态显示

### 方式二：传统npm命令

1. 安装依赖：
```bash
npm run install:all
```

2. 启动开发服务器：
```bash
npm run dev
```

3. 访问应用：
   - 前端：http://localhost:5173
   - 后端API：http://localhost:3000

#### 本地构建镜像

```bash
# 构建并启动
docker-compose up -d

# 或使用启动脚本
./start.sh docker
```

访问：http://localhost:3000


### 方式三：生产部署

1. 构建前端：
```bash
npm run build
# 或使用启动脚本
./start.sh build
```

2. 启动生产服务器：
```bash
npm start
```

## 配置说明

### 环境变量
- `DATA_PATH`: 数据目录路径（默认：`./data`）
- `PORT`: 后端服务端口（默认：`3000`）
- `NODE_ENV`: 环境模式

### SMB集成
项目支持SMB协议文件共享，用户可以：
1. 通过SMB客户端直接管理项目文件夹
2. 在iPad/电脑上编辑Markdown文档
3. 通过Web界面上传和预览PSD文件

#### macOS SMB挂载示例：
```bash
mkdir -p /Volumes/Projects
mount -t smbfs //username:password@server/projects /Volumes/Projects
```

#### Windows SMB挂载示例：
```cmd
net use Z: \\server\projects /persistent:yes
```

## API文档

### 项目管理
- `GET /api/projects` - 获取所有项目
- `GET /api/projects/:projectName` - 获取项目详情

### 任务管理  
- `GET /api/tasks/:projectName` - 获取项目任务列表
- `GET /api/tasks/:projectName/:taskName` - 获取任务详情
- `GET /api/tasks/:projectName/:taskName/files` - 获取任务文件列表

### 文件上传
- `POST /api/upload/chunk/:projectName/:taskName` - 分片上传
- `GET /api/upload/status/:uploadId` - 上传状态查询
- `DELETE /api/upload/cancel/:uploadId` - 取消上传

### PSD处理
- `GET /api/psd/thumbnail/:projectName/:taskName/:fileName` - 获取缩略图
- `GET /api/psd/download/:projectName/:taskName/:fileName` - 下载文件
- `DELETE /api/psd/:projectName/:taskName/:fileName` - 删除文件

## 部署建议

### NAS部署
推荐部署在群晖、威联通等NAS设备上：

1. 启用Docker功能
2. 创建项目目录并设置SMB共享
3. 使用docker-compose.yml部署
4. 配置端口转发和防火墙

### 网络配置
```yaml
# docker-compose.yml 网络示例
services:
  psd-manager:
    ports:
      - "8080:3000"  # 映射到NAS的8080端口
    volumes:
      - /volume1/projects:/app/data  # NAS存储路径
```

### 备份策略
- 定期备份data目录
- 缩略图缓存可以重新生成，不是必备备份内容
- 重要的是原始PSD文件和Markdown文档

## 故障排除

### Sharp模块问题
如果遇到Sharp安装或PSD处理问题：
```bash
npm rebuild sharp
```

### Docker构建问题
确保系统支持Sharp的本地编译：
```dockerfile
# 在Dockerfile中添加构建工具
RUN apk add --no-cache \
    vips-dev \
    build-base \
    python3
```

### 大文件上传失败
检查以下配置：
- Nginx上传大小限制
- Docker容器内存限制
- 磁盘空间是否充足

## 开发指南

### 项目结构
```
├── backend/           # Node.js后端
│   ├── routes/       # API路由
│   ├── server.js     # 服务器入口
│   └── package.json
├── frontend/         # Vue 3前端
│   ├── src/
│   │   ├── pages/   # 页面组件
│   │   └── App.vue
│   └── package.json
├── data/            # 数据目录（运行时创建）
├── Dockerfile
└── docker-compose.yml
```

### 添加新功能
1. 后端API：在`backend/routes/`中添加新路由
2. 前端页面：在`frontend/src/pages/`中创建组件
3. 路由配置：更新`frontend/src/main.js`

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request来改进项目！