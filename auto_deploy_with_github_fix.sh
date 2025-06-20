#!/bin/bash

echo "🚀 GitHub访问优化 + 自动部署脚本"

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器信息
SERVER="root@47.122.68.192"
PROJECT_PATH="/root/meeting"

# 1. 本地Git操作
echo -e "${BLUE}📝 提交本地代码...${NC}"
if [[ -n $(git status --porcelain) ]]; then
    read -p "请输入提交信息: " commit_msg
    git add .
    git commit -m "$commit_msg"
    git push origin main
    echo -e "${GREEN}✅ 本地代码已提交并推送${NC}"
else
    echo -e "${YELLOW}⚠️ 没有需要提交的更改${NC}"
fi

# 2. 服务器GitHub访问优化 + 部署
echo -e "${BLUE}🌐 连接服务器进行优化部署...${NC}"

ssh $SERVER << 'EOF'
set -e

echo "🔧 优化GitHub访问..."

# 函数：更新GitHub hosts
update_github_hosts() {
    echo "📥 更新GitHub hosts配置..."
    
    # 尝试从多个源下载hosts
    sources=(
        "https://raw.hellogithub.com/hosts"
        "https://raw.githubusercontent.com/521xueweihan/GitHub520/main/hosts"
    )
    
    for source in "${sources[@]}"; do
        if curl -s --connect-timeout 10 "$source" -o /tmp/github_hosts_new; then
            echo "✅ 从 $source 成功下载hosts"
            
            # 备份原hosts
            cp /etc/hosts /etc/hosts.backup_$(date +%Y%m%d_%H%M%S)
            
            # 清除旧的GitHub hosts
            sed -i '/# GitHub520 Host Start/,/# GitHub520 Host End/d' /etc/hosts
            
            # 添加新的GitHub hosts
            cat /tmp/github_hosts_new >> /etc/hosts
            
            echo "🔄 刷新DNS缓存..."
            # 刷新DNS（如果有nscd）
            if command -v nscd >/dev/null 2>&1; then
                nscd -i hosts
            fi
            
            # 清理缓存
            if command -v systemd-resolve >/dev/null 2>&1; then
                systemd-resolve --flush-caches
            fi
            
            rm -f /tmp/github_hosts_new
            echo "✅ GitHub hosts更新完成"
            break
        else
            echo "❌ 从 $source 下载失败，尝试下一个源..."
        fi
    done
}

# 函数：Git操作重试机制
git_pull_with_retry() {
    local max_retries=5
    local retry_count=0
    local base_delay=5
    
    while [ $retry_count -lt $max_retries ]; do
        echo "📥 尝试拉取代码 (第 $((retry_count + 1)) 次)..."
        
        if timeout 60 git pull origin main; then
            echo "✅ 代码拉取成功"
            return 0
        else
            retry_count=$((retry_count + 1))
            if [ $retry_count -lt $max_retries ]; then
                local delay=$((base_delay * retry_count))
                echo "❌ 拉取失败，等待 ${delay} 秒后重试..."
                sleep $delay
                
                # 每次重试前更新hosts
                if [ $retry_count -eq 2 ]; then
                    echo "🔄 重新优化GitHub访问..."
                    update_github_hosts
                fi
            else
                echo "❌ 代码拉取最终失败，请检查网络连接"
                return 1
            fi
        fi
    done
}

# 开始执行
echo "🔄 进入项目目录..."
cd $PROJECT_PATH

# 更新GitHub hosts
update_github_hosts

# 尝试Git拉取
if git_pull_with_retry; then
    echo "📦 安装依赖..."
    cd backend
    if npm install; then
        echo "✅ 依赖安装成功"
    else
        echo "❌ 依赖安装失败"
        exit 1
    fi
    
    echo "🔄 重启服务..."
    if pm2 restart meeting-backend; then
        echo "✅ 服务重启成功"
    else
        echo "❌ 服务重启失败"
        exit 1
    fi
    
    echo "📊 检查服务状态..."
    pm2 status
    
    echo "🔍 查看最新日志..."
    pm2 logs meeting-backend --lines 10
    
    echo "🩺 健康检查..."
    sleep 3
    if curl -f https://www.cacophonyem.me/meeting/api/health > /dev/null 2>&1; then
        echo "✅ API健康检查通过"
    else
        echo "⚠️ API健康检查失败，请查看日志"
    fi
else
    echo "❌ 部署失败：无法拉取最新代码"
    exit 1
fi

EOF

echo -e "${GREEN}🎉 优化部署流程完成！${NC}"
echo -e "${BLUE}📋 部署信息：${NC}"
echo "   - 时间: $(date)"
echo "   - 服务器: $SERVER"
echo "   - 项目路径: $PROJECT_PATH"
echo "   - API地址: https://www.cacophonyem.me/meeting/api/"

echo -e "${YELLOW}💡 GitHub访问优化说明：${NC}"
echo "   - 已更新最新的GitHub hosts配置"
echo "   - 支持多源hosts下载，提高成功率"
echo "   - 集成重试机制，自动处理网络问题"
echo "   - 如仍有问题，请检查服务器网络状况" 