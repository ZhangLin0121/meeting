const request = require('../utils/request');

/**
 * 个人资料数据服务
 * 处理所有个人资料数据获取相关的逻辑
 */
class ProfileDataService {

    /**
     * 获取用户信息
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<Object>} 用户信息
     */
    static async getUserInfo(pageContext) {
        try {
            const app = getApp();
            console.log('📱 开始获取用户信息...');

            // 首先尝试从全局状态获取
            if (app.globalData.userInfo && app.globalData.userInfo.openid) {
                console.log('✅ 从全局状态获取用户信息');
                const userInfo = app.globalData.userInfo;
                if (userInfo.avatarUrl) {
                    if (userInfo.avatarUrl.startsWith('/uploads/')) {
                        userInfo.avatarUrl = request.getBaseUrl() + userInfo.avatarUrl;
                    }
                    const ts = Date.now();
                    userInfo.avatarUrl = userInfo.avatarUrl + (userInfo.avatarUrl.includes('?') ? '&' : '?') + 't=' + ts;
                }

                pageContext.setData({ userInfo: userInfo, isAdmin: userInfo.role === 'admin', loading: false });
                // http 资源下载成本地临时路径以规避 http 限制
                this.ensureLocalAvatar(pageContext);

                return userInfo;
            }

            // 从本地存储获取
            const localUserInfo = wx.getStorageSync('userInfo');
            if (localUserInfo && localUserInfo.openid) {
                console.log('✅ 从本地存储获取用户信息');
                // 头像前缀与缓存
                if (localUserInfo.avatarUrl) {
                    if (localUserInfo.avatarUrl.startsWith('/uploads/')) {
                        localUserInfo.avatarUrl = request.getBaseUrl() + localUserInfo.avatarUrl;
                    }
                    const ts2 = Date.now();
                    localUserInfo.avatarUrl = localUserInfo.avatarUrl + (localUserInfo.avatarUrl.includes('?') ? '&' : '?') + 't=' + ts2;
                }
                pageContext.setData({ userInfo: localUserInfo, isAdmin: localUserInfo.role === 'admin', loading: false });
                this.ensureLocalAvatar(pageContext);

                // 更新全局状态
                app.globalData.userInfo = localUserInfo;
                return localUserInfo;
            }

            // 从服务器获取最新信息
            console.log('🌐 从服务器获取用户信息...');
            const result = await request.get('/api/user/profile');

            if (result.success && result.data) {
                const userInfo = result.data;
                // 头像URL前缀与缓存
                if (userInfo.avatarUrl) {
                    if (userInfo.avatarUrl.startsWith('/uploads/')) {
                        userInfo.avatarUrl = request.getBaseUrl() + userInfo.avatarUrl;
                    }
                    // 加时间戳防缓存
                    const ts = Date.now();
                    userInfo.avatarUrl = userInfo.avatarUrl + (userInfo.avatarUrl.includes('?') ? '&' : '?') + 't=' + ts;
                }
                console.log('✅ 成功获取服务器用户信息:', userInfo);

                pageContext.setData({ userInfo: userInfo, isAdmin: userInfo.role === 'admin', loading: false });
                this.ensureLocalAvatar(pageContext);

                // 更新全局状态和本地存储
                app.globalData.userInfo = userInfo;
                wx.setStorageSync('userInfo', userInfo);

                return userInfo;
            } else {
                throw new Error(result.message || '获取用户信息失败');
            }

        } catch (error) {
            console.error('❌ 获取用户信息失败:', error);
            
            pageContext.setData({
                loading: false,
                userInfo: null
            });

            wx.showToast({
                title: error.message || '获取用户信息失败',
                icon: 'none'
            });

            throw error;
        }
    }

