# GitHub Actions + Docker Hub 自动化部署配置总结

## ✅ 已完成的配置

### 1. GitHub Actions 工作流
- ✅ 创建 `.github/workflows/docker-publish.yml`
- ✅ 配置多架构构建（amd64 + arm64）
- ✅ 配置自动标签生成
- ✅ 配置构建缓存优化
- ✅ 支持手动触发

### 2. Docker 配置
- ✅ 优化 `Dockerfile`，添加 ImageMagick 支持
- ✅ 创建 `.dockerignore` 优化构建
- ✅ 更新 `docker-compose.yml`
- ✅ 添加 npm 脚本支持

### 3. 文档
- ✅ 创建 `GITHUB_ACTIONS_SETUP.md` - 详细配置指南
- ✅ 创建 `DOCKER.md` - Docker 部署完整指南
- ✅ 创建 `.github/workflows/README.md` - 工作流说明
- ✅ 更新主 `README.md` - 添加 Docker Hub 使用说明
- ✅ 创建 `test-docker-build.sh` - 本地测试脚本

### 4. 功能特性
- ✅ 自动构建触发（推送代码/创建标签）
- ✅ 语义化版本管理
- ✅ 多架构镜像支持
- ✅ 构建缓存加速
- ✅ 自动推送到 Docker Hub

## 📋 使用步骤

### 第一次配置（一次性）

1. **Fork 项目到你的 GitHub 账号**

2. **在 Docker Hub 创建访问令牌**
   - 访问：https://hub.docker.com/settings/security
   - 创建 `Read & Write` 权限的令牌

3. **在 GitHub 仓库配置 Secrets**
   - 进入：`Settings` → `Secrets and variables` → `Actions`
   - 添加两个 Secret：
     - `DOCKER_USERNAME`: Docker Hub 用户名
     - `DOCKER_PASSWORD`: Docker Hub 访问令牌

4. **更新 README 徽章（可选）**
   - 将 `YOUR_USERNAME` 替换为你的用户名

详细步骤见：[GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md)

### 日常使用

#### 方式1：推送代码自动构建
```bash
git add .
git commit -m "Update features"
git push origin main
# → 自动构建并推送 latest 标签
```

#### 方式2：发布版本
```bash
git tag -a v1.0.0 -m "Release v1.0.0"
git push origin v1.0.0
# → 自动构建并推送多个版本标签
```

#### 方式3：手动触发
- GitHub 仓库 → `Actions` → `Docker Build and Push` → `Run workflow`

## 🎯 自动生成的镜像标签

### 推送主分支时
- `username/psd-project-manager:latest`
- `username/psd-project-manager:main`
- `username/psd-project-manager:main-<commit-sha>`

### 推送版本标签时（如 v1.2.3）
- `username/psd-project-manager:1.2.3`
- `username/psd-project-manager:1.2`
- `username/psd-project-manager:1`
- `username/psd-project-manager:latest`

## 🚀 使用构建的镜像

### 快速启动
```bash
docker pull <your-username>/psd-project-manager:latest
docker run -d -p 3000:3000 -v $(pwd)/data:/app/data <your-username>/psd-project-manager:latest
```

### 使用 docker-compose
```bash
# 修改 docker-compose.yml 中的镜像名
image: <your-username>/psd-project-manager:latest

# 启动
docker-compose up -d
```

## 🔧 本地测试（无需 Docker）

如果本地没有 Docker，可以查看 GitHub Actions 构建日志：
1. 进入 GitHub 仓库
2. 点击 `Actions` 标签
3. 选择最新的工作流运行
4. 查看详细日志和构建结果

## 📊 工作流特性

| 特性 | 说明 |
|------|------|
| 多架构支持 | linux/amd64, linux/arm64 |
| 自动标签 | 基于分支、标签、commit 自动生成 |
| 构建缓存 | GitHub Actions 缓存加速构建 |
| 安全性 | 使用 Secrets 保护凭证 |
| 手动触发 | 支持 workflow_dispatch |
| PR 测试 | PR 时仅构建不推送 |

## 📁 文件结构

```
.
├── .github/
│   ├── workflows/
│   │   ├── docker-publish.yml      # GitHub Actions 工作流
│   │   └── README.md               # 工作流说明
│   └── copilot-instructions.md     # Copilot 指令
├── .dockerignore                   # Docker 构建忽略文件
├── Dockerfile                      # Docker 镜像定义
├── docker-compose.yml              # Docker Compose 配置
├── GITHUB_ACTIONS_SETUP.md         # 配置指南（本文件）
├── DOCKER.md                       # Docker 部署指南
├── test-docker-build.sh            # 本地测试脚本
└── README.md                       # 主文档
```

## 🐛 故障排查

### 工作流失败
1. 检查 Actions 日志
2. 验证 Secrets 配置
3. 确认 Docker Hub 令牌有效

### 镜像推送失败
1. 检查 Docker Hub 用户名是否正确
2. 验证令牌权限（需要 Read & Write）
3. 确认仓库名称匹配

详见：[GITHUB_ACTIONS_SETUP.md](GITHUB_ACTIONS_SETUP.md#故障排查)

## 📚 相关资源

- [Docker 部署完整指南](DOCKER.md)
- [GitHub Actions 配置指南](GITHUB_ACTIONS_SETUP.md)
- [工作流说明](.github/workflows/README.md)
- [项目主文档](README.md)

## 🎉 快速验证

配置完成后，可以通过以下方式验证：

1. **查看 Actions 运行状态**
   ```
   https://github.com/YOUR_USERNAME/psd_project_manager/actions
   ```

2. **查看 Docker Hub 镜像**
   ```
   https://hub.docker.com/r/YOUR_USERNAME/psd-project-manager
   ```

3. **本地拉取测试**
   ```bash
   docker pull YOUR_USERNAME/psd-project-manager:latest
   docker run -d -p 3000:3000 YOUR_USERNAME/psd-project-manager:latest
   ```

## 💡 最佳实践

1. **版本管理**
   - 使用语义化版本：v1.0.0, v1.1.0, v2.0.0
   - 主分支保持稳定
   - 使用分支开发新功能

2. **安全性**
   - 定期更新 Docker Hub 令牌
   - 不要在代码中硬编码凭证
   - 使用 GitHub Secrets 管理敏感信息

3. **性能优化**
   - 利用构建缓存
   - 优化 Dockerfile 层次
   - 使用 .dockerignore 减小构建上下文

4. **监控**
   - 定期检查 Actions 执行情况
   - 监控镜像拉取统计
   - 及时处理构建失败

---

**配置完成！🎊**

现在你的项目已经配置了完整的 CI/CD 流程，每次提交代码或创建标签时，都会自动构建并推送 Docker 镜像到 Docker Hub！
