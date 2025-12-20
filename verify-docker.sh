#!/bin/bash
# 验证 Docker 镜像中的前端文件

echo "=== 验证镜像配置 ==="
echo "1. 检查容器日志："
docker logs psd-project-manager --tail 50

echo ""
echo "2. 检查容器内前端文件是否存在："
docker exec psd-project-manager ls -la /app/frontend/dist/ 2>/dev/null || echo "❌ /app/frontend/dist 不存在"

echo ""
echo "3. 检查服务运行状态："
docker exec psd-project-manager curl -s http://localhost:3000/health || echo "❌ 健康检查失败"

echo ""
echo "4. 测试前端页面："
docker exec psd-project-manager curl -s http://localhost:3000/ | head -20 || echo "❌ 前端页面无法访问"

echo ""
echo "5. 检查 backend/server.js 中的前端路径配置："
docker exec psd-project-manager cat /app/backend/server.js | grep -A 5 "FRONTEND_DIST"

echo ""
echo "=== 完成 ==="