    /**
     * 获取即将到来的预约数量
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<number>} 预约数量
     */
    static async getUpcomingBookingsCount(pageContext) {
        try {
            console.log('📅 获取即将到来的预约数量...');

            const result = await request.get('/api/user/bookings', { page: 1, limit: 100 });

            if (result.success && result.data) {
                let upcomingCount = 0;
                const now = new Date();

                const isUpcoming = (b) => {
                    if (!b || b.status === 'cancelled') return false;
                    const d = b.bookingDate || b.date || '';
                    const et = b.endTime || '';
                    if (!d || !et) return false;
                    const end = new Date(`${d} ${et}`);
                    return !isNaN(end.getTime()) && end > now;
                };

                if (Array.isArray(result.data?.upcomingBookings)) {
                    upcomingCount = result.data.upcomingBookings.filter(isUpcoming).length;
                } else if (Array.isArray(result.data?.bookings)) {
                    upcomingCount = result.data.bookings.filter(isUpcoming).length;
                } else if (Array.isArray(result.data)) {
                    upcomingCount = result.data.filter(isUpcoming).length;
                }

                console.log(`✅ 获取到 ${upcomingCount} 个即将到来的预约`);

                pageContext.setData({
                    upcomingBookingsCount: upcomingCount
                });

                return upcomingCount;
            } else {
                console.log('⚠️ 获取预约数量失败:', result.message);
                return 0;
            }
        } catch (error) {
            console.error('❌ 获取预约数量失败:', error);
            return 0;
        }
    }

    /**
     * 刷新用户数据
     * @param {Object} pageContext - 页面上下文
     * @param {boolean} forceRefresh - 是否强制从服务器刷新
     * @returns {Promise<void>}
     */
    static async refreshUserData(pageContext, forceRefresh = false) {
        try {
            pageContext.setData({ loading: true });

            let userInfo;
            if (forceRefresh) {
                // 强制从服务器获取最新数据
                console.log('🔄 强制从服务器刷新用户数据');
                const result = await request.get('/api/user/profile');
                if (result.success && result.data) {
                    userInfo = result.data;

                    // 统一处理头像URL（与 getUserInfo 保持一致）
                    if (userInfo.avatarUrl) {
                        if (userInfo.avatarUrl.startsWith('/uploads/')) {
                            userInfo.avatarUrl = request.getBaseUrl() + userInfo.avatarUrl;
                        } else if (userInfo.avatarUrl.startsWith('//')) {
                            userInfo.avatarUrl = 'https:' + userInfo.avatarUrl;
                        }
                        const ts = Date.now();
                        userInfo.avatarUrl = userInfo.avatarUrl + (userInfo.avatarUrl.includes('?') ? '&' : '?') + 't=' + ts;
                    }

                    pageContext.setData({ userInfo: userInfo, isAdmin: userInfo.role === 'admin', loading: false });
                    this.ensureLocalAvatar(pageContext);

                    // 更新全局状态和本地存储
                    const app = getApp();
                    if (app.globalData) {
                        app.globalData.userInfo = userInfo;
                    }
                    wx.setStorageSync('userInfo', userInfo);
                } else {
                    throw new Error(result.message || '获取用户信息失败');
                }
            } else {
                // 正常获取流程
                userInfo = await this.getUserInfo(pageContext);
            }

            // 获取预约数量
            await this.getUpcomingBookingsCount(pageContext);

            console.log('✅ 用户数据刷新完成');
            return userInfo;

        } catch (error) {
            console.error('❌ 刷新用户数据失败:', error);

            // 确保即使出错，upcomingBookingsCount也有默认值
            if (pageContext.data.upcomingBookingsCount === undefined) {
                pageContext.setData({
                    upcomingBookingsCount: 0,
                    loading: false
                });
            } else {
                pageContext.setData({ loading: false });
            }

            throw error;
        }
    }

    /**
     * 验证用户信息完整性
     * @param {Object} userInfo - 用户信息
     * @returns {Object} 验证结果
     */
    static validateUserInfo(userInfo) {
        const missing = [];
        const warnings = [];

        if (!userInfo) {
            return {
                valid: false,
                message: '用户信息不存在',
                missing: ['userInfo'],
                warnings: []
            };
        }

        // 检查必需字段
        if (!userInfo.openid) missing.push('openid');
        if (!userInfo.company) missing.push('company');

        // 检查建议字段
        if (!userInfo.contactName) warnings.push('contactName');
        if (!userInfo.contactPhone) warnings.push('contactPhone');
        if (!userInfo.avatarUrl) warnings.push('avatarUrl');

        return {
            valid: missing.length === 0,
            message: missing.length > 0 ? `缺少必需字段: ${missing.join(', ')}` : '用户信息完整',
            missing: missing,
            warnings: warnings
        };
    }

