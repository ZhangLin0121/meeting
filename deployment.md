# 会议室预约系统 - 服务器部署文档

## 🚀 部署概览

**服务器信息：**
- 服务器IP: `47.122.68.192`
- 用户: `root`
- 操作系统: Ubuntu
- Node.js版本: v18.19.1
- MongoDB版本: 7.0.21

**服务配置：**
- 后端端口: `3001` (内部)
- Nginx代理端口: `80` (外部)
- API基础URL: `http://47.122.68.192`

## 📋 部署步骤

### 1. 服务器环境准备
```bash
# 连接服务器
ssh root@47.122.68.192

# 检查Node.js和npm版本
node --version  # v18.19.1
npm --version   # 9.2.0
pm2 --version   # 6.0.6
```

### 2. 后端代码部署
```bash
# 本地上传代码到服务器
rsync -avz --exclude='node_modules' --exclude='.DS_Store' backend/ root@47.122.68.192:/opt/meeting-backend/

# 服务器安装依赖
ssh root@47.122.68.192 "cd /opt/meeting-backend && npm install"
```

### 3. MongoDB数据库配置
```bash
# 安装MongoDB 7.0
curl -fsSL https://www.mongodb.org/static/pgp/server-7.0.asc | gpg -o /usr/share/keyrings/mongodb-server-7.0.gpg --dearmor
echo 'deb [ arch=amd64,arm64 signed-by=/usr/share/keyrings/mongodb-server-7.0.gpg ] https://repo.mongodb.org/apt/ubuntu jammy/mongodb-org/7.0 multiverse' | tee /etc/apt/sources.list.d/mongodb-org-7.0.list
apt update && apt install -y mongodb-org

# 启动MongoDB服务
systemctl start mongod
systemctl enable mongod

# 初始化数据库数据
cd /opt/meeting-backend && node initializeRoomData.js
```

### 4. 环境配置
```bash
# 创建.env文件
cd /opt/meeting-backend
cat > .env << EOF
NODE_ENV=production
PORT=3001
MONGODB_URI=mongodb://localhost:27017/meeting_room_booking
TIMEZONE=Asia/Shanghai
UPLOAD_PATH=uploads
MAX_FILE_SIZE=5242880
WECHAT_APP_ID=wxa4f8f0622653dea5
WECHAT_APP_SECRET=1ebfd5606d696d1dbba7d3a44cd02877
OFFICE_START_TIME=08:30
OFFICE_END_TIME_MORNING=12:00
OFFICE_START_TIME_AFTERNOON=14:30
OFFICE_END_TIME=17:30
MAX_ADVANCE_DAYS=3
CANCEL_TIME_LIMIT_MINUTES=30
ADMIN_CANCEL_TIME_LIMIT_MINUTES=5
EOF
```

### 5. PM2进程管理
```bash
# 启动后端服务
pm2 start server.js --name meeting-backend

# 保存PM2配置
pm2 save

# 设置开机自启
pm2 startup

# 查看服务状态
pm2 status
```

### 6. Nginx反向代理配置
```bash
# 安装Nginx
apt install -y nginx

# 创建配置文件
cat > /etc/nginx/sites-available/meeting << EOF
server {
    listen 80;
    server_name 47.122.68.192;

    location /api/ {
        proxy_pass http://localhost:3001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location /uploads/ {
        proxy_pass http://localhost:3001/uploads/;
        proxy_set_header Host $host;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/meeting /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx
```

### 7. 前端配置更新
更新以下文件中的API基础URL：
- `frontend/app.js`
- `frontend/pages/admin/admin.js`
- `frontend/pages/roomDetail/roomDetail.js`
- `frontend/pages/roomList/roomList.js`

将 `http://localhost:3000` 改为 `http://47.122.68.192`

## ✅ 部署验证

### API健康检查
```bash
curl http://47.122.68.192/api/health
# 预期返回: {"success":true,"message":"服务运行正常",...}
```

### 服务状态检查
```bash
# 检查PM2进程
pm2 status

# 检查Nginx状态
systemctl status nginx

# 检查MongoDB状态
systemctl status mongod

# 检查端口占用
netstat -tlnp | grep -E "(80|3001|27017)"
```

## 🔧 常用运维命令

### PM2管理
```bash
pm2 restart meeting-backend  # 重启服务
pm2 stop meeting-backend     # 停止服务
pm2 logs meeting-backend     # 查看日志
pm2 monit                    # 监控面板
```

### Nginx管理
```bash
nginx -t                     # 测试配置
systemctl reload nginx       # 重载配置
systemctl restart nginx      # 重启服务
```

### MongoDB管理
```bash
mongosh                      # 连接数据库
systemctl restart mongod     # 重启MongoDB
```

## 📊 监控和日志

### 应用日志
- PM2日志: `/root/.pm2/logs/meeting-backend-*.log`
- Nginx日志: `/var/log/nginx/access.log`, `/var/log/nginx/error.log`
- MongoDB日志: `/var/log/mongodb/mongod.log`

### 性能监控
```bash
# 系统资源
htop
df -h
free -h

# 应用监控
pm2 monit
```

## 🔒 安全配置

### 防火墙设置
```bash
# 开放必要端口
ufw allow 22    # SSH
ufw allow 80    # HTTP
ufw allow 443   # HTTPS (如需要)
ufw enable
```

### 定期备份
```bash
# 数据库备份
mongodump --db meeting_room_booking --out /backup/$(date +%Y%m%d)

# 代码备份
tar -czf /backup/meeting-backend-$(date +%Y%m%d).tar.gz /opt/meeting-backend
```

## 📝 部署完成清单

- [x] 服务器环境准备
- [x] 后端代码部署
- [x] MongoDB安装和配置
- [x] 环境变量配置
- [x] PM2进程管理设置
- [x] Nginx反向代理配置
- [x] 前端API地址更新
- [x] 服务健康检查
- [x] GitHub代码更新

## 🌐 访问地址

- **API基础地址**: http://47.122.68.192/api/
- **健康检查**: http://47.122.68.192/api/health
- **文件上传**: http://47.122.68.192/uploads/

---

**部署时间**: 2025-06-12  
**部署人员**: Assistant  
**服务器**: 47.122.68.192  
**状态**: ✅ 部署成功 