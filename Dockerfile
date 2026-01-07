# ====== 阶段1: 前端构建 ======
FROM node:18-alpine AS frontend-builder

# 安装构建依赖
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

WORKDIR /app/frontend

# 复制包管理文件
COPY frontend/package*.json ./

# 安装依赖（使用国内镜像加速）
RUN npm config set registry https://registry.npmmirror.com && \
    npm install --verbose --frozen-lockfile

# 复制源代码
COPY frontend/ ./

# 创建 .env 文件或设置环境变量
RUN echo "VITE_EXTERNAL_DOWNLOAD_BASE=__vite_external_download_base__" > .env.production && \
    echo "VITE_INTERNAL_ORIGINS=__vite_internal_origins__" >> .env.production

# 执行构建
RUN npm run build

# 清理
RUN rm -rf node_modules .npm

# ====== 阶段2: 最终运行镜像 ======
FROM node:18-alpine

# 构建参数
ARG BUILD_VERSION=unknown
ARG BUILD_DATE=unknown
ARG GIT_COMMIT=unknown

# 安装运行时依赖
RUN apk add --no-cache \
    imagemagick \
    ghostscript \
    vips \
    curl \
    su-exec \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# 复制后端依赖文件
COPY package*.json ./
COPY backend/package*.json ./backend/

# 安装后端依赖
RUN npm config set registry https://registry.npmmirror.com && \
    npm ci --only=production --verbose && \
    cd backend && npm ci --only=production --verbose && \
    cd .. && \
    npm cache clean --force && \
    rm -rf ~/.npm ~/.node-gyp

# 复制后端代码
COPY backend/ ./backend/

# 从前端构建阶段复制构建产物
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# 复制启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 创建目录
RUN mkdir -p /app/data /app/logs /app/uploads && \
    chown -R node:node /app

# 切换到非root用户
USER node

# 暴露端口
EXPOSE 3000

# 环境变量
ENV DATA_PATH=/app/data \
    NODE_ENV=production \
    VERSION=${BUILD_VERSION} \
    BUILD_DATE=${BUILD_DATE} \
    GIT_COMMIT=${GIT_COMMIT} \
    IMAGE_NAME=registry.cn-beijing.aliyuncs.com/pazerwong/design_project_management

# 启动命令
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]