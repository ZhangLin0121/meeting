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

                    // 内存使用超过30MB时发出警告并清理
                    if (memoryInfo.usedJSHeapSize > 30) {
                        this.warn('⚠️ 内存使用较高:', memoryInfo);
                        this.performCleanup();

                        // 内存使用超过50MB时强制清理
                        if (memoryInfo.usedJSHeapSize > 50) {
                            this.warn('🚨 内存使用过高，执行强制清理');
                            this.forceCleanup();
                        }
                    }
                }
            } catch (error) {
                // 忽略不支持的设备
            }
        };

        // 每60秒检查一次内存（降低频率减少开销）
        this.setInterval(checkMemory, 60000);
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
            // 清理过期的错误日志（只保留最近30条）
            const errorLogs = wx.getStorageSync('errorLogs') || [];
            if (errorLogs.length > 30) {
                wx.setStorageSync('errorLogs', errorLogs.slice(0, 30));
            }

            // 清理过期的普通日志（只保留最近50条）
            const logs = wx.getStorageSync('logs') || [];
            if (logs.length > 50) {
                wx.setStorageSync('logs', logs.slice(0, 50));
            }

            // 清理过期的表单缓存
            const formCache = wx.getStorageSync('bookingFormCache');
            if (formCache && formCache.timestamp) {
                const twoHoursAgo = Date.now() - (2 * 60 * 60 * 1000);
                if (formCache.timestamp < twoHoursAgo) {
                    wx.removeStorageSync('bookingFormCache');
                    this.log('🧹 清理过期表单缓存');
                }
            }
        } catch (error) {
            this.error('❌ 清理本地存储失败:', error);
        }
    }

    /**
     * 强制清理内存（在内存使用过高时调用）
     */
    forceCleanup() {
        try {
            // 清空所有缓存
            this.imageCache.clear();
            this.requestCache.clear();

            // 触发垃圾回收（如果支持）
            if (wx.triggerGC && typeof wx.triggerGC === 'function') {
                wx.triggerGC();
                this.log('🧹 已触发垃圾回收');
            }

            // 清理本地存储中的非必要数据
            try {
                wx.removeStorageSync('logs');
                wx.removeStorageSync('bookingFormCache');
                this.log('🧹 强制清理完成');
            } catch (storageError) {
                this.warn('⚠️ 清理本地存储时出错:', storageError);
            }

        } catch (error) {
            this.error('❌ 强制清理失败:', error);
        }
    }

    /**
     * 定期清理
     */
    scheduleCleanup() {
        // 每3分钟清理一次（更频繁的清理以减少内存积累）
        this.setInterval(() => {
            this.performCleanup();
        }, 3 * 60 * 1000);
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

    /**
     * 页面级别的内存优化初始化
     * 在页面onLoad时调用
     */
    initPageOptimization(page) {
        if (!page) return;

        // 为页面添加安全的定时器管理
        page._timers = [];
        page._originalSetTimeout = page.setTimeout || setTimeout;
        page._originalSetInterval = page.setInterval || setInterval;

        // 重写页面的setTimeout和setInterval
        page.safeSetTimeout = (callback, delay) => {
            const timer = this.setTimeout(callback, delay);
            page._timers.push(timer);
            return timer;
        };

        page.safeSetInterval = (callback, interval) => {
            const timer = this.setInterval(callback, interval);
            page._timers.push(timer);
            return timer;
        };

        // 页面卸载时自动清理
        const originalOnUnload = page.onUnload || function() {};
        page.onUnload = function() {
            this.cleanupPageResources();
            originalOnUnload.call(this);
        };

        // 添加页面资源清理方法
        page.cleanupPageResources = () => {
            // 清理定时器
            if (page._timers && page._timers.length > 0) {
                console.log(`🧹 清理页面 ${page._timers.length} 个定时器`);
                page._timers.forEach(timer => {
                    clearTimeout(timer);
                    clearInterval(timer);
                });
                page._timers = [];
            }

            // 清理大型数据
            if (page.data && page.setData) {
                const cleanData = {};

                // 清理可能的大型数组
                if (page.data.timeSlots && page.data.timeSlots.length > 50) {
                    cleanData.timeSlots = [];
                }

                if (page.data.bookingList && page.data.bookingList.length > 20) {
                    cleanData.bookingList = [];
                }

                if (Object.keys(cleanData).length > 0) {
                    page.setData(cleanData);
                }
            }

            console.log('✅ 页面资源清理完成');
        };

        console.log('✅ 页面内存优化初始化完成');
    }

    /**
     * 获取内存使用信息
     */
    getMemoryInfo() {
        try {
            const performance = wx.getPerformance();
            if (performance && performance.memory) {
                return {
                    usedJSHeapSize: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024),
                    totalJSHeapSize: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024),
                    jsHeapSizeLimit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024)
                };
            }
        } catch (error) {
            // 忽略不支持的设备
        }
        return null;
    }
}

// 创建全局实例
const performanceManager = new PerformanceManager();

module.exports = performanceManager;