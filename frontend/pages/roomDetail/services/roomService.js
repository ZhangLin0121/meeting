// 房间服务模块
const request = require('../../../utils/request.js');

class RoomService {
    /**
     * 获取房间详情
     * @param {string} roomId 房间ID
     * @param {string} userOpenId 用户openid
     * @returns {Promise<Object>} 房间详情
     */
    static async fetchRoomDetails(roomId, userOpenId) {
        console.log('🏠 获取房间详情:', { roomId, userOpenId });
        
        try {
            const response = await request.get(`/api/rooms/${roomId}`);
            
            console.log('✅ 房间详情获取成功:', response);
            return response;
        } catch (error) {
            console.error('❌ 获取房间详情失败:', error);
            throw error;
        }
    }
}

/**
 * 页面管理器
 */
class PageManager {
    constructor(pageContext) {
        this.page = pageContext;
        this.timers = [];
    }

    /**
     * 安全设置定时器
     * @param {Function} callback 回调函数
     * @param {number} delay 延迟时间
     * @returns {number} 定时器ID
     */
    safeSetTimeout(callback, delay) {
        const timerId = setTimeout(() => {
            try {
                callback();
            } catch (error) {
                console.error('❌ 定时器执行失败:', error);
            } finally {
                // 从数组中移除已执行的定时器
                const index = this.timers.indexOf(timerId);
                if (index > -1) {
                    this.timers.splice(index, 1);
                }
            }
        }, delay);

        this.timers.push(timerId);
        return timerId;
    }

    /**
     * 清除所有定时器
     */
    clearAllTimers() {
        console.log('🧹 清除所有定时器:', this.timers.length);
        
        this.timers.forEach(timerId => {
            try {
                clearTimeout(timerId);
            } catch (error) {
                console.error('❌ 清除定时器失败:', error);
            }
        });
        
        this.timers = [];
    }

    /**
     * 清理数据对象
     */
    clearDataObjects() {
        console.log('🧹 清理页面数据对象');
        
        try {
            this.page.setData({
                roomDetails: {},
                timePeriods: [],
                timeSlots: [],
                bookingForm: {
                    topic: '',
                    contactName: '',
                    contactPhone: '',
                    attendeesCount: 1,
                    requirements: ''
                },
                selectedTimeSlot: null,
                wholePeriodBooking: null
            });
        } catch (error) {
            console.error('❌ 清理数据对象失败:', error);
        }
    }
}

/**
 * 滚动管理器
 */
class ScrollManager {
    constructor(pageContext) {
        this.page = pageContext;
    }

    /**
     * 滚动到时间段选择区域
     */
    scrollToTimeSlots() {
        console.log('📜 滚动到时间段选择区域');
        
        try {
            // 创建查询对象
            const query = wx.createSelectorQuery().in(this.page);
            
            query.select('#timeSelection').boundingClientRect((rect) => {
                if (rect) {
                    const scrollTop = rect.top + this.page.data.scrollTop - 100;
                    console.log('📍 计算滚动位置:', { rectTop: rect.top, currentScrollTop: this.page.data.scrollTop, targetScrollTop: scrollTop });
                    
                    wx.pageScrollTo({
                        scrollTop: Math.max(0, scrollTop),
                        duration: 300
                    });
                } else {
                    console.warn('⚠️ 未找到时间选择区域元素');
                }
            }).exec();
        } catch (error) {
            console.error('❌ 滚动失败:', error);
        }
    }

    /**
     * 平滑滚动到时间段选择区域
     */
    scrollToTimeSlotsSmooth() {
        console.log('📜 平滑滚动到时间段选择区域');
        
        try {
            const query = wx.createSelectorQuery().in(this.page);
            
            query.select('#timeSelection').boundingClientRect((rect) => {
                if (rect) {
                    const currentScrollTop = this.page.data.scrollTop;
                    const targetScrollTop = Math.max(0, rect.top + currentScrollTop - 100);
                    
                    console.log('📍 平滑滚动参数:', {
                        rectTop: rect.top,
                        currentScrollTop,
                        targetScrollTop
                    });
                    
                    this.animateScrollTo(currentScrollTop, targetScrollTop, 500);
                } else {
                    console.warn('⚠️ 未找到时间选择区域元素');
                    // 备用方案：直接滚动
                    this.scrollToTimeSlots();
                }
            }).exec();
        } catch (error) {
            console.error('❌ 平滑滚动失败，使用普通滚动:', error);
            this.scrollToTimeSlots();
        }
    }

