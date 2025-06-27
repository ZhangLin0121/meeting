/**
 * Console输出控制工具
 * 在生产环境中禁用或限制console输出以提升性能
 */

const envConfig = require('../config/env.js');

class ConsoleManager {
    constructor() {
        this.isDebugMode = envConfig.debug;
        this.originalConsole = {
            log: console.log,
            warn: console.warn,
            error: console.error,
            info: console.info,
            debug: console.debug
        };

        // 根据调试模式决定是否重写console方法
        if (!this.isDebugMode) {
            this.overrideConsole();
        } else {
            // 调试模式下，确保console正常工作
            this.restoreConsole();
        }
    }

    /**
     * 重写console方法
     */
    overrideConsole() {
        // 生产环境只保留error输出，其他都禁用
        console.log = () => {};
        console.info = () => {};
        console.debug = () => {};
        console.warn = this.limitedWarn.bind(this);
        console.error = this.limitedError.bind(this);
    }

    /**
     * 受限的warn输出（只保留重要警告）
     */
    limitedWarn(...args) {
        const message = args[0];
        // 只输出包含特定关键词的重要警告
        if (typeof message === 'string' &&
            (message.includes('❌') ||
                message.includes('⚠️') ||
                message.includes('内存') ||
                message.includes('网络'))) {
            this.originalConsole.warn(...args);
        }
    }

    /**
     * 受限的error输出（保留所有错误）
     */
    limitedError(...args) {
        this.originalConsole.error(...args);
    }

    /**
     * 强制输出（无视环境设置）
     */
    forceLog(...args) {
        this.originalConsole.log(...args);
    }

    /**
     * 恢复原始console
     */
    restoreConsole() {
        console.log = this.originalConsole.log;
        console.warn = this.originalConsole.warn;
        console.error = this.originalConsole.error;
        console.info = this.originalConsole.info;
        console.debug = this.originalConsole.debug;
    }
}

// 创建并导出管理器
const consoleManager = new ConsoleManager();

module.exports = consoleManager;