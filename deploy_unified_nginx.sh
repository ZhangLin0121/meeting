#!/bin/bash

# 🚀 统一nginx配置部署脚本
# 用于安全地部署所有微信小程序后端服务的nginx配置

set -e  # 遇到错误立即退出

echo "🔧 开始部署统一nginx配置..."

# 定义颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器连接信息
SERVER="root@47.122.68.192"
SERVER_NGINX_SITES="/etc/nginx/sites-available"
SERVER_NGINX_ENABLED="/etc/nginx/sites-enabled"

print_status() {
    echo -e "${BLUE}[信息]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[成功]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[警告]${NC} $1"
}

print_error() {
    echo -e "${RED}[错误]${NC} $1"
}

# 第1步：上传新配置文件
print_status "第1步：上传统一nginx配置文件到服务器..."
scp unified_nginx.conf $SERVER:$SERVER_NGINX_SITES/unified_cacophonyem

# 第2步：备份现有配置
print_status "第2步：备份现有nginx配置..."
ssh $SERVER "
    echo '🔄 备份现有配置...'
    mkdir -p /root/nginx_backup_$(date +%Y%m%d_%H%M%S)
    BACKUP_DIR=/root/nginx_backup_$(date +%Y%m%d_%H%M%S)
    cp -r /etc/nginx/sites-enabled/* \$BACKUP_DIR/ 2>/dev/null || echo '没有现有的enabled配置'
    cp -r /etc/nginx/sites-available/* \$BACKUP_DIR/
    echo '✅ 配置已备份到 '\$BACKUP_DIR
"

# 第3步：验证新配置语法
print_status "第3步：验证nginx配置语法..."
ssh $SERVER "
    echo '🧪 测试nginx配置语法...'
    nginx -t -c /etc/nginx/nginx.conf
    if [ \$? -eq 0 ]; then
        echo '✅ nginx配置语法正确'
    else
        echo '❌ nginx配置语法错误，请检查配置文件'
        exit 1
    fi
"

# 第4步：询问用户是否继续
read -p "📋 配置验证通过！是否继续部署？(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "部署已取消"
    exit 0
fi

# 第5步：停用旧配置，启用新配置
print_status "第5步：切换nginx配置..."
ssh $SERVER "
    echo '🔄 禁用旧配置...'
    
    # 移除现有的enabled配置
    rm -f $SERVER_NGINX_ENABLED/meeting 2>/dev/null || true
    rm -f $SERVER_NGINX_ENABLED/meal-kitchen 2>/dev/null || true
    rm -f $SERVER_NGINX_ENABLED/cacophonyem.me 2>/dev/null || true
    
    echo '🔗 启用新的统一配置...'
    ln -sf $SERVER_NGINX_SITES/unified_cacophonyem $SERVER_NGINX_ENABLED/unified_cacophonyem
    
    echo '📋 当前启用的配置:'
    ls -la $SERVER_NGINX_ENABLED/
"

# 第6步：重新加载nginx
print_status "第6步：重新加载nginx服务..."
ssh $SERVER "
    echo '🔄 重新加载nginx...'
    nginx -s reload
    
    echo '📊 检查nginx状态...'
    systemctl status nginx --no-pager -l
"

# 第7步：测试服务可用性
print_status "第7步：测试各个服务的可用性..."

print_status "测试会议室预订系统..."
if curl -s -k "https://www.cacophonyem.me/meeting/api/health" > /dev/null; then
    print_success "✅ 会议室预订系统正常"
else
    print_warning "⚠️  会议室预订系统可能不可用"
fi

print_status "测试餐厅后厨管理系统..."
if curl -s -k "https://www.cacophonyem.me/kitchen/api/" > /dev/null 2>&1 || curl -s -k "https://www.cacophonyem.me/api/" > /dev/null 2>&1; then
    print_success "✅ 餐厅后厨管理系统正常"
else
    print_warning "⚠️  餐厅后厨管理系统可能不可用"
fi

print_status "测试问卷调查系统..."
if curl -s -k "https://www.cacophonyem.me/survey/api/" > /dev/null 2>&1; then
    print_success "✅ 问卷调查系统正常"
else
    print_warning "⚠️  问卷调查系统可能不可用"
fi

# 第8步：显示访问信息
print_success "🎉 统一nginx配置部署完成！"

echo ""
echo "📋 各个系统的访问地址："
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🏢 会议室预订系统："
echo "   API: https://www.cacophonyem.me/meeting/api/"
echo "   文件: https://www.cacophonyem.me/meeting/uploads/"
echo ""
echo "🍽️  餐厅后厨管理系统："
echo "   API: https://www.cacophonyem.me/kitchen/api/"
echo "   API(兼容): https://www.cacophonyem.me/api/"
echo "   文件: https://www.cacophonyem.me/kitchen/uploads/"
echo ""
echo "📊 问卷调查系统："
echo "   API: https://www.cacophonyem.me/survey/api/"
echo "   文件: https://www.cacophonyem.me/survey/uploads/"
echo ""
echo "🌐 API子域名（可选）："
echo "   餐厅: https://api.cacophonyem.me/"
echo "   会议室: https://api.cacophonyem.me/meeting/"
echo "   问卷: https://api.cacophonyem.me/survey/"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 第9步：检查可能需要的目录权限
print_status "第9步：检查文件目录权限..."
ssh $SERVER "
    echo '🔍 检查各项目的uploads目录权限...'
    
    # 检查会议室项目
    if [ -d '/root/meeting/backend/uploads' ]; then
        echo '📁 会议室uploads目录存在，检查权限...'
        ls -la /root/meeting/backend/uploads
        chmod 755 /root/meeting/backend/uploads
    fi
    
    # 检查餐厅项目
    if [ -d '/root/kitchen/backend/uploads' ]; then
        echo '📁 餐厅uploads目录存在，检查权限...'
        ls -la /root/kitchen/backend/uploads
        chmod 755 /root/kitchen/backend/uploads
    fi
    
    # 检查问卷项目
    if [ -d '/root/survey_wx/uploads' ]; then
        echo '📁 问卷uploads目录存在，检查权限...'
        ls -la /root/survey_wx/uploads
        chmod 755 /root/survey_wx/uploads
    fi
    
    echo '✅ 权限检查完成'
"

print_success "🎊 部署完成！所有微信小程序后端服务现在都可以通过统一的nginx配置访问了。"
print_status "如果遇到问题，备份文件在服务器的 /root/nginx_backup_* 目录中" 