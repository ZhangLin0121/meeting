/**
 * 环境配置文件
 * 统一管理不同环境的API地址和其他配置
 */

// 环境类型
const ENV = {
    DEVELOPMENT: 'development',
    PRODUCTION: 'production'
};

// 当前环境 - 在这里切换环境
const CURRENT_ENV = ENV.DEVELOPMENT; // 改为 ENV.DEVELOPMENT 启用调试模式

// 不同环境的配置
const CONFIG = {
    [ENV.DEVELOPMENT]: {
        apiBaseUrl: 'http://localhost:3000',
        environment: 'development',
        debug: true,
        timeout: 10000
    },
    [ENV.PRODUCTION]: {
        apiBaseUrl: 'https://www.cacophonyem.me/meeting',
        environment: 'production',
        debug: false,
        timeout: 15000
    }
};

// 获取当前环境配置
function getCurrentConfig() {
    return CONFIG[CURRENT_ENV];
}

// 导出配置
module.exports = {
    ENV,
    CURRENT_ENV,
    CONFIG,
    getCurrentConfig,

    // 便捷访问当前配置
    apiBaseUrl: getCurrentConfig().apiBaseUrl,
    environment: getCurrentConfig().environment,
    debug: getCurrentConfig().debug,
    timeout: getCurrentConfig().timeout,

    // 判断当前环境
    isDevelopment: () => CURRENT_ENV === ENV.DEVELOPMENT,
    isProduction: () => CURRENT_ENV === ENV.PRODUCTION
};