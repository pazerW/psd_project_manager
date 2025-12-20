@echo off
chcp 65001 > nul
setlocal enabledelayedexpansion

:: PSD项目管理器启动脚本 (Windows)
:: 用法: start.bat [backend|frontend|dev|build|stop]

set "command=%~1"
if "%command%"=="" set "command=dev"

:: 颜色定义 (Windows 10+)
set "RED=[31m"
set "GREEN=[32m"
set "YELLOW=[33m"
set "BLUE=[34m"
set "NC=[0m"

:: 日志函数
call :log_info "PSD项目管理器启动脚本"

:: 检查Node.js
where node > nul 2>&1
if %errorlevel% neq 0 (
    call :log_error "Node.js 未安装"
    exit /b 1
)

:: 检查npm
where npm > nul 2>&1
if %errorlevel% neq 0 (
    call :log_error "npm 未安装"
    exit /b 1
)

:: 创建日志目录
if not exist logs mkdir logs

goto %command% 2>nul || goto unknown

:dev
    call :log_info "启动开发环境..."
    call :stop_services
    call :install_deps
    call :start_backend
    timeout /t 3 /nobreak > nul
    call :start_frontend
    call :show_status
    goto end

:backend
    call :log_info "启动后端服务..."
    call :install_deps
    call :start_backend
    call :show_status
    goto end

:frontend
    call :log_info "启动前端服务..."
    call :install_deps
    call :start_frontend
    call :show_status
    goto end

:build
    call :log_info "构建项目..."
    call :install_deps
    cd frontend
    call npm run build
    cd ..
    call :log_success "项目构建完成"
    goto end

:stop
    call :stop_services
    goto end

:status
    call :show_status
    goto end

:restart
    call :stop_services
    call :dev
    goto end

:help
    echo PSD项目管理器启动脚本 ^(Windows^)
    echo.
    echo 用法: start.bat [命令]
    echo.
    echo 命令:
    echo   dev      - 启动开发环境 ^(默认^)
    echo   backend  - 仅启动后端服务
    echo   frontend - 仅启动前端服务
    echo   build    - 构建项目
    echo   stop     - 停止所有服务
    echo   restart  - 重启服务
    echo   status   - 查看服务状态
    echo   help     - 显示帮助
    echo.
    echo 示例:
    echo   start.bat           # 启动开发环境
    echo   start.bat backend   # 仅启动后端
    echo   start.bat stop      # 停止服务
    goto end

:unknown
    call :log_error "未知命令: %command%"
    echo 使用 'start.bat help' 查看帮助
    exit /b 1

:: 函数定义

:log_info
    echo %BLUE%[INFO]%NC% %~1
    exit /b

:log_success
    echo %GREEN%[SUCCESS]%NC% %~1
    exit /b

:log_warning
    echo %YELLOW%[WARNING]%NC% %~1
    exit /b

:log_error
    echo %RED%[ERROR]%NC% %~1
    exit /b

:stop_services
    call :log_info "停止现有服务..."
    taskkill /f /im node.exe 2>nul || echo.
    timeout /t 2 /nobreak > nul
    call :log_success "服务已停止"
    exit /b

:install_deps
    call :log_info "检查并安装依赖..."
    
    if not exist node_modules (
        call :log_info "安装根目录依赖..."
        call npm install
    )
    
    if not exist backend\node_modules (
        call :log_info "安装后端依赖..."
        cd backend
        call npm install
        cd ..
    )
    
    if not exist frontend\node_modules (
        call :log_info "安装前端依赖..."
        cd frontend
        call npm install
        cd ..
    )
    
    call :log_success "依赖安装完成"
    exit /b

:start_backend
    call :log_info "启动后端服务..."
    cd backend
    start "Backend Server" /min cmd /c "node server.js > ..\logs\backend.log 2>&1"
    cd ..
    timeout /t 3 /nobreak > nul
    call :log_success "后端服务已启动 (http://localhost:3000)"
    exit /b

:start_frontend
    call :log_info "启动前端服务..."
    cd frontend
    start "Frontend Server" /min cmd /c "npm run dev > ..\logs\frontend.log 2>&1"
    cd ..
    timeout /t 3 /nobreak > nul
    call :log_success "前端服务已启动 (http://localhost:5173)"
    exit /b

:show_status
    call :log_info "服务状态:"
    
    :: 检查端口占用 (简化版本)
    netstat -an | findstr ":3000" > nul
    if %errorlevel% equ 0 (
        call :log_success "✓ 后端服务运行中 (端口 3000)"
        echo   前端访问地址: http://localhost:5173
        echo   后端API地址: http://localhost:3000
    ) else (
        call :log_warning "✗ 后端服务未运行"
    )
    
    netstat -an | findstr ":5173" > nul
    if %errorlevel% equ 0 (
        call :log_success "✓ 前端服务运行中 (端口 5173)"
    ) else (
        call :log_warning "✗ 前端服务未运行"
    )
    exit /b

:end
echo.
call :log_info "脚本执行完成"
pause