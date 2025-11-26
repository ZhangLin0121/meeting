# 会议室预订系统 (Meeting Room Booking System)

## 🎯 项目概述

这是一个基于微信小程序的会议室预订系统，采用前后端分离架构设计，为企业或组织提供便捷的会议室管理和预订服务。

### 技术架构
- **前端**: 微信小程序 (WXML, WXSS, JavaScript)
- **后端**: Node.js + Express + MongoDB
- **部署**: PM2 + Nginx + HTTPS
- **服务器**: 47.122.68.192 (www.cacophonyem.me)

### 核心特性
- ✅ 微信小程序登录授权
- ✅ 会议室列表展示与详情查看
- ✅ 实时预约状态查询
- ✅ 灵活的时间段预约（上午、中午、下午、全天）
- ✅ 管理员功能（会议室管理、代预约、统计）
- ✅ 预约历史查看与管理
- ✅ 临时关闭会议室功能
- ✅ 图片上传与管理

## 📁 项目结构

```
meeting/
├── frontend/                    # 微信小程序前端
│   ├── pages/                  # 页面文件
│   │   ├── roomList/          # 会议室列表页
│   │   ├── roomDetail/        # 会议室详情页
│   │   ├── myBookings/        # 我的预约页
│   │   ├── admin/             # 管理员页面
│   │   ├── profile/           # 个人信息页
│   │   └── test/              # 测试页面
│   ├── utils/                 # 工具函数
│   │   ├── auth.js           # 认证工具
│   │   └── request.js        # 网络请求
│   ├── images/               # 图片资源
│   ├── app.js               # 应用入口
│   ├── app.json            # 应用配置
│   └── app.wxss           # 全局样式
│
├── backend/                     # Node.js后端服务
│   ├── controllers/            # 控制器层
│   │   ├── bookingController.js   # 预约管理
│   │   ├── roomController.js      # 会议室管理
│   │   ├── userController.js      # 用户管理
│   │   └── closureController.js   # 临时关闭管理
│   ├── models/                 # 数据模型
│   │   ├── Booking.js         # 预约模型
│   │   ├── ConferenceRoom.js  # 会议室模型
│   │   ├── User.js           # 用户模型
│   │   └── TemporaryClosure.js # 临时关闭模型
│   ├── routes/                # 路由配置
│   ├── middleware/           # 中间件
│   ├── utils/               # 工具函数
│   │   ├── timeHelper.js    # 时间处理工具
│   │   ├── responseHelper.js # 响应格式化工具
│   │   └── validation.js    # 数据验证工具
│   ├── uploads/            # 文件上传目录
│   ├── config.js          # 系统配置
│   └── server.js         # 服务器入口
│
└── docs/                      # 项目文档
    ├── deployment/           # 部署文档
    ├── guides/              # 操作指南
    └── testing/            # 测试文档
```

## ⚙️ 系统配置

### 后端配置 (backend/config.js)

```javascript
module.exports = {
    // 服务器配置
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',

    // MongoDB 数据库配置
    mongodbUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/meeting_room_booking',

    // 微信小程序配置
    wechat: {
        appId: process.env.WECHAT_APP_ID,
        appSecret: process.env.WECHAT_APP_SECRET
    },

    // 会议室开放时间配置
    office: {
        startTime: '08:30',        // 上午开始时间
        endTimeMorning: '12:00',   // 上午结束时间
        startTimeNoon: '12:00',    // 中午开始时间
        endTimeNoon: '14:30',      // 中午结束时间
        startTimeAfternoon: '14:30', // 下午开始时间
        endTime: '22:00'           // 下午结束时间
    },

    // 预约时间限制配置
    booking: {
        maxAdvanceDays: 15,                   // 最大提前预约天数（统一 15 天）
        cancelTimeLimitMinutes: 30,           // 用户取消时间限制（分钟）
        adminCancelTimeLimitMinutes: 5        // 管理员取消时间限制（分钟）
    }
};
```

### 前端配置

前端在 `initializeDates()` 方法中设置了日期选择器的范围：
- 最小日期：当天
- 最大日期：当天+15天

### 微信订阅消息配置
- 后端 `.env` 中配置 `WECHAT_APP_ID`、`WECHAT_APP_SECRET` 与 `WECHAT_SUB_MSG_TEMPLATE_ID`，否则订阅消息发送会跳过。
- 前端在 `frontend/config/env.js` 的 `subscribeTemplateId` 中保持与后端相同的模板 ID，用于请求订阅授权。

## 📋 核心功能

### 1. 用户认证
- 微信小程序登录
- 自动获取用户基本信息
- Session管理

### 2. 会议室管理
- 会议室列表展示
- 会议室详情查看
- 会议室图片上传
- 设备配置管理

### 3. 预约功能
- **时间段预约**: 支持上午(08:30-12:00)、中午(12:00-14:30)、下午(14:30-22:00)、全天(08:30-22:00)
- **灵活时间选择**: 支持自定义开始和结束时间
- **冲突检测**: 实时检查时间段冲突
- **预约验证**: 
  - 只能预约未来时间
  - 限制预约提前时间（默认30天）
  - 最小预约时间30分钟
  - 避免跨越午休时间（全天预约除外）

### 4. 管理员功能
- 会议室CRUD操作
- 代用户预约
- 预约历史查看
- 临时关闭会议室
- 系统统计

