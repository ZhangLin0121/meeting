#!/bin/bash

echo "🚀 部署管理员图片上传修复..."

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 服务器配置
SERVER="root@47.122.68.192"
BACKEND_DIR="/root/meeting-backend"
FRONTEND_LOCAL="./frontend"

echo -e "${YELLOW}📱 部署前端代码...${NC}"

# 上传前端代码
scp -r $FRONTEND_LOCAL/* $SERVER:$BACKEND_DIR/public/

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 前端代码上传成功${NC}"
else
    echo -e "${RED}❌ 前端代码上传失败${NC}"
    exit 1
fi

echo -e "${YELLOW}🔧 确保uploads目录权限...${NC}"

# 确保uploads目录存在且权限正确
ssh $SERVER "
    mkdir -p $BACKEND_DIR/uploads/rooms
    chmod 755 $BACKEND_DIR/uploads
    chmod 755 $BACKEND_DIR/uploads/rooms
    ls -la $BACKEND_DIR/uploads/
"

echo -e "${YELLOW}🔄 重启后端服务...${NC}"

# 重启后端服务
ssh $SERVER "
    cd $BACKEND_DIR
    npm install --production
    pm2 restart meeting-backend
    pm2 status
"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 后端服务重启成功${NC}"
else
    echo -e "${RED}❌ 后端服务重启失败${NC}"
    exit 1
fi

echo -e "${YELLOW}🧪 测试图片上传接口...${NC}"

# 测试图片上传接口
TEST_RESULT=$(curl -s -X POST "https://www.cacophonyem.me/meeting/api/upload/room-image" \
    -H "x-user-openid: owTeX65RPewc2lgCYMBwsLP9my80" \
    -H "Content-Type: multipart/form-data")

echo "测试结果: $TEST_RESULT"

if [[ $TEST_RESULT == *"请选择要上传的图片"* ]]; then
    echo -e "${GREEN}✅ 图片上传接口响应正常${NC}"
else
    echo -e "${RED}❌ 图片上传接口响应异常${NC}"
fi

echo -e "${GREEN}🎉 部署完成！${NC}"
echo -e "${YELLOW}📌 主要修复内容：${NC}"
echo "1. ✅ 创建并配置uploads目录"
echo "2. ✅ 修复nginx静态文件路径"
echo "3. ✅ 优化前端用户身份验证"
echo "4. ✅ 添加管理员权限检查"
echo "5. ✅ 改进错误处理和日志"

echo -e "${YELLOW}🔗 访问地址：${NC}"
echo "管理员后台: https://www.cacophonyem.me/meeting (需要管理员权限)"
echo "API基础URL: https://www.cacophonyem.me/meeting" 