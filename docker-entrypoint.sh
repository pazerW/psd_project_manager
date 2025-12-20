#!/bin/sh
set -e

# 默认值
PUID=${PUID:-1000}
PGID=${PGID:-1000}

echo "Starting with UID: $PUID, GID: $PGID"

# 获取或创建组
GROUP_NAME="appgroup"
if getent group ${PGID} >/dev/null 2>&1; then
    # GID 已存在，使用现有的组
    GROUP_NAME=$(getent group ${PGID} | cut -d: -f1)
    echo "Using existing group: $GROUP_NAME (GID: $PGID)"
else
    # GID 不存在，创建新组
    echo "Creating group $GROUP_NAME with GID: $PGID"
    addgroup -g ${PGID} ${GROUP_NAME}
fi

# 创建用户（如果不存在）
if ! getent passwd appuser >/dev/null 2>&1; then
    echo "Creating user appuser with UID: $PUID"
    adduser -D -u ${PUID} -G ${GROUP_NAME} appuser
elif ! id -nG appuser | grep -qw ${GROUP_NAME}; then
    # 用户存在但不在正确的组中
    echo "Adding appuser to group ${GROUP_NAME}"
    addgroup appuser ${GROUP_NAME} 2>/dev/null || true
fi

# 确保数据目录存在
mkdir -p /app/data /app/logs /app/uploads

echo "Setting permissions on data directories..."
chown -R ${PUID}:${PGID} /app/data /app/logs /app/uploads 2>/dev/null || true

echo "Starting application as appuser (UID: $PUID, GID: $PGID)..."

# 以指定用户运行命令
exec su-exec appuser "$@"
