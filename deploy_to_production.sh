#!/bin/bash

# 🚀 会议室预订系统生产环境部署脚本
# 服务器: 47.122.68.192
# 域名: www.cacophonyem.me

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器配置
SERVER="47.122.68.192"
SERVER_USER="root"
PROJECT_DIR="/root/meeting"
BACKEND_DIR="$PROJECT_DIR/backend"
SERVICE_NAME="meeting-backend"
NGINX_CONF="/etc/nginx/sites-available/meeting"
NGINX_ENABLED="/etc/nginx/sites-enabled/meeting"

# 打印状态函数
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查SSH连接
check_ssh_connection() {
    print_status "检查SSH连接到服务器..."
    if ssh -o ConnectTimeout=10 "$SERVER_USER@$SERVER" "echo 'SSH连接成功'" 2>/dev/null; then
        print_success "SSH连接正常"
    else
        print_error "无法连接到服务器 $SERVER"
        exit 1
    fi
}

# 部署后端代码
deploy_backend() {
    print_status "开始部署后端代码..."
    
    ssh "$SERVER_USER@$SERVER" << 'EOF'
        set -e
        
        # 进入项目目录
        cd /root
        
        # 如果项目目录不存在，克隆代码
        if [ ! -d "meeting" ]; then
            echo "🔄 首次部署，克隆项目代码..."
            git clone https://github.com/ZhangLin0121/meeting.git
        fi
        
        # 进入项目目录并更新代码
        cd meeting
        echo "📦 更新项目代码..."
        git fetch origin
        git reset --hard origin/main
        
        # 进入后端目录
        cd backend
        
        # 安装依赖
        echo "📦 安装Node.js依赖..."
        npm install --production
        
        # 创建必要的目录
        mkdir -p uploads/rooms
        chmod 755 uploads
        chmod 755 uploads/rooms
        
        echo "✅ 后端代码部署完成"
EOF
    
    print_success "后端代码部署完成"
}

# 配置和启动服务
setup_service() {
    print_status "配置PM2服务..."
    
    ssh "$SERVER_USER@$SERVER" << 'EOF'
        set -e
        
        # 检查PM2是否安装
        if ! command -v pm2 &> /dev/null; then
            echo "📦 安装PM2..."
            npm install -g pm2
        fi
        
        cd /root/meeting/backend
        
        # 停止现有服务
        echo "🔄 停止现有服务..."
        pm2 stop meeting-backend 2>/dev/null || true
        pm2 delete meeting-backend 2>/dev/null || true
        
        # 启动新服务
        echo "🚀 启动会议室预订服务..."
        pm2 start server.js --name meeting-backend
        
        # 保存PM2配置
        pm2 save
        pm2 startup
        
        echo "✅ PM2服务配置完成"
EOF
    
    print_success "PM2服务配置完成"
}

# 配置Nginx
setup_nginx() {
    print_status "配置Nginx..."
    
    # 将本地nginx配置上传到服务器
    scp unified_nginx.conf "$SERVER_USER@$SERVER:/etc/nginx/sites-available/meeting"
    
    ssh "$SERVER_USER@$SERVER" << 'EOF'
        set -e
        
        # 创建符号链接
        ln -sf /etc/nginx/sites-available/meeting /etc/nginx/sites-enabled/meeting
        
        # 移除默认配置
        rm -f /etc/nginx/sites-enabled/default
        
        # 测试nginx配置
        echo "🧪 测试Nginx配置..."
        nginx -t
        
        # 重新加载nginx
        echo "🔄 重新加载Nginx..."
        systemctl reload nginx
        
        echo "✅ Nginx配置完成"
EOF
    
    print_success "Nginx配置完成"
}

# 检查服务状态
check_services() {
    print_status "检查服务状态..."
    
    ssh "$SERVER_USER@$SERVER" << 'EOF'
        echo "📊 PM2服务状态:"
        pm2 status
        
        echo ""
        echo "📊 PM2日志 (最近20行):"
        pm2 logs meeting-backend --lines 20 --nostream
        
        echo ""
        echo "📊 Nginx状态:"
        systemctl status nginx --no-pager -l
EOF
    
    print_success "服务状态检查完成"
}

# 验证部署
verify_deployment() {
    print_status "验证部署..."
    
    # 等待服务启动
    sleep 5
    
    # 测试API
    if curl -s -f "https://www.cacophonyem.me/meeting/api/health" > /dev/null; then
        print_success "✅ API健康检查通过"
    else
        print_warning "⚠️  API可能还在启动中，请稍后手动验证"
    fi
    
    # 测试静态文件
    if curl -s -f "https://www.cacophonyem.me/meeting/" > /dev/null; then
        print_success "✅ 网站访问正常"
    else
        print_warning "⚠️  网站可能还在配置中"
    fi
}

# 主部署流程
main() {
    echo "🚀 开始部署会议室预订系统到生产环境..."
    echo "📍 服务器: $SERVER"
    echo "🌐 域名: www.cacophonyem.me"
    echo ""
    
    check_ssh_connection
    deploy_backend
    setup_service
    setup_nginx
    check_services
    verify_deployment
    
    print_success "🎉 生产环境部署完成！"
    echo ""
    echo "📋 访问信息:"
    echo "  🌐 网站: https://www.cacophonyem.me/meeting/"
    echo "  🔗 API: https://www.cacophonyem.me/meeting/api/health"
    echo ""
    echo "📋 管理命令:"
    echo "  查看日志: ssh $SERVER_USER@$SERVER 'pm2 logs meeting-backend'"
    echo "  重启服务: ssh $SERVER_USER@$SERVER 'pm2 restart meeting-backend'"
    echo "  查看状态: ssh $SERVER_USER@$SERVER 'pm2 status'"
}

# 执行主流程
main "$@" 