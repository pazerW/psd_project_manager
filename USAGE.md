# 使用指南

## 启动脚本详解

本项目提供了智能启动脚本 `start.sh` (macOS/Linux) 和 `start.bat` (Windows)，让您能够快速启动和管理PSD项目管理器。

### 基本使用

```bash
# 启动完整开发环境
./start.sh

# 查看帮助
./start.sh help
```

### 命令参考

| 命令 | 功能 | 示例 |
|------|------|------|
| `dev` | 启动完整开发环境 (默认) | `./start.sh dev` |
| `backend` | 仅启动后端服务 | `./start.sh backend` |
| `frontend` | 仅启动前端服务 | `./start.sh frontend` |
| `build` | 构建生产版本 | `./start.sh build` |
| `docker` | Docker部署 | `./start.sh docker` |
| `stop` | 停止所有服务 | `./start.sh stop` |
| `restart` | 重启服务 | `./start.sh restart` |
| `status` | 查看服务状态 | `./start.sh status` |

### 智能功能

#### 🔍 依赖检查
启动脚本会自动检查：
- Node.js 是否已安装
- npm 是否已安装  
- 项目依赖是否完整

如果发现缺失的依赖，会自动安装：
```bash
[INFO] 检查并安装依赖...
[INFO] 安装后端依赖...
[INFO] 安装前端依赖...
[SUCCESS] 依赖安装完成
```

#### 🚀 端口管理
启动脚本智能处理端口冲突：
- 自动检测端口占用情况
- 如果端口被占用，会先停止现有服务
- 前端服务支持自动寻找可用端口

```bash
[WARNING] 端口3000已被占用，正在停止现有服务...
[WARNING] 端口 5173 被占用，尝试端口 5174
[SUCCESS] 前端服务已启动 (http://localhost:5174)
```

#### 📊 健康检查
启动后会自动进行健康检查：
```bash
[SUCCESS] 后端服务已启动 (http://localhost:3000)
[SUCCESS] 后端健康检查通过
```

#### 🔄 服务管理
轻松管理服务生命周期：
```bash
# 查看当前状态
./start.sh status
# 输出：
# [SUCCESS] ✓ 后端服务运行中 (端口 3000)
# [SUCCESS] ✓ 前端服务运行中 (端口 5173)
#   前端访问地址: http://localhost:5173
#   后端API地址: http://localhost:3000

# 停止所有服务
./start.sh stop

# 重启服务
./start.sh restart
```

### 开发工作流

#### 日常开发
```bash
# 启动开发环境
./start.sh dev

# 当需要重启时
./start.sh restart

# 结束工作时停止服务
./start.sh stop
```

#### 调试单个服务
```bash
# 只启动后端进行API调试
./start.sh backend

# 在另一个终端启动前端
./start.sh frontend
```

#### 构建和部署
```bash
# 构建生产版本
./start.sh build

# 使用Docker部署
./start.sh docker
```

## 文件系统使用

### 项目结构创建

使用系统文件管理器或SMB共享创建项目结构：

```
data/
├── 电商网站设计/
│   ├── README.md
│   ├── 首页设计/
│   │   ├── README.md
│   │   ├── 首页_桌面版.psd
│   │   └── 首页_移动版.psd
│   └── 产品页设计/
│       ├── README.md
│       └── 产品详情页.psd
```

### Markdown文档格式

项目级README.md示例：
```markdown
---
title: 电商网站设计
description: 现代化电商平台UI设计
tags: [电商, UI设计, 响应式]
created: 2024-01-15
---

# 电商网站设计项目

## 项目概述
设计一个现代化的电商网站，包含首页、产品页、购物车等核心页面。

## 设计要求
- 响应式设计
- 现代简洁风格
- 用户体验友好

## 任务列表
- [x] 首页设计
- [ ] 产品页设计  
- [ ] 购物车页面
```

任务级README.md示例：
```markdown
---
title: 首页设计
status: in-progress
priority: high
ai_prompt: |
  设计一个电商网站首页，要求：
  1. 顶部导航栏
  2. 轮播图区域
  3. 产品分类导航
  4. 推荐商品展示
  5. 底部链接区域
  
  风格要求：现代简洁，色彩搭配和谐
---

# 首页设计任务

## 设计要点
- 突出品牌形象
- 引导用户浏览商品
- 优化转化率

## 文件说明
- `首页_桌面版.psd` - 桌面端设计
- `首页_移动版.psd` - 移动端设计
```

## Web界面使用

### 导航结构
- 首页：显示所有项目
- 项目详情页：显示项目下的任务列表
- 任务详情页：显示任务文件和文档

### 文件上传
1. 进入目标任务页面
2. 点击上传按钮
3. 选择PSD文件
4. 系统自动分片上传，支持大文件
5. 上传完成后自动生成缩略图

### 文件管理
- 预览：点击缩略图查看大图
- 下载：点击下载按钮
- 删除：点击删除按钮（需确认）

## SMB集成使用

### macOS连接
```bash
# 方式一：Finder连接
# 1. 打开Finder
# 2. 按Cmd+K
# 3. 输入 smb://your-server-ip
# 4. 选择共享文件夹

# 方式二：命令行挂载
sudo mkdir -p /Volumes/PSPProjects
sudo mount -t smbfs //username:password@server/psd-data /Volumes/Projects
```

### Windows连接
```cmd
REM 映射网络驱动器
net use P: \\server-ip\psd-data /persistent:yes
```

### iPad/移动设备
1. 使用Files应用
2. 连接到服务器
3. 输入SMB地址和凭据
4. 可直接编辑Markdown文档

## 常见问题

### Q: 启动脚本权限问题
```bash
# 解决方案：添加执行权限
chmod +x start.sh
```

### Q: 端口被占用
```bash
# 查看端口占用
lsof -i :3000
lsof -i :5173

# 使用启动脚本自动处理
./start.sh stop
./start.sh dev
```

### Q: PSD缩略图不显示
1. 检查ImageMagick是否安装
2. 检查Sharp模块是否正常
3. 查看后端日志：`tail -f logs/backend.log`

### Q: 大文件上传失败
1. 检查磁盘空间
2. 确认网络稳定性
3. 文件大小是否超出限制

### Q: Docker部署问题
```bash
# 重新构建镜像
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

## 性能优化建议

### 系统配置
- 为data目录配置SSD存储
- 适当增加Node.js内存限制
- 配置反向代理（Nginx）

### 文件管理
- 定期清理不需要的PSD文件
- 缩略图缓存可以安全删除（会重新生成）
- 考虑文件版本管理策略

### 网络优化
- 配置CDN加速静态资源
- 启用gzip压缩
- 优化图片格式和大小