    /**
     * 格式化用户信息显示
     * @param {Object} userInfo - 用户信息
     * @returns {Object} 格式化后的显示信息
     */
    static formatUserDisplayInfo(userInfo) {
        if (!userInfo) {
            return {
                displayName: '未知用户',
                displayAvatar: '/images/default-avatar.png',
                displayPhone: '未设置',
                displayRole: '普通用户',
                hasCompleteInfo: false
            };
        }

        return {
            displayName: userInfo.company || userInfo.contactName || '未设置公司名称',
            displayAvatar: userInfo.avatarUrl || '/images/default-avatar.png',
            displayPhone: userInfo.contactPhone ? 
                userInfo.contactPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : 
                '未设置',
            displayRole: userInfo.role === 'admin' ? '管理员' : '普通用户',
            hasCompleteInfo: !!(userInfo.company && userInfo.contactName && userInfo.contactPhone)
        };
    }

    /**
     * 如头像是 http 资源，下载为临时文件用于展示，规避 http 显示限制
     */
    static ensureLocalAvatar(pageContext) {
        try {
            const ui = pageContext.data.userInfo;
            if (!ui || !ui.avatarUrl) return;
            const url = ui.avatarUrl;
            if (typeof url === 'string' && url.startsWith('http://')) {
                wx.downloadFile({
                    url,
                    success: (res) => {
                        if (res.tempFilePath) {
                            const updated = { ...ui, avatarUrl: res.tempFilePath };
                            pageContext.setData({ userInfo: updated });
                            const app = getApp();
                            if (app && app.globalData) app.globalData.userInfo = updated;
                            wx.setStorageSync('userInfo', updated);
                        }
                    },
                    fail: (err) => {
                        console.warn('⚠️ 下载头像失败，保留原URL:', err);
                    }
                });
            }
        } catch (e) {
            console.warn('⚠️ ensureLocalAvatar 异常:', e);
        }
    }

    /**
     * 检查用户权限
     * @param {Object} userInfo - 用户信息
     * @param {string} permission - 权限类型
     * @returns {boolean} 是否有权限
     */
    static checkUserPermission(userInfo, permission) {
        if (!userInfo) return false;

        switch (permission) {
            case 'admin':
                return userInfo.role === 'admin';
            case 'booking':
                return !!(userInfo.openid && userInfo.company);
            case 'profile_edit':
                return !!userInfo.openid;
            default:
                return false;
        }
    }

