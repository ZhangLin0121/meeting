#!/bin/bash

# 会议室预约系统 - 登录问题修复部署脚本
# 解决小程序体验版扫码登录失败问题

set -e  # 脚本遇到错误时退出

SERVER="47.122.68.192"
USER="root"
BACKEND_PATH="/opt/meeting-backend"

echo "🚀 开始部署登录修复..."

# 1. 备份服务器代码
echo "📦 备份服务器代码..."
ssh $USER@$SERVER "cd $BACKEND_PATH && cp -r controllers controllers.backup.$(date +%Y%m%d_%H%M%S) || true"
ssh $USER@$SERVER "cd $BACKEND_PATH && cp -r routes routes.backup.$(date +%Y%m%d_%H%M%S) || true"

# 2. 上传修复后的后端代码
echo "📤 上传修复后的后端代码..."
rsync -avz --exclude='node_modules' --exclude='.DS_Store' --exclude='*.log' \
    backend/controllers/ $USER@$SERVER:$BACKEND_PATH/controllers/

rsync -avz --exclude='node_modules' --exclude='.DS_Store' --exclude='*.log' \
    backend/routes/ $USER@$SERVER:$BACKEND_PATH/routes/

# 3. 安装新的依赖（axios）
echo "📦 安装新依赖..."
ssh $USER@$SERVER "cd $BACKEND_PATH && npm install axios"

# 4. 重启后端服务
echo "🔄 重启后端服务..."
ssh $USER@$SERVER "cd $BACKEND_PATH && pm2 restart meeting-backend || pm2 start server.js --name meeting-backend"

# 5. 验证服务状态
echo "✅ 验证服务状态..."
sleep 3

echo "📊 检查PM2进程状态:"
ssh $USER@$SERVER "pm2 status"

echo "🌐 测试API健康检查:"
if curl -f http://$SERVER/api/health; then
    echo "✅ API健康检查成功!"
else
    echo "❌ API健康检查失败!"
    exit 1
fi

echo "🧪 测试微信登录接口:"
WECHAT_TEST=$(curl -s -X POST http://$SERVER/api/user/wechat-login \
    -H "Content-Type: application/json" \
    -d '{"code":"test_code","nickname":"测试用户"}' || echo "error")

if [[ $WECHAT_TEST == *"微信登录失败"* ]] || [[ $WECHAT_TEST == *"success"* ]]; then
    echo "✅ 微信登录接口已就绪!"
else
    echo "⚠️ 微信登录接口响应异常，请检查日志"
fi

echo ""
echo "🎉 部署完成！"
echo ""
echo "📋 接下来需要做的："
echo "1. 在微信公众平台配置服务器域名: $SERVER"
echo "2. 在小程序开发工具中重新编译项目"
echo "3. 上传体验版并测试登录功能"
echo ""
echo "🔧 如遇问题，可查看服务器日志:"
echo "   ssh $USER@$SERVER 'pm2 logs meeting-backend'"
echo ""
echo "📞 API测试地址:"
echo "   健康检查: http://$SERVER/api/health"
echo "   微信登录: http://$SERVER/api/user/wechat-login" 