### 5. 用户功能
- 查看我的预约
- 取消预约（时间限制内）
- 预约历史查看
- 个人信息管理

## 🚀 部署说明

### ⚠️ 重要提醒：后端代码修改必须部署流程

**每次修改后端代码后，都必须按以下步骤执行完整的部署流程：**

### 第一步：代码推送
```bash
git add .
git commit -m "feat: 具体修改内容描述"
git push origin main
```

### 第二步：服务器部署
```bash
# 连接服务器
ssh root@47.122.68.192

# 进入项目目录并更新代码
cd /root/meeting
git pull origin main

# 进入后端目录并安装新依赖（如果有package.json变化）
cd backend
npm install

# 重启服务
pm2 restart meeting-backend

# 检查服务状态
pm2 status
pm2 logs meeting-backend --lines 20

# 验证部署
curl https://www.cacophonyem.me/meeting/api/health
```

### 第三步：验证功能
- 确认API服务正常响应
- 测试修改的功能是否生效
- 查看服务日志确认无错误

### 🔄 自动化部署脚本（推荐）

创建 `deploy.sh` 脚本自动化部署：

```bash
#!/bin/bash
echo "🚀 开始部署后端代码..."

# 提交代码
git add .
read -p "请输入提交信息: " commit_msg
git commit -m "$commit_msg"
git push origin main

# 部署到服务器
ssh root@47.122.68.192 << 'EOF'
cd /root/meeting-backend
git pull origin main
npm install
pm2 restart meeting-backend
pm2 status
echo "✅ 部署完成"
EOF

echo "🎉 部署流程完成，请验证服务状态"
```

### 前端部署
1. 使用微信开发者工具打开 `frontend` 目录
2. 编译并上传至微信小程序平台
3. 提交审核和发布

## 🔧 开发指南

### 环境要求
- Node.js >= 14.0
- MongoDB >= 4.0
- 微信开发者工具

### 开发环境搭建

1. **克隆项目**
```bash
git clone [项目地址]
cd meeting
```

2. **后端设置**
```bash
cd backend
npm install
cp .env.example .env  # 配置环境变量
npm start
```

3. **前端设置**
```bash
# 使用微信开发者工具打开 frontend 目录
# 配置小程序 AppID
# 启动调试模式
```

### 数据库初始化
```bash
# 初始化会议室数据
node backend/initializeRoomData.js

# 设置管理员权限
node backend/scripts/setAdmin.js [openid]
```

## 🛠️ 常用API

### 用户相关
- `POST /api/user/wechat-login` - 微信登录
- `GET /api/user/profile` - 获取用户信息
- `PUT /api/user/profile` - 更新用户信息

### 会议室相关
- `GET /api/rooms` - 获取会议室列表
- `GET /api/rooms/:id` - 获取会议室详情
- `GET /api/rooms/:id/availability` - 获取会议室可用性

### 预约相关
- `POST /api/bookings` - 创建预约
- `GET /api/bookings/my` - 获取我的预约
- `DELETE /api/bookings/:id` - 取消预约
- `POST /api/bookings/manual` - 管理员代预约

## 📊 时间配置说明

### 预约时间限制
系统有两个地方控制预约时间限制，统一为 **15 天**：

1. **后端配置** (`backend/config.js`)
   - `booking.maxAdvanceDays`: 控制最大提前预约天数（默认 15 天）
   - 影响API验证和错误提示信息

2. **前端配置** (`frontend/pages/roomDetail/roomDetail.js`)
   - `initializeDates()` 方法中将最大日期设置为当天 + 15 天
   - 控制日期选择器的最大可选日期

### 办公时间配置
- 上午时段：08:30 - 12:00
- 中午时段：12:00 - 14:30  
- 下午时段：14:30 - 22:00
- 全天预约：08:30 - 22:00

## 🧪 测试

### API测试
```bash
# 健康检查
curl https://www.cacophonyem.me/meeting/api/health

# 用户登录测试
curl -X POST https://www.cacophonyem.me/meeting/api/user/wechat-login \
  -H "Content-Type: application/json" \
  -d '{"code":"test_code"}'
```

### 前端测试
使用 `pages/test/test.js` 页面进行功能测试：
- 用户登录流程
- API连接测试
- 页面跳转验证

## 📝 更新日志

### 当前版本特性
- ✅ 微信小程序完整功能
- ✅ 响应式设计适配
- ✅ 管理员权限系统
- ✅ 图片上传功能
- ✅ 预约冲突检测
- ✅ 临时关闭功能
- ✅ 数据缓存优化

### 计划功能
- 🔄 消息推送通知
- 🔄 预约审批流程
- 🔄 会议室设备管理
- 🔄 统计报表功能

## 🚨 注意事项

1. **安全考虑**
   - 不在前端存储敏感信息
   - 所有API请求验证用户身份
   - 使用HTTPS传输

2. **性能优化**
   - 合理使用 `setData` 避免频繁更新
   - 图片懒加载和适当压缩
   - 数据缓存和分页加载

3. **用户体验**
   - 清晰的加载状态提示
   - 友好的错误信息
   - 网络异常处理

## 📞 技术支持

如有问题请联系开发团队或查看项目文档。

---

**版本**: v1.0.0  
**最后更新**: 2024年  
**维护者**: 开发团队 
