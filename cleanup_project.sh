#!/bin/bash

echo "🧹 开始清理项目目录..."

# 创建docs目录来存放文档
mkdir -p docs/{deployment,testing,guides}
mkdir -p scripts/{old,config}

echo "📁 创建目录结构完成"

# 移动部署相关文档
if [ -f "deployment.md" ]; then
    mv deployment.md docs/deployment/
    echo "✅ 移动 deployment.md 到 docs/deployment/"
fi

# 保留最新的deploy.sh，移动旧版本
if [ -f "deploy-admin-fix.sh" ]; then
    mv deploy-admin-fix.sh scripts/old/
    echo "✅ 移动旧版部署脚本到 scripts/old/"
fi

if [ -f "deploy-fix.sh" ]; then
    mv deploy-fix.sh scripts/old/
    echo "✅ 移动旧版部署脚本到 scripts/old/"
fi

# 移动测试文档
if [ -f "快速测试方案.md" ]; then
    mv "快速测试方案.md" docs/testing/
    echo "✅ 移动测试文档到 docs/testing/"
fi

if [ -f "整时段预约测试.md" ]; then
    mv "整时段预约测试.md" docs/testing/
    echo "✅ 移动测试文档到 docs/testing/"
fi

if [ -f "测试说明.md" ]; then
    mv "测试说明.md" docs/testing/
    echo "✅ 移动测试文档到 docs/testing/"
fi

if [ -f "设备配置修复验证.md" ]; then
    mv "设备配置修复验证.md" docs/testing/
    echo "✅ 移动修复验证文档到 docs/testing/"
fi

if [ -f "微信小程序调试指南.md" ]; then
    mv "微信小程序调试指南.md" docs/guides/
    echo "✅ 移动调试指南到 docs/guides/"
fi

# 移动配置文件
if [ -f "meeting-nginx-fixed.conf" ]; then
    mv meeting-nginx-fixed.conf scripts/config/
    echo "✅ 移动nginx配置到 scripts/config/"
fi

if [ -f "ssl-setup.sh" ]; then
    mv ssl-setup.sh scripts/config/
    echo "✅ 移动SSL配置脚本到 scripts/config/"
fi

# 移动Cursor相关文档
if [ -f "CURSOR_OPTIMIZATION_GUIDE.md" ]; then
    mv CURSOR_OPTIMIZATION_GUIDE.md docs/guides/
    echo "✅ 移动Cursor指南到 docs/guides/"
fi

# 保留最新的测试脚本，移动旧版本
if [ -f "create_test_bookings.js" ]; then
    mv create_test_bookings.js scripts/old/
    echo "✅ 移动旧版测试脚本到 scripts/old/"
fi

# 如果v2版本存在，保留它作为最新版本
if [ -f "create_test_bookings_v2.js" ]; then
    mv create_test_bookings_v2.js scripts/create_test_bookings.js
    echo "✅ 重命名并保留最新测试脚本"
fi

# 删除系统文件
if [ -f ".DS_Store" ]; then
    rm .DS_Store
    echo "✅ 删除.DS_Store系统文件"
fi

# 创建.gitignore规则避免将来的系统文件
if ! grep -q "\.DS_Store" .gitignore 2>/dev/null; then
    echo "" >> .gitignore
    echo "# 系统文件" >> .gitignore
    echo ".DS_Store" >> .gitignore
    echo "Thumbs.db" >> .gitignore
    echo "✅ 更新.gitignore文件"
fi

echo ""
echo "🎉 项目清理完成！"
echo ""
echo "📊 新的目录结构："
echo "├── docs/"
echo "│   ├── deployment/     # 部署相关文档"
echo "│   ├── testing/        # 测试相关文档"
echo "│   └── guides/         # 使用指南"
echo "├── scripts/"
echo "│   ├── old/           # 旧版本脚本"
echo "│   └── config/        # 配置文件"
echo "├── frontend/          # 前端代码"
echo "├── backend/           # 后端代码"
echo "├── README.md          # 主要说明文档"
echo "└── deploy.sh          # 当前部署脚本"
echo ""
echo "💡 建议："
echo "1. 检查移动后的文件是否正确"
echo "2. 测试deploy.sh脚本是否正常工作"
echo "3. 如果确认无误，可以删除scripts/old目录" 