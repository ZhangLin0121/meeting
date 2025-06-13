#!/bin/bash

# 会议室预订系统 - 自动化部署脚本
# 使用方法: ./deploy.sh "提交信息"

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 服务器配置
SERVER_HOST="47.122.68.192"
SERVER_USER="root"
PROJECT_PATH="/root/meeting-backend"
SERVICE_NAME="meeting-backend"

echo -e "${BLUE}🚀 会议室预订系统 - 自动化部署开始${NC}"
echo "=================================================="

# 检查是否提供了提交信息
if [ -z "$1" ]; then
    echo -e "${YELLOW}⚠️  请提供提交信息${NC}"
    read -p "请输入提交信息: " COMMIT_MSG
else
    COMMIT_MSG="$1"
fi

echo -e "${BLUE}📝 提交信息: ${COMMIT_MSG}${NC}"

# 1. 检查当前目录是否有未提交的更改
echo -e "\n${BLUE}🔍 检查本地更改...${NC}"
if [[ -n $(git status --porcelain) ]]; then
    echo -e "${GREEN}✅ 发现本地更改，准备提交${NC}"
    
    # 显示更改的文件
    echo -e "${YELLOW}📋 更改的文件:${NC}"
    git status --short
    
    # 提交代码
    echo -e "\n${BLUE}📤 提交代码到Git仓库...${NC}"
    git add .
    git commit -m "$COMMIT_MSG"
    git push origin main
    echo -e "${GREEN}✅ 代码提交完成${NC}"
else
    echo -e "${YELLOW}⚠️  没有发现本地更改${NC}"
    read -p "是否继续部署最新代码? (y/N): " CONTINUE
    if [[ ! $CONTINUE =~ ^[Yy]$ ]]; then
        echo -e "${RED}❌ 部署已取消${NC}"
        exit 1
    fi
fi

# 2. 连接服务器并部署
echo -e "\n${BLUE}🌐 连接服务器并部署...${NC}"
ssh ${SERVER_USER}@${SERVER_HOST} << EOF
    set -e
    
    echo "🔄 进入项目目录..."
    cd ${PROJECT_PATH}
    
    echo "📥 拉取最新代码..."
    git pull origin main
    
    echo "📦 检查并安装依赖..."
    npm install --production
    
    echo "🔄 重启服务..."
    pm2 restart ${SERVICE_NAME}
    
    echo "⏳ 等待服务启动..."
    sleep 3
    
    echo "📊 检查服务状态..."
    pm2 status ${SERVICE_NAME}
    
    echo "📋 显示最新日志..."
    pm2 logs ${SERVICE_NAME} --lines 10 --nostream
    
    echo "✅ 服务器部署完成"
EOF

# 3. 验证部署
echo -e "\n${BLUE}🧪 验证部署结果...${NC}"
echo "正在测试API健康检查..."

# 等待服务完全启动
sleep 2

# 测试API
if curl -s -f "https://www.cacophonyem.me/meeting/api/health" > /dev/null; then
    echo -e "${GREEN}✅ API健康检查通过${NC}"
    
    # 获取API响应
    API_RESPONSE=$(curl -s "https://www.cacophonyem.me/meeting/api/health")
    echo -e "${GREEN}📡 API响应: ${API_RESPONSE}${NC}"
else
    echo -e "${RED}❌ API健康检查失败${NC}"
    echo -e "${YELLOW}🔍 请检查服务器日志:${NC}"
    echo "ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 logs ${SERVICE_NAME}'"
    exit 1
fi

# 4. 部署完成
echo -e "\n=================================================="
echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${BLUE}📊 部署信息:${NC}"
echo -e "  • 提交信息: ${COMMIT_MSG}"
echo -e "  • 服务器: ${SERVER_HOST}"
echo -e "  • 项目路径: ${PROJECT_PATH}"
echo -e "  • 服务名称: ${SERVICE_NAME}"
echo -e "  • API地址: https://www.cacophonyem.me/meeting/api/"

echo -e "\n${BLUE}🔧 常用管理命令:${NC}"
echo -e "  • 查看服务状态: ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 status'"
echo -e "  • 查看服务日志: ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 logs ${SERVICE_NAME}'"
echo -e "  • 重启服务: ssh ${SERVER_USER}@${SERVER_HOST} 'pm2 restart ${SERVICE_NAME}'"

echo -e "\n${GREEN}✨ 部署流程完成，服务正常运行！${NC}" 