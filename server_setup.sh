#!/bin/bash

# 🛠️ 服务器初始化和部署脚本
# 服务器: 47.122.68.192 (Ubuntu 24.04 LTS)

echo "🚀 开始服务器初始化和会议室预订系统部署..."

# 1. 更新系统
echo "📦 更新系统包..."
apt update && apt upgrade -y

# 2. 安装基础软件
echo "📦 安装基础软件..."
apt install -y curl wget git build-essential

# 3. 安装Node.js (使用NodeSource仓库安装最新LTS版本)
echo "📦 安装Node.js..."
curl -fsSL https://deb.nodesource.com/setup_lts.x | bash -
apt install -y nodejs

# 4. 安装PM2
echo "📦 安装PM2进程管理器..."
npm install -g pm2

# 5. 安装Nginx
echo "📦 安装Nginx..."
apt install -y nginx

# 6. 启动并启用Nginx
systemctl start nginx
systemctl enable nginx

# 7. 安装SSL证书工具
echo "📦 安装Certbot SSL证书工具..."
apt install -y certbot python3-certbot-nginx

# 8. 创建项目目录并克隆代码
echo "📦 克隆项目代码..."
cd /root
git clone https://github.com/ZhangLin0121/meeting.git

# 9. 安装项目依赖
echo "📦 安装项目依赖..."
cd meeting/backend
npm install --production

# 10. 创建上传目录
echo "📁 创建上传目录..."
mkdir -p uploads/rooms
chmod 755 uploads
chmod 755 uploads/rooms

# 11. 配置防火墙
echo "🔥 配置防火墙..."
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS
ufw allow 3000  # Node.js开发端口（可选）
ufw --force enable

# 12. 配置Nginx
echo "🌐 配置Nginx..."
cat > /etc/nginx/sites-available/meeting << 'EOF'
server {
    listen 80;
    server_name www.cacophonyem.me cacophonyem.me 47.122.68.192;

    # 会议室预订系统
    location /meeting/ {
        proxy_pass http://localhost:3000/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # 增加超时时间
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # 处理CORS
        add_header Access-Control-Allow-Origin *;
        add_header Access-Control-Allow-Methods 'GET, POST, PUT, DELETE, OPTIONS';
        add_header Access-Control-Allow-Headers 'Accept, Authorization, Cache-Control, Content-Type, DNT, If-Modified-Since, Keep-Alive, Origin, User-Agent, X-Requested-With, x-user-openid';
        
        if ($request_method = 'OPTIONS') {
            return 204;
        }
    }

    # 根路径重定向到会议室系统
    location = / {
        return 301 /meeting/;
    }

    # 文件上传大小限制
    client_max_body_size 10M;
}
EOF

# 13. 启用Nginx配置
ln -sf /etc/nginx/sites-available/meeting /etc/nginx/sites-enabled/meeting
rm -f /etc/nginx/sites-enabled/default

# 14. 测试Nginx配置
nginx -t

# 15. 重新加载Nginx
systemctl reload nginx

# 16. 启动PM2服务
echo "🚀 启动会议室预订服务..."
cd /root/meeting/backend
pm2 start server.js --name meeting-backend

# 17. 保存PM2配置并设置开机启动
pm2 save
pm2 startup

# 18. 设置SSL证书 (可选，如果域名已解析)
echo "🔒 配置SSL证书..."
# certbot --nginx -d www.cacophonyem.me -d cacophonyem.me --non-interactive --agree-tos --email admin@cacophonyem.me

echo "✅ 服务器初始化完成！"
echo ""
echo "📋 服务状态:"
echo "  Node.js版本: $(node --version)"
echo "  npm版本: $(npm --version)"
echo "  PM2状态:"
pm2 status
echo ""
echo "  Nginx状态:"
systemctl status nginx --no-pager -l | head -10
echo ""
echo "📋 访问信息:"
echo "  🌐 HTTP: http://47.122.68.192/meeting/"
echo "  🌐 域名: http://www.cacophonyem.me/meeting/ (如果域名已解析)"
echo "  🔗 API健康检查: http://47.122.68.192/meeting/api/health"
echo ""
echo "📋 管理命令:"
echo "  查看日志: pm2 logs meeting-backend"
echo "  重启服务: pm2 restart meeting-backend"
echo "  查看状态: pm2 status" 