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
const CURRENT_ENV = ENV.PRODUCTION; // 生产环境

// 不同环境的配置
const CONFIG = {
    [ENV.DEVELOPMENT]: {
        apiBaseUrl: 'http://localhost:3000',
        environment: 'development',
        debug: true,
        timeout: 10000,
        subscribeTemplateId: 'D5h5Vcz2HrYxpAVClFsRLA0t-K1zR4A_FJxld3Fe08w',
        cancelTemplateId: 'IousbkyGHmqRnN-kC65aHF3bMBmVOhPgLNFqwcnb2O8'
    },
    [ENV.PRODUCTION]: {
        apiBaseUrl: 'https://www.cacophonyem.me/meeting', // 使用HTTPS，现在配置正确了
        environment: 'production',
        debug: false, // 关闭生产环境调试日志
        timeout: 15000,
        subscribeTemplateId: 'D5h5Vcz2HrYxpAVClFsRLA0t-K1zR4A_FJxld3Fe08w',
        cancelTemplateId: 'IousbkyGHmqRnN-kC65aHF3bMBmVOhPgLNFqwcnb2O8'
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
    subscribeTemplateId: getCurrentConfig().subscribeTemplateId,
    cancelTemplateId: getCurrentConfig().cancelTemplateId,

    // 判断当前环境
    isDevelopment: () => CURRENT_ENV === ENV.DEVELOPMENT,
    isProduction: () => CURRENT_ENV === ENV.PRODUCTION
};
