# GitHub Actions 工作流说明

## Docker 镜像构建和发布

### 配置步骤

1. **设置 Docker Hub Secrets**
   
   在 GitHub 仓库中配置以下 Secrets：
   - `Settings` → `Secrets and variables` → `Actions` → `New repository secret`
   
   需要添加的 Secrets：
   - `DOCKER_USERNAME`: 你的 Docker Hub 用户名
   - `DOCKER_PASSWORD`: 你的 Docker Hub 访问令牌（推荐）或密码

2. **创建 Docker Hub 访问令牌**
   
   - 登录 Docker Hub: https://hub.docker.com/
   - 进入 `Account Settings` → `Security` → `New Access Token`
   - 创建一个新令牌（推荐权限：Read & Write）
   - 复制令牌并保存到 GitHub Secrets 的 `DOCKER_PASSWORD`

3. **触发方式**
   
   工作流会在以下情况自动触发：
   - 推送到 `main` 或 `master` 分支 → 构建 `latest` 标签
   - 推送版本标签（如 `v1.0.0`） → 构建版本标签
   - 创建 Pull Request → 仅构建测试（不推送）
   - 手动触发：在 Actions 页面点击 `Run workflow`

4. **版本发布**
   
   创建新版本：
   ```bash
   git tag -a v1.0.0 -m "Release version 1.0.0"
   git push origin v1.0.0
   ```
   
   这会自动构建并推送以下标签：
   - `username/psd-project-manager:1.0.0`
   - `username/psd-project-manager:1.0`
   - `username/psd-project-manager:1`
   - `username/psd-project-manager:latest`

### 镜像使用

构建完成后，可以通过以下方式使用：

```bash
# 拉取最新版本
docker pull <your-username>/psd-project-manager:latest

# 拉取特定版本
docker pull <your-username>/psd-project-manager:1.0.0

# 运行容器
docker run -d \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  <your-username>/psd-project-manager:latest
```

### 多架构支持

工作流配置了多架构构建：
- `linux/amd64` - 适用于 Intel/AMD 处理器
- `linux/arm64` - 适用于 ARM 处理器（如 Apple Silicon M1/M2）

### 缓存优化

使用 GitHub Actions 缓存来加速构建过程，后续构建会复用之前的层。
