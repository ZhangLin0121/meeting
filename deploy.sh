#!/bin/bash

echo "🚀 开始自动化部署流程..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 1. 本地Git操作
echo -e "${BLUE}📝 提交本地代码...${NC}"

# 检查是否有未提交的更改
if [[ -n $(git status --porcelain) ]]; then
    read -p "请输入提交信息: " commit_msg
    git add .
    git commit -m "$commit_msg"
    git push origin main
    echo -e "${GREEN}✅ 本地代码已提交并推送${NC}"
else
    echo -e "${YELLOW}⚠️ 没有需要提交的更改${NC}"
fi

# 2. 服务器部署
echo -e "${BLUE}🌐 连接服务器进行部署...${NC}"

ssh root@47.122.68.192 << 'EOF'
set -e  # 遇到错误立即退出

echo "🔄 进入项目目录..."
cd /root/meeting

echo "📥 拉取最新代码..."
# Git拉取重试机制
max_retries=3
retry_count=0

while [ $retry_count -lt $max_retries ]; do
    if git pull origin main; then
        echo "✅ 代码拉取成功"
        break
    else
        retry_count=$((retry_count + 1))
        echo "❌ 代码拉取失败，重试 $retry_count/$max_retries..."
        
        if [ $retry_count -eq $max_retries ]; then
            echo "❌ 代码拉取失败，请检查网络连接"
            exit 1
        fi
        
        sleep 5
    fi
done

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

EOF

echo -e "${GREEN}🎉 部署流程完成！${NC}"
echo -e "${BLUE}📋 部署信息：${NC}"
echo "   - 时间: $(date)"
echo "   - 服务器: 47.122.68.192"
echo "   - 项目路径: /root/meeting"
echo "   - API地址: https://www.cacophonyem.me/meeting/api/"

echo -e "${YELLOW}💡 提示：如果遇到问题，请运行以下命令查看日志：${NC}"
echo "   ssh root@47.122.68.192 'pm2 logs meeting-backend'" 