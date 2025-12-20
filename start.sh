#!/bin/bash

# PSD项目管理器启动脚本
# 用法: ./start.sh [backend|frontend|dev|build|docker]

set -e

# 颜色输出
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 日志函数
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查依赖
check_dependencies() {
    log_info "检查依赖..."
    
    if ! command -v node &> /dev/null; then
        log_error "Node.js 未安装"
        exit 1
    fi
    
    if ! command -v npm &> /dev/null; then
        log_error "npm 未安装"
        exit 1
    fi
    
    log_success "依赖检查完成"
}

# 检查端口是否被占用
check_port() {
    local port=$1
    if lsof -i :$port &> /dev/null; then
        return 0  # 端口被占用
    else
        return 1  # 端口空闲
    fi
}

# 停止现有服务
stop_services() {
    log_info "停止现有服务..."
    
    # 停止后端服务
    pkill -f "node.*server.js" 2>/dev/null || true
    
    # 停止前端服务
    pkill -f "vite" 2>/dev/null || true
    pkill -f "npm.*dev" 2>/dev/null || true
    
    sleep 2
    log_success "服务已停止"
}

# 安装依赖
install_deps() {
    log_info "检查并安装依赖..."
    
    if [ ! -d "node_modules" ]; then
        log_info "安装根目录依赖..."
        npm install
    fi
    
    if [ ! -d "backend/node_modules" ]; then
        log_info "安装后端依赖..."
        cd backend && npm install && cd ..
    fi
    
    if [ ! -d "frontend/node_modules" ]; then
        log_info "安装前端依赖..."
        cd frontend && npm install && cd ..
    fi
    
    log_success "依赖安装完成"
}

# 启动后端
start_backend() {
    log_info "启动后端服务..."
    
    if check_port 3000; then
        log_warning "端口3000已被占用，正在停止现有服务..."
        pkill -f "node.*server.js" 2>/dev/null || true
        sleep 2
    fi
    
    cd backend
    nohup node server.js > ../logs/backend.log 2>&1 &
    cd ..
    
    sleep 3
    
    if check_port 3000; then
        log_success "后端服务已启动 (http://localhost:3000)"
        # 测试健康检查
        if curl -s http://localhost:3000/health > /dev/null; then
            log_success "后端健康检查通过"
        else
            log_warning "后端健康检查失败"
        fi
    else
        log_error "后端服务启动失败"
        return 1
    fi
}

# 启动前端
start_frontend() {
    log_info "启动前端服务..."
    
    cd frontend
    
    # 查找可用端口
    local port=5173
    while check_port $port; do
        log_warning "端口 $port 被占用，尝试端口 $((port + 1))"
        port=$((port + 1))
    done
    
    if [ $port -ne 5173 ]; then
        log_info "使用端口 $port"
        VITE_PORT=$port nohup npm run dev > ../logs/frontend.log 2>&1 &
    else
        nohup npm run dev > ../logs/frontend.log 2>&1 &
    fi
    
    cd ..
    
    sleep 5
    
    if check_port $port; then
        log_success "前端服务已启动 (http://localhost:$port)"
    else
        log_error "前端服务启动失败"
        return 1
    fi
}

# 构建项目
build_project() {
    log_info "构建项目..."
    
    install_deps
    
    log_info "构建前端..."
    cd frontend
    npm run build
    cd ..
    
    log_success "项目构建完成"
}

# Docker启动
start_docker() {
    log_info "使用Docker启动..."
    
    if ! command -v docker &> /dev/null; then
        log_error "Docker 未安装"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        log_error "Docker Compose 未安装"
        exit 1
    fi
    
    log_info "构建Docker镜像..."
    docker-compose build
    
    log_info "启动Docker容器..."
    docker-compose up -d
    
    sleep 5
    
    log_success "Docker服务已启动"
    log_info "访问地址: http://localhost:3000"
}

# 显示状态
show_status() {
    log_info "服务状态:"
    
    if check_port 3000; then
        log_success "✓ 后端服务运行中 (端口 3000)"
    else
        log_warning "✗ 后端服务未运行"
    fi
    
    local frontend_port=""
    for port in 5173 5174 5175 5176 5177; do
        if check_port $port; then
            frontend_port=$port
            break
        fi
    done
    
    if [ -n "$frontend_port" ]; then
        log_success "✓ 前端服务运行中 (端口 $frontend_port)"
        echo -e "  ${GREEN}前端访问地址: http://localhost:$frontend_port${NC}"
        echo -e "  ${GREEN}后端API地址: http://localhost:3000${NC}"
    else
        log_warning "✗ 前端服务未运行"
    fi
}

# 创建日志目录
mkdir -p logs

# 主逻辑
case "${1:-dev}" in
    "backend")
        check_dependencies
        install_deps
        start_backend
        show_status
        ;;
    "frontend")
        check_dependencies
        install_deps
        start_frontend
        show_status
        ;;
    "dev")
        check_dependencies
        stop_services
        install_deps
        start_backend
        start_frontend
        show_status
        ;;
    "build")
        check_dependencies
        build_project
        ;;
    "docker")
        start_docker
        ;;
    "stop")
        stop_services
        ;;
    "status")
        show_status
        ;;
    "restart")
        stop_services
        $0 dev
        ;;
    "help"|"--help"|"-h")
        echo "PSD项目管理器启动脚本"
        echo ""
        echo "用法: ./start.sh [命令]"
        echo ""
        echo "命令:"
        echo "  dev      - 启动开发环境 (默认)"
        echo "  backend  - 仅启动后端服务"
        echo "  frontend - 仅启动前端服务"
        echo "  build    - 构建项目"
        echo "  docker   - 使用Docker启动"
        echo "  stop     - 停止所有服务"
        echo "  restart  - 重启服务"
        echo "  status   - 查看服务状态"
        echo "  help     - 显示帮助"
        echo ""
        echo "示例:"
        echo "  ./start.sh           # 启动开发环境"
        echo "  ./start.sh backend   # 仅启动后端"
        echo "  ./start.sh stop      # 停止服务"
        ;;
    *)
        log_error "未知命令: $1"
        echo "使用 './start.sh help' 查看帮助"
        exit 1
        ;;
esac