    /**
     * 动画滚动到指定位置
     * @param {number} startScrollTop 开始位置
     * @param {number} endScrollTop 结束位置
     * @param {number} duration 动画时长
     */
    animateScrollTo(startScrollTop, endScrollTop, duration) {
        const startTime = Date.now();
        const distance = endScrollTop - startScrollTop;
        
        const animateStep = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / duration, 1);
            
            // 使用缓动函数
            const easeProgress = this.easeOutCubic(progress);
            const currentScrollTop = startScrollTop + (distance * easeProgress);
            
            wx.pageScrollTo({
                scrollTop: currentScrollTop,
                duration: 0
            });
            
            if (progress < 1) {
                requestAnimationFrame(animateStep);
            }
        };
        
        animateStep();
    }

    /**
     * 缓动函数 - 三次方缓出
     * @param {number} t 进度值 (0-1)
     * @returns {number} 缓动后的值
     */
    easeOutCubic(t) {
        return 1 - Math.pow(1 - t, 3);
    }

    /**
     * 页面滚动事件处理
     * @param {Object} e 滚动事件对象
     */
    onScroll(e) {
        // 节流处理，避免频繁更新
        if (this.scrollTimer) {
            clearTimeout(this.scrollTimer);
        }
        
        this.scrollTimer = setTimeout(() => {
            this.page.setData({
                scrollTop: e.detail.scrollTop
            });
        }, 16); // 约60fps
    }
}

/**
 * 图片加载管理器
 */
class ImageManager {
    /**
     * 图片加载成功处理
     * @param {Object} pageContext 页面上下文
     */
    static onImageLoad(pageContext) {
        console.log('🖼️ 房间图片加载成功');
        pageContext.setData({
            imageLoading: false,
            imageError: false
        });
    }

    /**
     * 图片加载失败处理
     * @param {Object} pageContext 页面上下文
     */
    static onImageError(pageContext) {
        console.error('❌ 房间图片加载失败');
        pageContext.setData({
            imageLoading: false,
            imageError: true
        });
    }
}

/**
 * 页面状态管理器
 */
class StateManager {
    /**
     * 获取安全的App数据
     * @param {Object} pageContext 页面上下文
     */
    static safeGetAppData(pageContext) {
        try {
            const app = getApp();

            if (app && app.globalData) {
                pageContext.setData({
                    apiBaseUrl: app.globalData.apiBaseUrl || pageContext.data.apiBaseUrl
                });
                console.log('✅ 成功获取App全局数据');
            } else {
                console.warn('⚠️ App实例未就绪，使用默认配置');
                
                // 延迟重试获取用户数据
                setTimeout(() => {
                    this.safeGetAppData(pageContext);
                }, 500);
            }
        } catch (error) {
            console.error('❌ 获取App数据失败:', error);
            
            // 延迟重试
            setTimeout(() => {
                this.safeGetAppData(pageContext);
            }, 1000);
        }
    }

    /**
     * 初始化页面状态
     * @param {Object} pageContext 页面上下文
     * @param {Object} options 页面参数
     */
    static initializePageState(pageContext, options) {
        const roomId = options.roomId || options.id;
        if (!roomId) {
            wx.showToast({ title: '房间ID缺失', icon: 'none' });
            wx.navigateBack();
            return false;
        }

        // 获取状态栏高度
        const windowInfo = wx.getWindowInfo();
        const statusBarHeight = windowInfo.statusBarHeight || 44;

        console.log('🔍 调试信息:');
        console.log('📱 窗口信息:', windowInfo);
        console.log('📱 原始状态栏高度:', windowInfo.statusBarHeight);
        console.log('📱 最终状态栏高度:', statusBarHeight);

        pageContext.setData({
            roomId,
            statusBarHeight: statusBarHeight
        });

        return true;
    }
}

module.exports = {
    RoomService,
    PageManager,
    ScrollManager,
    ImageManager,
    StateManager
}; 