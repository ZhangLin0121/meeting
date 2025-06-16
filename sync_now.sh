#!/bin/bash

echo "🔄 开始三端同步检查..."

# 检查本地Git状态
echo "📍 检查本地Git状态..."
git status --porcelain

if [ $? -eq 0 ] && [ -z "$(git status --porcelain)" ]; then
    echo "✅ 本地Git仓库干净"
else
    echo "⚠️ 本地还有未提交的变更"
    git status
fi

# 显示最近的提交
echo "📝 最近的提交:"
git log --oneline -3

# 测试GitHub连接
echo "🌐 测试GitHub连接..."
timeout 10 git ls-remote origin > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ GitHub连接正常，开始推送..."
    git push origin main
    if [ $? -eq 0 ]; then
        echo "✅ Git推送成功"
        GIT_SYNC_SUCCESS=true
    else
        echo "❌ Git推送失败"
        GIT_SYNC_SUCCESS=false
    fi
else
    echo "❌ GitHub连接失败，跳过推送"
    GIT_SYNC_SUCCESS=false
fi

# 测试服务器连接
echo "🖥️ 测试服务器连接..."
timeout 10 ssh -o ConnectTimeout=5 root@47.122.68.192 "echo 'SSH连接测试成功'" 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ 服务器连接正常"
    
    # 如果Git推送成功，则部署到服务器
    if [ "$GIT_SYNC_SUCCESS" = true ]; then
        echo "🚀 开始部署到服务器..."
        
        ssh root@47.122.68.192 << 'EOF'
echo "📂 进入项目目录..."
cd /root/meeting-backend

echo "📥 检查Git状态..."
git status --porcelain

echo "📥 拉取最新代码..."
git pull origin main

if [ $? -eq 0 ]; then
    echo "✅ 代码拉取成功"
    
    echo "📦 检查依赖..."
    npm install
    
    echo "🔄 重启服务..."
    pm2 restart meeting-backend
    
    echo "📊 检查服务状态..."
    pm2 status meeting-backend
    
    echo "📋 查看最新日志..."
    pm2 logs meeting-backend --lines 5
    
    echo "✅ 服务器部署完成"
else
    echo "❌ 代码拉取失败"
    exit 1
fi
EOF

        if [ $? -eq 0 ]; then
            echo "✅ 服务器部署成功"
            SERVER_SYNC_SUCCESS=true
        else
            echo "❌ 服务器部署失败"
            SERVER_SYNC_SUCCESS=false
        fi
    else
        echo "⚠️ 跳过服务器部署（Git推送未成功）"
        SERVER_SYNC_SUCCESS=false
    fi
else
    echo "❌ 服务器连接失败"
    SERVER_SYNC_SUCCESS=false
fi

# 验证API服务
echo "🧪 验证API服务..."
timeout 10 curl -s https://www.cacophonyem.me/meeting/api/health > /dev/null 2>&1

if [ $? -eq 0 ]; then
    echo "✅ API服务正常"
    
    # 获取API响应内容
    API_RESPONSE=$(curl -s https://www.cacophonyem.me/meeting/api/health)
    echo "📋 API响应: $API_RESPONSE"
    
    API_SUCCESS=true
else
    echo "❌ API服务异常"
    API_SUCCESS=false
fi

# 总结同步状态
echo ""
echo "📊 三端同步状态总结:"
echo "================================"

# 本地状态
if [ -z "$(git status --porcelain)" ]; then
    echo "✅ 本地环境: 干净，无未提交变更"
else
    echo "⚠️ 本地环境: 有未提交变更"
fi

# Git状态
if [ "$GIT_SYNC_SUCCESS" = true ]; then
    echo "✅ Git仓库: 已同步最新代码"
else
    echo "❌ Git仓库: 同步失败或跳过"
fi

# 服务器状态
if [ "$SERVER_SYNC_SUCCESS" = true ]; then
    echo "✅ 服务器: 已部署最新代码"
else
    echo "❌ 服务器: 部署失败或跳过"
fi

# API状态
if [ "$API_SUCCESS" = true ]; then
    echo "✅ API服务: 正常运行"
else
    echo "❌ API服务: 异常或无响应"
fi

echo "================================"

# 根据结果给出建议
if [ "$GIT_SYNC_SUCCESS" = true ] && [ "$SERVER_SYNC_SUCCESS" = true ] && [ "$API_SUCCESS" = true ]; then
    echo "🎉 三端同步完成！所有服务正常运行"
    echo ""
    echo "🧪 建议进行以下验证："
    echo "1. 在微信开发者工具中测试设备配置功能"
    echo "2. 验证会议室管理功能是否正常"
    echo "3. 检查图片上传和显示是否正常"
elif [ "$GIT_SYNC_SUCCESS" = false ]; then
    echo "⚠️ 需要手动处理Git推送问题"
    echo "建议：检查网络连接后重新运行脚本"
elif [ "$SERVER_SYNC_SUCCESS" = false ]; then
    echo "⚠️ 需要手动处理服务器部署问题"
    echo "建议：检查服务器连接和日志"
elif [ "$API_SUCCESS" = false ]; then
    echo "⚠️ 需要检查API服务状态"
    echo "建议：查看服务器日志排查问题"
fi

echo ""
echo "📝 完整的同步方案请参考: 三端同步方案.md" 