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

# 获取或创建用户
USER_NAME="appuser"
if getent passwd ${PUID} >/dev/null 2>&1; then
    # UID 已存在，使用现有用户
    USER_NAME=$(getent passwd ${PUID} | cut -d: -f1)
    echo "Using existing user: $USER_NAME (UID: $PUID)"
elif getent passwd ${USER_NAME} >/dev/null 2>&1; then
    # appuser 存在但 UID 不同
    echo "User $USER_NAME exists with different UID, using existing user"
    USER_NAME=$(getent passwd ${USER_NAME} | cut -d: -f1)
else
    # 用户不存在，创建新用户
    echo "Creating user $USER_NAME with UID: $PUID"
    adduser -D -u ${PUID} -G ${GROUP_NAME} ${USER_NAME}
fi

# 确保数据目录存在
[ ! -d /app/data ] && mkdir -p /app/data
[ ! -d /app/logs ] && mkdir -p /app/logs
[ ! -d /app/uploads ] && mkdir -p /app/uploads

echo "Setting permissions on data directories..."
chown -R ${PUID}:${PGID} /app/data /app/logs /app/uploads 2>/dev/null || true

# 运行时替换前端环境变量
if [ -d "/app/backend/public" ]; then
    echo "Injecting runtime environment variables into frontend..."
    
    # 获取环境变量值，如果未设置则使用空字符串
    EXTERNAL_BASE="${VITE_EXTERNAL_DOWNLOAD_BASE:-}"
    INTERNAL_ORIGINS="${VITE_INTERNAL_ORIGINS:-}"
    
    echo "VITE_EXTERNAL_DOWNLOAD_BASE: $EXTERNAL_BASE"
    echo "VITE_INTERNAL_ORIGINS: $INTERNAL_ORIGINS"
    
    # 在所有 .js 文件中替换占位符（Vite会将变量名转为小写）
    # 同时支持大小写两种格式以确保完全替换
    find /app/backend/public/assets -type f -name "*.js" -exec sed -i \
        -e "s|__vite_external_download_base__|${EXTERNAL_BASE}|g" \
        -e "s|__VITE_EXTERNAL_DOWNLOAD_BASE__|${EXTERNAL_BASE}|g" \
        -e "s|__vite_internal_origins__|${INTERNAL_ORIGINS}|g" \
        -e "s|__VITE_INTERNAL_ORIGINS__|${INTERNAL_ORIGINS}|g" \
        {} \;
    
    echo "Environment variables injected successfully"
fi

echo "Starting application as $USER_NAME (UID: $PUID, GID: $PGID)..."

# 以指定用户运行命令
exec su-exec ${USER_NAME} "$@"
