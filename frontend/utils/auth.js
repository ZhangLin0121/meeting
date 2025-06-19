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
 * 安全保存用户信息 - 解决安卓设备存储同步问题
 */
async function saveUserInfoSafely(userInfo) {
    try {
        console.log('💾 开始保存用户信息...');

        // 1. 保存到全局状态
        const app = getSafeApp();
        if (app) {
            app.globalData.userInfo = userInfo;
            console.log('✅ 已保存到全局状态');
        }

        // 2. 保存到本地存储（使用异步方式确保可靠性）
        await new Promise((resolve, reject) => {
            wx.setStorage({
                key: 'userInfo',
                data: userInfo,
                success: () => {
                    console.log('✅ 已保存到本地存储');
                    resolve();
                },
                fail: (error) => {
                    console.error('❌ 本地存储失败:', error);
                    // 尝试同步方式作为备选
                    try {
                        wx.setStorageSync('userInfo', userInfo);
                        console.log('✅ 同步存储成功');
                        resolve();
                    } catch (syncError) {
                        console.error('❌ 同步存储也失败:', syncError);
                        reject(syncError);
                    }
                }
            });
        });

        // 3. 保存登录时间戳
        wx.setStorageSync('loginTime', Date.now());

        // 4. 验证保存是否成功
        const savedInfo = wx.getStorageSync('userInfo');
        if (!savedInfo || !savedInfo.openid) {
            throw new Error('用户信息保存验证失败');
        }

        console.log('✅ 用户信息保存完成并验证成功');

    } catch (error) {
        console.error('❌ 保存用户信息失败:', error);
        throw new Error('用户信息保存失败，请重试');
    }
}

/**
 * 微信认证工具类
 */
class WechatAuth {

    /**
     * 执行微信登录流程 - 主要登录方法
     */
    static async performWechatLogin() {
        try {
            console.log('🔐 开始微信登录流程...');

            // 1. 获取微信登录码
            const loginResult = await new Promise((resolve, reject) => {
                wx.login({
                    success: resolve,
                    fail: reject,
                    timeout: 15000 // 增加超时时间，安卓设备可能需要更长时间
                });
            });

            console.log('✅ 获取微信登录码成功:', loginResult.code);

            if (!loginResult.code) {
                throw new Error('获取微信登录码失败');
            }

            // 2. 发送到服务器进行登录
            const userInfo = await loginToServer(loginResult.code);

            if (userInfo && userInfo.openid) {
                // 3. 增强的数据保存逻辑 - 解决安卓设备问题
                await saveUserInfoSafely(userInfo);

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
     * 获取用户资料（需要用户授权）
     */
    static async getUserProfile() {
        return new Promise((resolve, reject) => {
            wx.getUserProfile({
                desc: '用于完善会议室预约服务',
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
     * 智能登录 - 避免重复弹窗的优化登录方法
     */
    static async smartLogin() {
        try {
            // 首先检查现有登录状态
            const existingUserInfo = this.checkLoginStatus();
            if (existingUserInfo && existingUserInfo.openid) {
                console.log('✅ 使用现有登录状态:', existingUserInfo.openid);
                return existingUserInfo;
            }

            // 如果没有现有状态，执行新的登录流程
            console.log('🔐 执行新的登录流程...');
            return await this.performWechatLogin();

        } catch (error) {
            console.error('❌ 智能登录失败:', error);
            throw error;
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

    /**
     * 获取微信头像（便捷方法）
     */
    static async getWechatAvatar() {
        try {
            console.log('🖼️ 开始获取微信头像...');

            // 检查API兼容性
            if (!wx.chooseAvatar) {
                console.log('⚠️ 当前版本不支持 wx.chooseAvatar API');
                throw new Error('当前微信版本不支持直接获取头像功能，请升级微信到最新版本或使用其他方式');
            }

            // 使用新的微信头像选择器
            const result = await new Promise((resolve, reject) => {
                wx.chooseAvatar({
                    success: resolve,
                    fail: reject
                });
            });

            console.log('✅ 微信头像获取成功:', result.avatarUrl);
            return result.avatarUrl;

        } catch (error) {
            console.error('❌ 获取微信头像失败:', error);
            throw error;
        }
    }

    /**
     * 获取微信用户信息（包含头像和昵称）
     */
    static async getWechatUserInfo() {
        try {
            console.log('👤 开始获取微信用户信息...');

            const result = await new Promise((resolve, reject) => {
                wx.getUserProfile({
                    desc: '用于显示您的头像和昵称',
                    success: resolve,
                    fail: reject
                });
            });

            console.log('✅ 微信用户信息获取成功:', {
                nickName: result.userInfo.nickName,
                avatarUrl: result.userInfo.avatarUrl ? '已获取' : '未获取'
            });

            return result.userInfo;

        } catch (error) {
            console.error('❌ 获取微信用户信息失败:', error);
            throw error;
        }
    }

    /**
     * 直接登录并获取用户信息（包含头像）
     */
    static async loginWithUserInfo() {
        try {
            console.log('🔐 开始登录并获取用户信息...');

            // 1. 获取微信登录码
            const loginResult = await new Promise((resolve, reject) => {
                wx.login({
                    success: resolve,
                    fail: reject,
                    timeout: 15000
                });
            });

            if (!loginResult.code) {
                throw new Error('获取微信登录码失败');
            }

            // 2. 获取用户授权信息
            let userProfile = null;
            try {
                userProfile = await this.getWechatUserInfo();
                console.log('✅ 用户授权信息获取成功');
            } catch (authError) {
                console.warn('⚠️ 用户拒绝授权，使用基础登录方式');
            }

            // 3. 发送到服务器登录
            const userInfo = await loginToServer(loginResult.code, userProfile);

            if (userInfo && userInfo.openid) {
                await saveUserInfoSafely(userInfo);
                console.log('✅ 登录并获取用户信息完成:', userInfo.openid);
                return userInfo;
            } else {
                throw new Error('服务器登录失败：返回数据无效');
            }

        } catch (error) {
            console.error('❌ 登录并获取用户信息失败:', error);
            throw error;
        }
    }
}

module.exports = WechatAuth;