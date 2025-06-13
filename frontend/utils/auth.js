// utils/auth.js - 微信认证工具
const request = require('./request.js');

/**
 * 微信认证工具
 * 处理微信登录、用户信息管理等功能
 */

/**
 * 安全获取App实例
 */
function getSafeApp() {
    try {
        const app = getApp();
        return app && app.globalData ? app : null;
    } catch (error) {
        console.warn('⚠️ 获取App实例失败:', error);
        return null;
    }
}

/**
 * 登录到服务器
 */
async function loginToServer(code, userProfile = null) {
    try {
        const loginData = {
            code: code
        };

        // 如果有用户授权信息，一并发送
        if (userProfile) {
            loginData.nickname = userProfile.nickName;
            loginData.avatarUrl = userProfile.avatarUrl;
        }

        console.log('🔐 发送登录请求到服务器...');
        const result = await request.post('/api/user/wechat-login', loginData);

        if (result.success) {
            console.log('✅ 服务器登录成功:', result.data);
            return result.data;
        } else {
            throw new Error(result.message || '服务器登录失败');
        }

    } catch (error) {
        console.error('❌ 服务器登录失败:', error);
        throw error;
    }
}

/**
 * 执行微信登录流程
 */
async function performWechatLogin() {
    try {
        console.log('🔐 开始微信登录流程...');

        // 1. 获取微信登录码
        const loginResult = await new Promise((resolve, reject) => {
            wx.login({
                success: resolve,
                fail: reject,
                timeout: 10000
            });
        });

        console.log('✅ 获取微信登录码成功:', loginResult.code);

        if (!loginResult.code) {
            throw new Error('获取微信登录码失败');
        }

        // 2. 发送到服务器进行登录
        const userInfo = await loginToServer(loginResult.code);

        if (userInfo && userInfo.openid) {
            // 3. 保存到全局状态和本地存储
            const app = getSafeApp();
            if (app) {
                app.globalData.userInfo = userInfo;
            }

            wx.setStorageSync('userInfo', userInfo);
            wx.setStorageSync('loginTime', Date.now());

            console.log('✅ 微信登录完成:', userInfo.openid);
            return userInfo;
        } else {
            throw new Error('服务器登录失败：返回数据无效');
        }

    } catch (error) {
        console.error('❌ 微信登录失败:', error);
        throw error;
    }
}

/**
 * 微信认证工具类
 */
class WechatAuth {

    /**
     * 获取用户资料（需要用户授权）
     */
    static async getUserProfile() {
        return new Promise((resolve, reject) => {
            wx.getUserProfile({
                desc: '用于完善会议室预约功能，提升服务体验',
                success: (res) => {
                    resolve(res.userInfo);
                },
                fail: (error) => {
                    reject(error);
                }
            });
        });
    }

    /**
     * 创建临时用户（当微信登录失败时的备用方案）
     */
    static async createTemporaryUser() {
        try {
            // 生成一个临时的openid
            const tempOpenid = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

            const tempUserData = {
                openid: tempOpenid,
                nickname: '临时用户',
                avatarUrl: ''
            };

            console.log('🔄 创建临时用户:', tempOpenid);
            const result = await request.post('/api/user/login', tempUserData);

            if (result.success) {
                const userInfo = result.data;
                const app = getApp();
                app.globalData.userInfo = userInfo;
                wx.setStorageSync('userInfo', userInfo);

                console.log('✅ 临时用户创建成功');
                return userInfo;
            } else {
                throw new Error(result.message || '创建临时用户失败');
            }

        } catch (error) {
            console.error('❌ 创建临时用户失败:', error);
            throw error;
        }
    }

    /**
     * 检查当前登录状态
     */
    static checkLoginStatus() {
        try {
            const app = getSafeApp();
            if (app && app.globalData && app.globalData.userInfo && app.globalData.userInfo.openid) {
                return app.globalData.userInfo;
            }

            // 从本地存储检查
            const userInfo = wx.getStorageSync('userInfo');
            if (userInfo && userInfo.openid) {
                // 重新设置到全局状态
                if (app) {
                    app.globalData.userInfo = userInfo;
                }
                return userInfo;
            }

            return null;
        } catch (error) {
            console.error('❌ 检查登录状态失败:', error);
            return null;
        }
    }

    /**
     * 注销登录
     */
    static logout() {
        try {
            const app = getSafeApp();
            if (app) {
                app.globalData.userInfo = null;
            }

            wx.removeStorageSync('userInfo');
            wx.removeStorageSync('loginTime');

            console.log('✅ 用户已注销登录');
        } catch (error) {
            console.error('❌ 注销失败:', error);
        }
    }
}

module.exports = WechatAuth;