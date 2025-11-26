#!/bin/bash

# 微信小程序HTTPS配置脚本
# 为服务器配置免费SSL证书

SERVER="47.122.68.192"
USER="root"
DOMAIN="meeting.example.com"  # 请替换为您的域名

echo "🔒 开始配置HTTPS..."

# 注意：需要先配置域名解析到服务器IP
echo "⚠️  请确保域名 $DOMAIN 已解析到 $SERVER"
read -p "域名已配置好解析吗？(y/N): " confirm

if [[ $confirm != [yY] ]]; then
    echo "❌ 请先配置域名解析后再运行此脚本"
    exit 1
fi

# 1. 安装 Certbot
echo "📦 安装 Certbot..."
ssh $USER@$SERVER "apt update && apt install -y certbot python3-certbot-nginx"

# 2. 获取SSL证书
echo "🔐 获取SSL证书..."
ssh $USER@$SERVER "certbot --nginx -d $DOMAIN --non-interactive --agree-tos --email admin@$DOMAIN"

# 3. 更新Nginx配置
echo "🔧 更新Nginx配置..."
ssh $USER@$SERVER "cat > /etc/nginx/sites-available/meeting << 'EOF'
server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$server_name\$request_uri;
}

server {
    listen 443 ssl http2;
    server_name $DOMAIN;

    ssl_certificate /etc/letsencrypt/live/$DOMAIN/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/$DOMAIN/privkey.pem;
    
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES256-GCM-SHA512:DHE-RSA-AES256-GCM-SHA512:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location /uploads/ {
        proxy_pass http://localhost:3001/uploads/;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF"

# 4. 重启Nginx
echo "🔄 重启Nginx..."
ssh $USER@$SERVER "nginx -t && systemctl reload nginx"

# 5. 设置自动续期
echo "⏰ 设置SSL证书自动续期..."
ssh $USER@$SERVER "crontab -l | grep -v 'certbot renew' | crontab -"
ssh $USER@$SERVER "(crontab -l; echo '0 12 * * * /usr/bin/certbot renew --quiet') | crontab -"

echo "✅ HTTPS配置完成！"
echo ""
echo "📋 接下来的步骤："
echo "1. 在微信公众平台配置域名: https://$DOMAIN"
echo "2. 更新小程序代码中的API地址"
echo "3. 测试HTTPS连接: curl https://$DOMAIN/api/health" 