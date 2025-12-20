#!/bin/sh
set -e

# 默认值
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting with UID: $PUID, GID: $PGID"

# 创建组（如果不存在）
if ! getent group appgroup >/dev/null 2>&1; then
    echo "Creating group appgroup with GID: $PGID"
    addgroup -g ${PGID} appgroup
fi

# 创建用户（如果不存在）
if ! getent passwd appuser >/dev/null 2>&1; then
    echo "Creating user appuser with UID: $PUID"
    adduser -D -u ${PUID} -G appgroup appuser
fi

# 确保数据目录存在并设置权限
mkdir -p /app/data /app/logs /app/uploads

echo "Setting permissions on data directories..."
chown -R ${PUID}:${PGID} /app/data /app/logs /app/uploads 2>/dev/null || true

# 如果挂载的目录权限有问题，尝试修复（但不强制）
if [ -d "/app/data" ]; then
    chown ${PUID}:${PGID} /app/data 2>/dev/null || echo "Warning: Could not change ownership of /app/data"
fi
if [ -d "/app/logs" ]; then
    chown ${PUID}:${PGID} /app/logs 2>/dev/null || echo "Warning: Could not change ownership of /app/logs"
fi
if [ -d "/app/uploads" ]; then
    chown ${PUID}:${PGID} /app/uploads 2>/dev/null || echo "Warning: Could not change ownership of /app/uploads"
fi

echo "Starting application as appuser (UID: $PUID, GID: $PGID)..."

# 以指定用户运行命令
exec su-exec appuser "$@"
