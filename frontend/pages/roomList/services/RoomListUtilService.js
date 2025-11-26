// 会议室列表工具服务模块
const envConfig = require('../../../config/env.js');
const WechatAuth = require('../../../utils/auth.js');

class RoomListUtilService {
    /**
     * 获取系统信息，计算状态栏高度和导航栏安全区域
     * @param {Object} pageContext 页面上下文
     */
    static getSystemInfo(pageContext) {
        try {
            const windowInfo = wx.getWindowInfo();
            const menuButtonInfo = wx.getMenuButtonBoundingClientRect();

            console.log('📱 窗口信息:', windowInfo);
            console.log('🔘 胶囊按钮信息:', menuButtonInfo);

            const statusBarHeight = windowInfo.statusBarHeight || 20;

            // 计算自定义导航栏的安全高度
            // 胶囊按钮顶部到状态栏底部的距离 * 2 + 胶囊按钮高度
            const customNavBarHeight = menuButtonInfo.top && menuButtonInfo.height ?
                (menuButtonInfo.top - statusBarHeight) * 2 + menuButtonInfo.height : 44;

            pageContext.setData({
                statusBarHeight: statusBarHeight,
                menuButtonInfo: menuButtonInfo,
                customNavBarHeight: customNavBarHeight
            });

            console.log('✅ 导航栏信息设置完成:', {
                statusBarHeight,
                customNavBarHeight,
                menuButtonInfo
            });
        } catch (error) {
            console.error('❌ 获取系统信息失败:', error);
            pageContext.setData({
                statusBarHeight: 20, // 默认值
                customNavBarHeight: 44 // 默认值
            });
        }
    }

    /**
     * 智能初始化页面 - 确保登录后再加载数据
     * @param {Object} pageContext 页面上下文
     * @param {Function} loginUser 登录函数
     * @param {Function} checkUserRole 检查用户角色函数
     * @param {Function} fetchRooms 获取会议室列表函数
     */
    static async initializePage(pageContext, loginUser, checkUserRole, fetchRooms) {
        try {
            const userInfo = await loginUser();
            if (userInfo && userInfo.openid) {
                // 更新页面数据
                pageContext.setData({
                    userOpenId: userInfo.openid
                });

                // 并行执行用户角色检查和会议室列表获取
                await Promise.all([
                    checkUserRole(pageContext).catch(error => {
                        console.warn('⚠️ 用户角色检查失败，使用默认权限:', error);
                    }),
                    fetchRooms(pageContext).catch(error => {
                        console.error('❌ 获取会议室列表失败:', error);
                        // 不抛出错误，让页面继续显示
                    })
                ]);

            } else {
                throw new Error('登录失败：无法获取用户信息');
            }

        } catch (error) {
            console.error('❌ 页面初始化失败:', error);

            // 显示友好的错误提示
            wx.showModal({
                title: '初始化失败',
                content: '页面加载失败，请检查网络连接后重试',
                showCancel: true,
                cancelText: '取消',
                confirmText: '重试',
                success: (res) => {
                    if (res.confirm) {
                        // 用户选择重试
                        this.initializePage(pageContext, loginUser, checkUserRole, fetchRooms);
                    }
                }
            });
        }
    }

    /**
     * 下拉刷新处理
     * @param {Object} pageContext 页面上下文
     * @param {Function} fetchRooms 获取会议室列表函数
     */
    static onPullDownRefresh(pageContext, fetchRooms) {
        console.log('🔄 用户下拉刷新');

        // 确保用户已登录后再刷新数据
        fetchRooms(pageContext)
            .catch(error => {
                console.error('❌ 下拉刷新失败:', error);
                wx.showToast({
                    title: '刷新失败',
                    icon: 'none',
                    duration: 2000
                });
            })
            .finally(() => {
                wx.stopPullDownRefresh();
            });
    }

    /**
     * 下拉刷新处理函数
     * @param {Object} pageContext 页面上下文
     * @param {Function} fetchRooms 获取会议室列表函数
     */
    static onRefresh(pageContext, fetchRooms) {
        console.log('🔄 下拉刷新触发');
        fetchRooms(pageContext)
            .catch(error => {
                console.error('❌ 刷新失败:', error);
                wx.showToast({
                    title: '刷新失败',
                    icon: 'none'
                });
            });
    }

    /**
     * 页面上拉触底事件处理
     */
    static onReachBottom() {
        // 这里可以实现分页加载逻辑
        console.log('到达底部，可实现分页加载');
    }

    /**
     * 获取用户OpenId
     * @param {Object} pageContext 页面上下文
     */
    static getUserOpenId(pageContext) {
        const userOpenId = WechatAuth.getUserOpenId();
        pageContext.setData({ userOpenId });
        return userOpenId;
    }

    /**
     * 设置API基础URL
     * @param {Object} pageContext 页面上下文
     */
    static setApiBaseUrl(pageContext) {
        pageContext.setData({
            apiBaseUrl: envConfig.apiBaseUrl
        });
    }

    /**
     * 打印页面状态（用于调试）
     * @param {Object} pageContext 页面上下文
     */
    static printPageStatus(pageContext) {
        console.log('🔍 当前页面状态:', {
            userOpenId: pageContext.data.userOpenId,
            apiBaseUrl: pageContext.data.apiBaseUrl,
            loading: pageContext.data.loading,
            roomsCount: pageContext.data.rooms.length,
            isAdmin: pageContext.data.isAdmin
        });
    }

    /**
     * 显示错误提示
     * @param {string} title 标题
     * @param {string} content 内容
     * @param {Function} retryCallback 重试回调函数
     */
    static showErrorModal(title, content, retryCallback = null) {
        const options = {
            title: title,
            content: content,
            showCancel: !!retryCallback,
            confirmText: retryCallback ? '重试' : '确定'
        };

        if (retryCallback) {
            options.cancelText = '取消';
            options.success = (res) => {
                if (res.confirm && retryCallback) {
                    retryCallback();
                }
            };
        }

        wx.showModal(options);
    }

    /**
     * 显示成功提示
     * @param {string} message 提示信息
     */
    static showSuccessToast(message) {
        wx.showToast({
            title: message,
            icon: 'success',
            duration: 2000
        });
    }

    /**
     * 显示失败提示
     * @param {string} message 提示信息
     */
    static showErrorToast(message) {
        wx.showToast({
            title: message,
            icon: 'none',
            duration: 2000
        });
    }

    /**
     * 防抖函数
     * @param {Function} func 要防抖的函数
     * @param {number} delay 延迟时间
     * @returns {Function} 防抖后的函数
     */
    static debounce(func, delay) {
        let timeoutId;
        return function (...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => func.apply(this, args), delay);
        };
    }

    /**
     * 节流函数
     * @param {Function} func 要节流的函数
     * @param {number} delay 延迟时间
     * @returns {Function} 节流后的函数
     */
    static throttle(func, delay) {
        let lastCall = 0;
        return function (...args) {
            const now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                return func.apply(this, args);
            }
        };
    }
}

module.exports = RoomListUtilService; 