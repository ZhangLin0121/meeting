#!/bin/bash

# 🔄 nginx配置回滚脚本
# 用于紧急恢复到之前的nginx配置

set -e

echo "🚨 nginx配置紧急回滚脚本"

# 定义颜色
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

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

# 检查备份目录
print_status "查找最新的nginx配置备份..."
BACKUP_DIR=$(ssh $SERVER "ls -t /root/nginx_backup_* 2>/dev/null | head -1")

if [ -z "$BACKUP_DIR" ]; then
    print_error "❌ 没有找到nginx配置备份！"
    print_status "手动恢复步骤："
    echo "1. ssh root@47.122.68.192"
    echo "2. rm -f /etc/nginx/sites-enabled/unified_cacophonyem"
    echo "3. ln -sf /etc/nginx/sites-available/meeting /etc/nginx/sites-enabled/meeting"
    echo "4. nginx -t && nginx -s reload"
    exit 1
fi

print_success "找到备份目录: $BACKUP_DIR"

# 询问用户确认
read -p "⚠️  确定要回滚到备份 $BACKUP_DIR 吗？这将撤销所有nginx配置更改！(y/N): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    print_warning "回滚已取消"
    exit 0
fi

# 执行回滚
print_status "开始回滚nginx配置..."

ssh $SERVER "
    echo '🔄 禁用当前配置...'
    rm -f $SERVER_NGINX_ENABLED/* 2>/dev/null || true
    
    echo '📁 恢复备份配置...'
    if [ -f '$BACKUP_DIR/meeting' ]; then
        ln -sf $SERVER_NGINX_SITES/meeting $SERVER_NGINX_ENABLED/meeting
        echo '✅ 恢复meeting配置'
    fi
    
    if [ -f '$BACKUP_DIR/meal-kitchen' ]; then
        ln -sf $SERVER_NGINX_SITES/meal-kitchen $SERVER_NGINX_ENABLED/meal-kitchen
        echo '✅ 恢复meal-kitchen配置'
    fi
    
    echo '🧪 测试nginx配置...'
    nginx -t
    
    echo '🔄 重新加载nginx...'
    nginx -s reload
    
    echo '📊 检查nginx状态...'
    systemctl status nginx --no-pager -l
"

# 测试恢复的服务
print_status "测试恢复的服务..."
if curl -s -k "https://www.cacophonyem.me/meeting/api/health" > /dev/null; then
    print_success "✅ 会议室预订系统恢复正常"
else
    print_warning "⚠️  会议室预订系统可能还有问题"
fi

print_success "🎉 nginx配置回滚完成！"
print_status "如果还有问题，请手动检查nginx配置和服务状态" 