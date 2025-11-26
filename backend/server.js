const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');

// 导入配置和工具
const config = require('./config');
const { connectDatabase } = require('./database');
const routes = require('./routes');
const ResponseHelper = require('./utils/responseHelper');

/**
 * 微信会议室预约小程序后端服务
 */

// 创建Express应用
const app = express();

// 中间件配置
app.use(cors({
    origin: true, // 允许所有来源，生产环境应该配置具体域名
    credentials: true
}));

app.use(morgan('combined')); // 请求日志
app.use(express.json({ limit: '10mb' })); // JSON解析
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // URL编码解析

// 静态文件服务（用于图片上传）
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API路由
app.use('/api', routes);

// 根路径
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '微信会议室预约小程序后端服务',
        version: '1.0.0',
        timestamp: new Date().toISOString(),
        docs: '/api/health'
    });
});

// 全局错误处理中间件
app.use((error, req, res, next) => {
    console.error('全局错误处理:', error);

    // Mongoose验证错误
    if (error.name === 'ValidationError') {
        const errors = Object.values(error.errors).map(err => ({
            field: err.path,
            message: err.message
        }));
        return ResponseHelper.validationError(res, '数据验证失败', errors);
    }

    // Mongoose重复键错误
    if (error.code === 11000) {
        const field = Object.keys(error.keyPattern)[0];
        return ResponseHelper.error(res, `${field} 已存在`, 409);
    }

    // JWT错误
    if (error.name === 'JsonWebTokenError') {
        return ResponseHelper.unauthorized(res, '无效的访问令牌');
    }

    if (error.name === 'TokenExpiredError') {
        return ResponseHelper.unauthorized(res, '访问令牌已过期');
    }

    // 默认服务器错误
    return ResponseHelper.serverError(res, '服务器内部错误',
        config.nodeEnv === 'development' ? error.message : undefined
    );
});

// 404处理
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        code: 404,
        message: '页面不存在',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

/**
 * 启动服务器
 */
async function startServer() {
    try {
        // 连接数据库
        await connectDatabase();

        // 创建上传目录
        const fs = require('fs');
        const uploadDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
            console.log('✅ 创建上传目录:', uploadDir);
        }

        // 启动HTTP服务器
        const server = app.listen(config.port, () => {
            console.log('🚀 服务器启动成功!');
            console.log(`📍 服务地址: http://localhost:${config.port}`);
            console.log(`🌍 环境: ${config.nodeEnv}`);
            console.log(`⏰ 启动时间: ${new Date().toLocaleString('zh-CN', { timeZone: config.timezone })}`);
            console.log('📋 可用接口:');
            console.log('   GET  /api/health - 健康检查');
            console.log('   POST /api/user/login - 用户登录');
            console.log('   GET  /api/rooms - 获取会议室列表');
            console.log('   POST /api/bookings - 创建预约');
        });

        // 优雅关闭
        process.on('SIGTERM', () => {
            console.log('📴 收到SIGTERM信号，开始优雅关闭...');
            server.close(() => {
                console.log('✅ HTTP服务器已关闭');
                process.exit(0);
            });
        });

        process.on('SIGINT', () => {
            console.log('📴 收到SIGINT信号，开始优雅关闭...');
            server.close(() => {
                console.log('✅ HTTP服务器已关闭');
                process.exit(0);
            });
        });

    } catch (error) {
        console.error('❌ 服务器启动失败:', error);
        process.exit(1);
    }
}

// 启动服务器
startServer();

module.exports = app;