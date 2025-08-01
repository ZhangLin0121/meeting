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

                pageContext.setData({
                    userInfo: userInfo,
                    isAdmin: userInfo.role === 'admin',
                    loading: false
                });

                return userInfo;
            }

            // 从本地存储获取
            const localUserInfo = wx.getStorageSync('userInfo');
            if (localUserInfo && localUserInfo.openid) {
                console.log('✅ 从本地存储获取用户信息');
                
                pageContext.setData({
                    userInfo: localUserInfo,
                    isAdmin: localUserInfo.role === 'admin',
                    loading: false
                });

                // 更新全局状态
                app.globalData.userInfo = localUserInfo;
                return localUserInfo;
            }

            // 从服务器获取最新信息
            console.log('🌐 从服务器获取用户信息...');
            const result = await request.get('/api/user/profile');

            if (result.success && result.data) {
                const userInfo = result.data;
                console.log('✅ 成功获取服务器用户信息:', userInfo);

                pageContext.setData({
                    userInfo: userInfo,
                    isAdmin: userInfo.role === 'admin',
                    loading: false
                });

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
            
            const result = await request.get('/api/user/bookings', {
                limit: 10,
                fields: 'contactName,contactPhone'
            });

            if (result.success && result.data) {
                const upcomingCount = result.data.length;
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
     * @returns {Promise<void>}
     */
    static async refreshUserData(pageContext) {
        try {
            pageContext.setData({ loading: true });

            // 并行获取用户信息和预约数量
            const [userInfo] = await Promise.all([
                this.getUserInfo(pageContext),
                this.getUpcomingBookingsCount(pageContext)
            ]);

            console.log('✅ 用户数据刷新完成');
            return userInfo;

        } catch (error) {
            console.error('❌ 刷新用户数据失败:', error);
            throw error;
        } finally {
            pageContext.setData({ loading: false });
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
        if (!userInfo.nickname) missing.push('nickname');

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
            displayName: userInfo.nickname || userInfo.contactName || '未设置昵称',
            displayAvatar: userInfo.avatarUrl || '/images/default-avatar.png',
            displayPhone: userInfo.contactPhone ? 
                userInfo.contactPhone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') : 
                '未设置',
            displayRole: userInfo.role === 'admin' ? '管理员' : '普通用户',
            hasCompleteInfo: !!(userInfo.nickname && userInfo.contactName && userInfo.contactPhone)
        };
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
                return !!(userInfo.openid && userInfo.nickname);
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
            const result = await request.get('/api/user/stats');
            
            if (result.success && result.data) {
                const stats = {
                    totalBookings: result.data.totalBookings || 0,
                    completedBookings: result.data.completedBookings || 0,
                    cancelledBookings: result.data.cancelledBookings || 0,
                    upcomingBookings: result.data.upcomingBookings || 0,
                    favoriteRooms: result.data.favoriteRooms || [],
                    joinDate: result.data.joinDate || null
                };

                pageContext.setData({ userStats: stats });
                return stats;
            } else {
                console.log('⚠️ 获取用户统计失败:', result.message);
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