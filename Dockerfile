# 使用官方Node.js镜像作为基础镜像
FROM node:18-alpine

# 安装ImageMagick和其他系统依赖（用于PSD/AI文件缩略图生成）
RUN apk add --no-cache \
    imagemagick \
    imagemagick-dev \
    ghostscript \
    python3 \
    make \
    g++ \
    vips-dev \
    curl \
    su-exec

# 设置工作目录
WORKDIR /app

# 复制项目文件
COPY package*.json ./
COPY backend/package*.json ./backend/
COPY frontend/package*.json ./frontend/

# 安装依赖
RUN npm install && \
    cd backend && npm install && \
    cd ../frontend && npm install

# 复制源代码
COPY . .

# 构建前端
RUN cd frontend && npm run build

# 创建数据目录
RUN mkdir -p /app/data /app/logs /app/uploads

# 暴露端口（生产环境只需要后端端口）
EXPOSE 3000

# 设置环境变量
ENV DATA_PATH=/app/data
ENV NODE_ENV=production
ENV PUID=1000
ENV PGID=1000

# 复制启动脚本
COPY docker-entrypoint.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# 启动命令
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["npm", "start"]