    /**
     * 获取用户统计信息
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<Object>} 统计信息
     */
    static async getUserStats(pageContext) {
        try {
            // 首先尝试从用户预约记录中获取统计数据
            const bookingsResult = await request.get('/api/user/bookings', { page: 1, limit: 100 });

            if (bookingsResult.success && bookingsResult.data) {
                console.log('📊 预约记录API响应:', JSON.stringify(bookingsResult));

                // 检查数据结构，确保data是数组
                let bookingsData = bookingsResult.data;
                console.log('📊 API响应数据结构:', typeof bookingsData, bookingsData);

                if (bookingsData && typeof bookingsData === 'object' && !Array.isArray(bookingsData)) {
                    // 如果data是对象而不是数组，尝试从对象中提取统计信息
                    if (bookingsData.pagination && bookingsData.pagination.totalCount !== undefined) {
                        // 检测到分页对象格式，直接使用统计数据
                        console.log('📊 检测到分页对象格式，使用统计数据');

                        // 计算即将开始的预约数量
                        const isUpcoming = (b) => {
                            if (!b || b.status === 'cancelled') return false;
                            const d = b.bookingDate || b.date || '';
                            const et = b.endTime || '';
                            if (!d || !et) return false;
                            const end = new Date(`${d} ${et}`);
                            return !isNaN(end.getTime()) && end > new Date();
                        };
                        const upcomingBookingsCount = bookingsData.upcomingBookings ? bookingsData.upcomingBookings.filter(isUpcoming).length : 0;

                        const stats = {
                            // 总预约数不包含已取消
                            totalBookings: Array.isArray(bookingsData.bookings)
                                ? bookingsData.bookings.filter(b => b && b.status !== 'cancelled').length
                                : (bookingsData.pagination.totalCount || 0),
                            upcomingBookings: upcomingBookingsCount,
                            completedBookings: bookingsData.pastBookings ? bookingsData.pastBookings.length : 0,
                            cancelledBookings: 0, // 暂时不支持
                            favoriteRooms: [],
                            joinDate: null
                        };

                        console.log('📊 统计结果:', stats);

                        pageContext.setData({
                            totalBookings: stats.totalBookings,
                            userStats: stats
                        });
                        return stats;
                    } else if (bookingsData.bookings) {
                        bookingsData = bookingsData.bookings;
                    } else if (bookingsData.data) {
                        bookingsData = bookingsData.data;
                    } else if (bookingsData.upcomingBookings !== undefined) {
                        // 可能是统计对象，不是预约数组
                        console.log('📊 检测到统计对象格式，直接使用数据');
                        const stats = {
                            totalBookings: (bookingsData.totalBookings || 0),
                            upcomingBookings: Array.isArray(bookingsData.upcomingBookings)
                                ? bookingsData.upcomingBookings.filter(b => b && b.status !== 'cancelled' && b.endTime && new Date(b.endTime) > new Date()).length
                                : (bookingsData.upcomingBookings || 0),
                            completedBookings: bookingsData.completedBookings || 0,
                            cancelledBookings: bookingsData.cancelledBookings || 0,
                            favoriteRooms: bookingsData.favoriteRooms || [],
                            joinDate: bookingsData.joinDate || null
                        };

                        console.log('📊 统计结果:', stats);

                        pageContext.setData({
                            totalBookings: stats.totalBookings,
                            userStats: stats
                        });
                        return stats;
                    }
                }

                // 总预约数不包含已取消
                const totalBookings = Array.isArray(bookingsData) ? bookingsData.filter(b => b && b.status !== 'cancelled').length : 0;

                let upcomingBookings = 0;
                if (Array.isArray(bookingsData)) {
                    const now = new Date();
                    upcomingBookings = bookingsData.filter(b => {
                        if (!b || b.status === 'cancelled') return false;
                        const d = b.bookingDate || b.date || '';
                        const et = b.endTime || '';
                        if (!d || !et) return false;
                        const end = new Date(`${d} ${et}`);
                        return !isNaN(end.getTime()) && end > now;
                    }).length || 0;
                }

                const stats = {
                    totalBookings: totalBookings,
                    upcomingBookings: upcomingBookings,
                    completedBookings: 0, // 暂时不支持
                    cancelledBookings: 0, // 暂时不支持
                    favoriteRooms: [],
                    joinDate: null
                };

                console.log('📊 统计结果:', stats);

                pageContext.setData({
                    totalBookings: totalBookings,
                    userStats: stats
                });
                return stats;
            } else {
                console.log('⚠️ 获取用户统计失败:', bookingsResult.message);
                return null;
            }
        } catch (error) {
            console.error('❌ 获取用户统计失败:', error);
            return null;
        }
    }

    /**
     * 清除用户数据
     * @param {Object} pageContext - 页面上下文
     * @returns {Promise<void>}
     */
    static async clearUserData(pageContext) {
        try {
            // 清除页面数据
            pageContext.setData({
                userInfo: null,
                isAdmin: false,
                upcomingBookingsCount: 0,
                userStats: null,
                loading: false
            });

            // 清除全局数据
            const app = getApp();
            if (app.globalData) {
                app.globalData.userInfo = null;
            }

            // 清除本地存储
            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('token');

            console.log('✅ 用户数据已清除');
        } catch (error) {
            console.error('❌ 清除用户数据失败:', error);
        }
    }

    /**
     * 更新本地用户信息
     * @param {Object} pageContext - 页面上下文
     * @param {Object} updates - 更新的字段
     * @returns {Object} 更新后的用户信息
     */
    static updateLocalUserInfo(pageContext, updates) {
        const currentUserInfo = pageContext.data.userInfo || {};
        const updatedUserInfo = { ...currentUserInfo, ...updates };

        // 更新页面数据
        pageContext.setData({
            userInfo: updatedUserInfo,
            isAdmin: updatedUserInfo.role === 'admin'
        });

        // 更新全局数据
        const app = getApp();
        if (app.globalData) {
            app.globalData.userInfo = updatedUserInfo;
        }

        // 更新本地存储
        wx.setStorageSync('userInfo', updatedUserInfo);

        console.log('✅ 本地用户信息已更新:', updates);
        return updatedUserInfo;
    }
}

module.exports = ProfileDataService; 
