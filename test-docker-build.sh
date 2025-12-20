#!/bin/bash

# Docker 构建验证脚本
# 用于本地测试 Docker 镜像构建是否成功

set -e

echo "🔍 Docker 构建验证脚本"
echo "======================="
echo ""

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查Docker是否安装
check_docker() {
    echo -n "检查 Docker 是否安装... "
    if command -v docker &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
        docker --version
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}错误: 未找到 Docker。请先安装 Docker。${NC}"
        echo "下载地址: https://www.docker.com/get-started"
        exit 1
    fi
    echo ""
}

# 检查Docker是否运行
check_docker_running() {
    echo -n "检查 Docker 是否运行... "
    if docker info &> /dev/null; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
        echo -e "${RED}错误: Docker 未运行。请启动 Docker Desktop。${NC}"
        exit 1
    fi
    echo ""
}

# 构建Docker镜像
build_image() {
    echo "📦 开始构建 Docker 镜像..."
    echo ""
    
    # 记录开始时间
    start_time=$(date +%s)
    
    # 构建镜像
    if docker build -t psd-project-manager:test .; then
        echo ""
        echo -e "${GREEN}✓ 镜像构建成功！${NC}"
        
        # 计算耗时
        end_time=$(date +%s)
        duration=$((end_time - start_time))
        echo "构建耗时: ${duration}秒"
    else
        echo ""
        echo -e "${RED}✗ 镜像构建失败${NC}"
        exit 1
    fi
    echo ""
}

# 检查镜像大小
check_image_size() {
    echo "📊 镜像信息："
    docker images psd-project-manager:test --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}\t{{.CreatedAt}}"
    echo ""
}

# 测试运行容器
test_container() {
    echo "🧪 测试运行容器..."
    echo ""
    
    # 停止并删除已存在的测试容器
    docker rm -f psd-manager-test &> /dev/null || true
    
    # 启动测试容器
    echo "启动测试容器..."
    if docker run -d \
        --name psd-manager-test \
        -p 3001:3000 \
        psd-project-manager:test; then
        echo -e "${GREEN}✓ 容器启动成功${NC}"
    else
        echo -e "${RED}✗ 容器启动失败${NC}"
        exit 1
    fi
    echo ""
    
    # 等待服务启动
    echo -n "等待服务启动"
    sleep 5
    for i in {1..6}; do
        echo -n "."
        sleep 1
    done
    echo ""
    echo ""
    
    # 检查容器状态
    echo "容器状态："
    docker ps --filter name=psd-manager-test --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    echo ""
    
    # 检查容器日志
    echo "容器日志（最近10行）："
    echo "---"
    docker logs --tail 10 psd-manager-test
    echo "---"
    echo ""
    
    # 测试HTTP访问
    echo -n "测试 HTTP 访问... "
    if curl -s -f http://localhost:3001 > /dev/null; then
        echo -e "${GREEN}✓ 服务响应正常${NC}"
    else
        echo -e "${YELLOW}⚠ 服务可能未完全启动${NC}"
        echo "请手动访问 http://localhost:3001 验证"
    fi
    echo ""
}

# 清理
cleanup() {
    echo "🧹 清理测试环境..."
    
    read -p "是否删除测试容器？(y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker stop psd-manager-test &> /dev/null || true
        docker rm psd-manager-test &> /dev/null || true
        echo -e "${GREEN}✓ 测试容器已删除${NC}"
    fi
    
    read -p "是否删除测试镜像？(y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker rmi psd-project-manager:test &> /dev/null || true
        echo -e "${GREEN}✓ 测试镜像已删除${NC}"
    fi
    echo ""
}

# 主流程
main() {
    check_docker
    check_docker_running
    build_image
    check_image_size
    
    read -p "是否测试运行容器？(y/n) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        test_container
        echo -e "${GREEN}✓ 测试完成！${NC}"
        echo ""
        echo "访问地址: http://localhost:3001"
        echo ""
        cleanup
    else
        echo "跳过容器测试"
        echo ""
        read -p "是否删除测试镜像？(y/n) " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            docker rmi psd-project-manager:test &> /dev/null || true
            echo -e "${GREEN}✓ 测试镜像已删除${NC}"
        fi
    fi
    
    echo ""
    echo "====================================="
    echo -e "${GREEN}Docker 构建验证完成！${NC}"
    echo "====================================="
}

# 运行主流程
main
