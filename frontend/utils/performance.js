/**
 * 小程序性能优化工具
 * 解决卡顿和内存占用问题
 */

const envConfig = require('../config/env.js');

class PerformanceManager {
    constructor() {
        this.isDebugMode = envConfig.debug;
        this.timers = new Set(); // 管理定时器，防止内存泄漏
        this.imageCache = new Map(); // 图片缓存
        this.requestCache = new Map(); // 请求缓存
        this.lastCleanTime = Date.now();

        // 初始化性能监控
        this.initPerformanceMonitor();
    }

    /**
     * 初始化性能监控
     */
    initPerformanceMonitor() {
        // 监控内存使用
        this.monitorMemory();

        // 定期清理缓存
        this.scheduleCleanup();
    }

    /**
     * 安全的console.log - 只在调试模式下输出
     */
    log(message, data = null) {
        if (this.isDebugMode) {
            if (data) {
                console.log(message, data);
            } else {
                console.log(message);
            }
        }
    }

    /**
     * 安全的console.error - 总是输出错误
     */
    error(message, error = null) {
        if (error) {
            console.error(message, error);
        } else {
            console.error(message);
        }
    }

    /**
     * 安全的console.warn - 只在调试模式下输出
     */
    warn(message, data = null) {
        if (this.isDebugMode) {
            if (data) {
                console.warn(message, data);
            } else {
                console.warn(message);
            }
        }
    }

    /**
     * 安全的setTimeout，自动管理清理
     */
    setTimeout(callback, delay) {
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            callback();
        }, delay);
        this.timers.add(timer);
        return timer;
    }

    /**
     * 安全的setInterval，自动管理清理
     */
    setInterval(callback, interval) {
        const timer = setInterval(callback, interval);
        this.timers.add(timer);
        return timer;
    }

    /**
     * 清理定时器
     */
    clearTimer(timer) {
        if (this.timers.has(timer)) {
            clearTimeout(timer);
            clearInterval(timer);
            this.timers.delete(timer);
        }
    }

    /**
     * 清理所有定时器
     */
    clearAllTimers() {
        this.timers.forEach(timer => {
            clearTimeout(timer);
            clearInterval(timer);
        });
        this.timers.clear();
    }

    /**
     * 图片预加载优化
     */
    preloadImage(src) {
        return new Promise((resolve, reject) => {
            // 检查缓存
            if (this.imageCache.has(src)) {
                resolve(this.imageCache.get(src));
                return;
            }

            const image = wx.createOffscreenCanvas();
            const ctx = image.getContext('2d');

            wx.getImageInfo({
                src: src,
                success: (res) => {
                    this.imageCache.set(src, {
                        width: res.width,
                        height: res.height,
                        path: res.path,
                        cached: true
                    });
                    resolve(res);
                },
                fail: reject
            });
        });
    }

    /**
     * 请求缓存管理
     */
    cacheRequest(key, data, ttl = 5 * 60 * 1000) { // 默认5分钟缓存
        this.requestCache.set(key, {
            data: data,
            timestamp: Date.now(),
            ttl: ttl
        });
    }

    /**
     * 获取缓存的请求
     */
    getCachedRequest(key) {
        const cached = this.requestCache.get(key);
        if (!cached) return null;

        const isExpired = Date.now() - cached.timestamp > cached.ttl;
        if (isExpired) {
            this.requestCache.delete(key);
            return null;
        }

        return cached.data;
    }

    /**
     * 监控内存使用
     */
    monitorMemory() {
        if (!this.isDebugMode) return;

        const checkMemory = () => {
            try {
                const performance = wx.getPerformance();
                if (performance && performance.memory) {
                    const memoryInfo = {
                        usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                        totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                        jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                    };

                    // 内存使用超过50MB时发出警告
                    if (memoryInfo.usedJSHeapSize > 50) {
                        this.warn('⚠️ 内存使用较高:', memoryInfo);
                        this.performCleanup();
                    }
                }
            } catch (error) {
                // 忽略不支持的设备
            }
        };

        // 每30秒检查一次内存
        this.setInterval(checkMemory, 30000);
    }

    /**
     * 执行清理操作
     */
    performCleanup() {
        const now = Date.now();

        // 清理过期的请求缓存
        for (const [key, cached] of this.requestCache.entries()) {
            if (now - cached.timestamp > cached.ttl) {
                this.requestCache.delete(key);
            }
        }

        // 清理过期的图片缓存（保留最近1小时的）
        for (const [key, cached] of this.imageCache.entries()) {
            if (now - cached.timestamp > 60 * 60 * 1000) {
                this.imageCache.delete(key);
            }
        }

        // 清理本地存储中的过期数据
        this.cleanupStorage();

        this.log('🧹 执行了缓存清理');
    }

    /**
     * 清理本地存储
     */
    cleanupStorage() {
        try {
            // 清理过期的错误日志（只保留最近50条）
            const errorLogs = wx.getStorageSync('errorLogs') || [];
            if (errorLogs.length > 50) {
                wx.setStorageSync('errorLogs', errorLogs.slice(0, 50));
            }

            // 清理过期的普通日志（只保留最近100条）
            const logs = wx.getStorageSync('logs') || [];
            if (logs.length > 100) {
                wx.setStorageSync('logs', logs.slice(0, 100));
            }
        } catch (error) {
            this.error('❌ 清理本地存储失败:', error);
        }
    }

    /**
     * 定期清理
     */
    scheduleCleanup() {
        // 每10分钟清理一次
        this.setInterval(() => {
            this.performCleanup();
        }, 10 * 60 * 1000);
    }

    /**
     * 页面卸载时清理
     */
    onPageUnload() {
        this.clearAllTimers();
    }

    /**
     * 优化setData调用
     */
    optimizedSetData(page, data) {
        // 批量更新，减少setData调用次数
        if (page._pendingSetData) {
            Object.assign(page._pendingSetData, data);
            return;
        }

        page._pendingSetData = {...data };

        wx.nextTick(() => {
            if (page._pendingSetData) {
                page.setData(page._pendingSetData);
                page._pendingSetData = null;
            }
        });
    }

    /**
     * 防抖函数
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    /**
     * 节流函数
     */
    throttle(func, limit) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
}

// 创建全局实例
const performanceManager = new PerformanceManager();

module.exports = performanceManager;