const mongoose = require('mongoose');
const config = require('./config');

/**
 * 连接MongoDB数据库
 */
async function connectDatabase() {
    try {
        // 配置mongoose选项
        const options = {
            // 使用新的URL解析器
            useNewUrlParser: true,
            // 使用新的服务器发现和监视引擎
            useUnifiedTopology: true,
            // 连接超时时间
            serverSelectionTimeoutMS: 5000,
            // 心跳频率
            heartbeatFrequencyMS: 10000,
            // 最大连接池大小
            maxPoolSize: 10,
            // 最小连接池大小
            minPoolSize: 2,
            // 连接空闲时间
            maxIdleTimeMS: 30000,
        };

        await mongoose.connect(config.mongodbUri, options);

        console.log('✅ MongoDB 数据库连接成功');
        console.log(`📊 数据库地址: ${config.mongodbUri}`);

        // 监听数据库连接事件
        mongoose.connection.on('error', (err) => {
            console.error('❌ MongoDB 连接错误:', err);
        });

        mongoose.connection.on('disconnected', () => {
            console.warn('⚠️  MongoDB 连接断开');
        });

        mongoose.connection.on('reconnected', () => {
            console.log('✅ MongoDB 重新连接成功');
        });

    } catch (error) {
        console.error('❌ MongoDB 数据库连接失败:', error.message);
        process.exit(1);
    }
}

/**
 * 关闭数据库连接
 */
async function closeDatabaseConnection() {
    try {
        await mongoose.connection.close();
        console.log('✅ MongoDB 数据库连接已关闭');
    } catch (error) {
        console.error('❌ 关闭数据库连接时出错:', error.message);
    }
}

// 导出连接函数
module.exports = {
    connectDatabase,
    closeDatabaseConnection
};