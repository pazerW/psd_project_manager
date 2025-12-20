#!/bin/bash
# 在 QNAP 上执行此脚本进行调试

echo "=== 1. 检查 Node.js 进程是否运行 ==="
docker exec psd-project-manager ps aux | grep node

echo ""
echo "=== 2. 检查端口 3000 是否监听 ==="
docker exec psd-project-manager netstat -tlnp 2>/dev/null | grep 3000 || echo "netstat 不可用，尝试其他方法"

echo ""
echo "=== 3. 检查容器日志（最后 30 行） ==="
docker logs psd-project-manager --tail 30

echo ""
echo "=== 4. 测试端口连接 ==="
docker exec psd-project-manager sh -c "echo 'GET / HTTP/1.1' | nc localhost 3000" 2>/dev/null | head -10 || echo "nc 不可用"

echo ""
echo "=== 5. 直接从宿主机测试端口 ==="
nc -zv 192.168.3.150 3000 || curl -v http://192.168.3.150:3000/health || echo "无法连接"

echo ""
echo "=== 完成 ==="
