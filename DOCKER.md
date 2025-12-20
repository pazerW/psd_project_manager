# Docker 部署指南

## 快速开始

### 使用 Docker Hub 预构建镜像

```bash
# 1. 拉取镜像
docker pull <your-dockerhub-username>/psd-project-manager:latest

# 2. 创建数据目录
mkdir -p ./data

# 3. 运行容器
docker run -d \
  --name psd-manager \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  --restart unless-stopped \
  <your-dockerhub-username>/psd-project-manager:latest

# 4. 访问应用
# 打开浏览器访问 http://localhost:3000
```

### 使用 Docker Compose（推荐）

1. 创建 `docker-compose.yml` 文件（已包含在项目中）

2. 启动服务：
```bash
docker-compose up -d
```

3. 查看日志：
```bash
docker-compose logs -f
```

4. 停止服务：
```bash
docker-compose down
```

## 镜像标签

项目支持多个镜像标签：

- `latest` - 最新稳定版本（主分支）
- `v1.0.0`, `v1.0`, `v1` - 语义化版本标签
- `main` - 主分支最新构建
- `main-<commit-sha>` - 特定提交版本

### 使用特定版本

```bash
# 使用特定版本
docker pull <username>/psd-project-manager:v1.0.0

# 使用最新主分支版本
docker pull <username>/psd-project-manager:main
```

## 多架构支持

镜像支持以下架构：
- `linux/amd64` - Intel/AMD 处理器
- `linux/arm64` - ARM 处理器（Apple Silicon M1/M2）

Docker 会自动选择适合你系统的架构。

## 环境变量配置

```bash
docker run -d \
  --name psd-manager \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  -e DATA_PATH=/app/data \
  -e NODE_ENV=production \
  -e PORT=3000 \
  <username>/psd-project-manager:latest
```

### 可用环境变量

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `DATA_PATH` | `/app/data` | 数据存储目录 |
| `NODE_ENV` | `production` | 运行环境 |
| `PORT` | `3000` | 服务端口 |

## 数据持久化

### 本地目录挂载

```bash
docker run -d \
  -v /path/to/your/data:/app/data \
  <username>/psd-project-manager:latest
```

### Docker 卷（Volume）

```bash
# 创建卷
docker volume create psd-data

# 使用卷
docker run -d \
  -v psd-data:/app/data \
  <username>/psd-project-manager:latest
```

### SMB 网络存储

```yaml
# docker-compose.yml
version: '3.8'
services:
  psd-manager:
    image: <username>/psd-project-manager:latest
    ports:
      - "3000:3000"
    volumes:
      - type: bind
        source: /mnt/smb/projects
        target: /app/data
```

挂载 SMB：
```bash
# macOS
mount -t smbfs //user:pass@server/share /mnt/smb/projects

# Linux
mount -t cifs //server/share /mnt/smb/projects -o username=user,password=pass
```

## 健康检查

容器内置健康检查：

```bash
# 查看健康状态
docker inspect --format='{{.State.Health.Status}}' psd-manager

# 查看健康日志
docker inspect --format='{{json .State.Health}}' psd-manager | jq
```

## 日志管理

```bash
# 查看实时日志
docker logs -f psd-manager

# 查看最近100行日志
docker logs --tail 100 psd-manager

# 查看特定时间段日志
docker logs --since 30m psd-manager
```

## 更新镜像

```bash
# 1. 拉取最新镜像
docker pull <username>/psd-project-manager:latest

# 2. 停止并删除旧容器
docker stop psd-manager
docker rm psd-manager

# 3. 使用新镜像启动容器
docker run -d \
  --name psd-manager \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  <username>/psd-project-manager:latest

# 或使用 docker-compose
docker-compose pull
docker-compose up -d
```

## 备份和恢复

### 备份数据

```bash
# 备份数据目录
docker run --rm \
  -v psd-data:/data \
  -v $(pwd):/backup \
  alpine tar czf /backup/psd-data-backup-$(date +%Y%m%d).tar.gz -C /data .
```

### 恢复数据

```bash
# 恢复数据
docker run --rm \
  -v psd-data:/data \
  -v $(pwd):/backup \
  alpine tar xzf /backup/psd-data-backup-20231220.tar.gz -C /data
```

## 故障排查

### 容器无法启动

```bash
# 查看容器状态
docker ps -a

# 查看详细日志
docker logs psd-manager

# 检查端口占用
lsof -i :3000  # macOS/Linux
netstat -ano | findstr :3000  # Windows
```

### 权限问题

```bash
# 设置数据目录权限
chmod -R 755 ./data

# 在容器内检查
docker exec -it psd-manager ls -la /app/data
```

### 缩略图生成失败

```bash
# 检查 ImageMagick 是否正常
docker exec -it psd-manager magick --version

# 查看缩略图缓存
docker exec -it psd-manager ls -la /app/data/.thumbnails
```

## 性能优化

### 资源限制

```bash
docker run -d \
  --name psd-manager \
  --memory=2g \
  --cpus=2 \
  -p 3000:3000 \
  -v $(pwd)/data:/app/data \
  <username>/psd-project-manager:latest
```

### docker-compose 资源限制

```yaml
services:
  psd-manager:
    image: <username>/psd-project-manager:latest
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 2G
        reservations:
          cpus: '0.5'
          memory: 512M
```

## 生产环境建议

1. **使用反向代理**（Nginx/Caddy）
2. **配置 HTTPS**
3. **定期备份数据**
4. **监控容器状态**
5. **限制容器资源**
6. **使用 Docker Volume 而非绑定挂载**

### Nginx 反向代理示例

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        
        # 支持大文件上传
        client_max_body_size 500M;
    }
}
```
