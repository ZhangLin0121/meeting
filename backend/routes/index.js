const express = require('express');
const router = express.Router();

// 导入各模块路由
const userRoutes = require('./userRoutes');
const roomRoutes = require('./roomRoutes');
const bookingRoutes = require('./bookingRoutes');
const closureRoutes = require('./closureRoutes');
const uploadRoutes = require('./uploadRoutes');

/**
 * API 路由配置
 */

// 健康检查接口
router.get('/health', async (req, res) => {
    const mongoose = require('mongoose');

    const dbStatus = {
        connected: mongoose.connection.readyState === 1,
        readyState: mongoose.connection.readyState,
        host: mongoose.connection.host,
        name: mongoose.connection.name
    };

    res.json({
        success: true,
        message: '服务运行正常',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        database: dbStatus
    });
});

// 用户相关路由
router.use('/user', userRoutes);

// 会议室相关路由
router.use('/rooms', roomRoutes);

// 预约相关路由
router.use('/bookings', bookingRoutes);

// 临时关闭相关路由
router.use('/closures', closureRoutes);

// 文件上传相关路由
router.use('/upload', uploadRoutes);

// 404 处理
router.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        code: 404,
        message: 'API接口不存在',
        path: req.originalUrl,
        timestamp: new Date().toISOString()
    });
});

module.exports = router;