# ====== 阶段1: 前端构建 ======
FROM node:18-alpine AS frontend-builder

WORKDIR /app/frontend

# 只复制前端相关文件
COPY frontend/package*.json ./
RUN npm ci --only=production && npm cache clean --force

COPY frontend/ ./

# 构建前端
RUN VITE_EXTERNAL_DOWNLOAD_BASE='__vite_external_download_base__' \
    VITE_INTERNAL_ORIGINS='__vite_internal_origins__' \
    npm run build

# ====== 阶段2: 最终运行镜像 ======
FROM node:18-alpine

# 构建参数
ARG BUILD_VERSION=unknown
ARG BUILD_DATE=unknown
ARG GIT_COMMIT=unknown

# 安装运行时依赖（移除构建工具）
RUN apk add --no-cache \
    imagemagick \
    ghostscript \
    vips \
    curl \
    su-exec \
    && rm -rf /var/cache/apk/*

# 设置工作目录
WORKDIR /app

# 只复制必要的package.json
COPY package*.json ./
COPY backend/package*.json ./backend/

# 只安装生产依赖并清理缓存
RUN npm ci --only=production && \
    cd backend && npm ci --only=production && \
    npm cache clean --force && \
    rm -rf ~/.npm

# 复制后端源代码
COPY backend/ ./backend/

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 复制启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 创建数据目录
RUN mkdir -p /app/data /app/logs /app/uploads

# 暴露端口
EXPOSE 3000

# 设置环境变量
ENV DATA_PATH=/app/data \
    NODE_ENV=production \
    PUID=1000 \
    PGID=1000 \
    VERSION=${BUILD_VERSION} \
    BUILD_DATE=${BUILD_DATE} \
    GIT_COMMIT=${GIT_COMMIT} \
    IMAGE_NAME=registry.cn-beijing.aliyuncs.com/pazerwong/design_project_management

# 启动命令
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]