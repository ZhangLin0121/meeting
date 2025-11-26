# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🏗️ 项目架构

始终使用中文和我进行交流。

### 后端 (Backend)
- **技术栈**: Node.js + Express + MongoDB + Mongoose
- **目录结构**: `/backend/`
  - `server.js` - 主服务器文件
  - `config.js` - 配置文件
  - `database.js` - 数据库连接
  - `models/` - Mongoose 数据模型
  - `routes/` - API 路由
  - `controllers/` - 控制器逻辑
  - `utils/` - 工具函数

### 前端 (Frontend)
- **技术栈**: 微信小程序原生开发
- **目录结构**: `/frontend/`
  - `app.js` - 小程序入口
  - `pages/` - 页面组件
  - `components/` - 可复用组件
  - `services/` - 业务服务层
  - `utils/` - 工具函数
  - `config/` - 配置文件

## 🚀 开发命令

### 后端开发
```bash
# 安装依赖
cd backend && npm install

# 开发模式启动 (使用nodemon)
npm run dev

# 生产模式启动
npm start

# PM2 进程管理
npm run pm2:start    # 启动服务
npm run pm2:stop     # 停止服务
npm run pm2:restart  # 重启服务
npm run pm2:logs     # 查看日志
npm run pm2:delete   # 删除进程

# 根目录快捷命令
./start.sh    # 启动后端服务
./stop.sh     # 停止后端服务
```

### 前端开发
- 使用微信开发者工具打开 `/frontend` 目录
- 开发时需要启动后端服务提供 API

## 🔧 环境配置

### 后端环境变量
复制 `.env.example` 创建 `.env` 文件：
```bash
cd backend
cp .env.example .env
# 编辑 .env 文件配置你的环境变量
```

### 前端环境配置
编辑 `frontend/config/env.js`：
```javascript
// 切换开发/生产环境
const CURRENT_ENV = ENV.DEVELOPMENT; // 或 ENV.PRODUCTION

// API 基础地址配置
apiBaseUrl: 'http://localhost:3000'  // 开发环境
apiBaseUrl: 'https://your-domain.com' // 生产环境
```

## 📊 数据库

### MongoDB 连接
- 开发环境: `mongodb://localhost:27017/meeting_room_booking`
- 生产环境: 通过环境变量 `MONGODB_URI` 配置

### 数据模型
- `User` - 用户信息
- `ConferenceRoom` - 会议室信息
- `Booking` - 预约记录
- `TemporaryClosure` - 临时关闭记录

## 🌐 API 接口

### 基础 URL
- 开发: `http://localhost:3000/api`
- 生产: `https://your-domain.com/api`

### 主要接口
- `GET /api/health` - 健康检查
- `POST /api/user/wechat-login` - 微信登录
- `GET /api/rooms` - 获取会议室列表
- `GET /api/rooms/:id` - 获取会议室详情
- `POST /api/bookings` - 创建预约
- `GET /api/bookings` - 获取预约列表
- `DELETE /api/bookings/:id` - 取消预约

## 🧪 测试

### 功能测试
参考 `docs/testing/测试说明.md` 进行功能测试：
- 整时段预约功能
- 精确时间预约功能
- 预约状态管理

### 创建测试数据
```bash
# 运行测试数据脚本
cd backend && node scripts/create_test_bookings.js
```

## 🚀 部署

### 服务器部署
参考 `docs/deployment/deployment.md` 完整部署指南：

1. **服务器准备**: Ubuntu + Node.js v18 + MongoDB 7.0
2. **代码部署**: 使用 rsync 上传代码
3. **环境配置**: 设置生产环境变量
4. **进程管理**: 使用 PM2 管理 Node.js 进程
5. **反向代理**: Nginx 配置 API 代理
6. **数据库**: MongoDB 安装和初始化

### 部署命令
```bash
# 服务器部署脚本
./deploy_unified_nginx.sh

# 回滚脚本
./rollback_nginx.sh
```

## 🔍 调试和监控

### 后端日志
- PM2 日志: `pm2 logs meeting-backend`
- 开发日志: 控制台输出

### 前端调试
- 微信开发者工具调试面板
- 网络请求监控
- 控制台日志输出

## 📁 重要文件

### 后端核心文件
- `backend/server.js` - 服务器入口
- `backend/config.js` - 应用配置
- `backend/database.js` - 数据库连接
- `backend/routes/index.js` - 路由配置

### 前端核心文件
- `frontend/app.js` - 小程序入口
- `frontend/utils/request.js` - 网络请求
- `frontend/config/env.js` - 环境配置
- `frontend/services/` - 业务服务

## ⚡ 性能优化

### 已实现的优化
- 组件懒加载配置
- 图片压缩和优化
- 网络请求超时控制
- 数据库连接池配置

### 监控指标
- API 响应时间
- 数据库查询性能
- 内存使用情况
- 并发连接数

## 🔒 安全配置

### 生产环境安全
- 环境变量保护敏感信息
- Nginx 反向代理
- 请求频率限制
- 输入验证和过滤